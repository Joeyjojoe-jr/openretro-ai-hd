import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';
import {
  simulateDataFetch,
  generateUserSummary,
  checkLoginActivity,
  sendEmail,
} from './internalFunctions';

admin.initializeApp();
const db = admin.firestore();

// === Interfaces ===

export interface UserRequest {
  id?: string;
  userId: string;
  prompt: string;
  status: 'received' | 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  plan?: TaskStep[];
  error?: string;
}

export interface TaskStep {
  id?: string;
  taskId: string;
  requestId: string;
  description: string;
  state: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  action: {
    type: 'callFunction' | 'sendEmail' | 'updateFirestore' | 'callApi';
    functionName?: string;
    emailDetails?: {
      to: string;
      subject: string;
      body: string;
    };
    params?: { [key: string]: any };
    inputMapping?: {
      [paramName: string]: string | { from: string; field?: string | string[] };
    };
  };
  result?: any;
  output?: any;
  error?: string;
  retries?: number;
  dependencies?: string[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  startedAt?: admin.firestore.Timestamp;
  completedAt?: admin.firestore.Timestamp;
}

// === Function Registry ===

const internalFunctionRegistry: { [key: string]: (params: any) => Promise<any> } = {
  simulateDataFetch,
  generateUserSummary,
  checkLoginActivity,
  sendEmail,
};

// === Helper: Get Nested Property ===

function getNestedProperty(obj: any, path: string[]): any {
  if (!obj || !path || path.length === 0) return undefined;
  let current = obj;
  for (const key of path) {
    if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
    current = current[key];
  }
  return current;
}

// === Input Mapper ===

export function resolveInputMapping(step: TaskStep, plan: TaskStep[]): { [key: string]: any } {
  const actionParams: { [key: string]: any } = {};

  if (!step.action.inputMapping) return step.action.params || {};

  const dependencyOutputs: { [stepId: string]: any } = {};
  if (step.dependencies) {
    for (const depId of step.dependencies) {
      const dep = plan.find(s => s.id === depId);
      if (!dep) throw new Error(`Dependency "${depId}" not found for step "${step.id}".`);
      if (dep.state !== 'completed') throw new Error(`Dependency "${depId}" not completed for step "${step.id}".`);
      if (!dep.output) console.warn(`Dependency "${depId}" has no output.`);
      dependencyOutputs[depId] = dep.output;
    }
  }

  for (const paramName in step.action.inputMapping) {
    const mapping = step.action.inputMapping[paramName];

    if (typeof mapping === 'string') {
      actionParams[paramName] = mapping;
    } else if (mapping.from) {
      const output = dependencyOutputs[mapping.from];
      if (output === undefined) throw new Error(`No output from "${mapping.from}" for "${paramName}" in "${step.id}".`);

      let value = output;
      if (mapping.field !== undefined) {
        value = Array.isArray(mapping.field)
          ? getNestedProperty(value, mapping.field)
          : value[mapping.field];
        if (value === undefined) {
          const fieldPath = Array.isArray(mapping.field) ? mapping.field.join('.') : mapping.field;
          throw new Error(`Field "${fieldPath}" not found in "${mapping.from}" for "${paramName}" in "${step.id}".`);
        }
      }

      actionParams[paramName] = value;
    } else {
      console.warn(`Invalid inputMapping for "${paramName}" in step "${step.id}".`);
      actionParams[paramName] = undefined;
    }
  }

  return { ...step.action.params, ...actionParams };
}

// === Step Executor ===

export async function executeStep(step: TaskStep, request: UserRequest): Promise<void> {
  console.log(`Executing step ${step.id} - ${step.description} for request ${request.id}`);

  const requestRef = db.collection('requests').doc(request.id!);
  const stepRef = requestRef.collection('plan').doc(step.id!);

  try {
    await stepRef.update({
      state: 'executing',
      startedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    let stepResult: any = null;
    let actionParams: { [key: string]: any } = {};

    try {
      actionParams = resolveInputMapping(step, request.plan || []);
      console.log(`Resolved parameters for step ${step.id}:`, actionParams);
    } catch (mappingError: any) {
      const errorMessage = `Mapping failed: ${mappingError.message}`;
      console.error(errorMessage);
      await stepRef.update({
        state: 'failed',
        error: errorMessage,
        completedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      return;
    }

    switch (step.action.type) {
      case 'sendEmail': {
        const emailDetails = {
          to: actionParams.to || step.action.emailDetails?.to,
          subject: actionParams.subject || step.action.emailDetails?.subject,
          body: actionParams.body || step.action.emailDetails?.body,
        };

        if (!emailDetails.to || !emailDetails.subject || !emailDetails.body) {
          throw new Error('Missing email parameters.');
        }

        const mailOptions = {
          from: functions.config().email.sender_address || 'noreply@yourproject.com',
          to: emailDetails.to,
          subject: emailDetails.subject,
          text: emailDetails.body,
        };

        const info = await sendEmail(mailOptions); // Calls simulated or real version
        console.log('Email sent:', info);
        stepResult = info;
        break;
      }

      case 'callFunction': {
        const fnName = step.action.functionName;
        const fn = internalFunctionRegistry[fnName];
        if (!fn) throw new Error(`Function "${fnName}" not found in registry.`);
        stepResult = await fn(actionParams);
        break;
      }

      default:
        throw new Error(`Unknown action type: ${step.action.type}`);
    }

    await stepRef.update({
      state: 'completed',
      output: stepResult,
      result: stepResult,
      error: null,
      completedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    console.log(`Step ${step.id} completed successfully.`);
  } catch (error: any) {
    console.error(`Execution error for step ${step.id}:`, error.message);

    const isPermanent =
      error.message.includes('not found') ||
      error.message.includes('Unknown action type') ||
      error.message.includes('Mapping');

    const retries = step.retries || 0;
    const maxRetries = 3;
    const shouldRetry = !isPermanent && retries < maxRetries;

    const newState = shouldRetry ? 'pending' : 'failed';

    await stepRef.update({
      state: newState,
      error: error.message,
      retries: shouldRetry ? retries + 1 : retries,
      completedAt: shouldRetry ? null : admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    if (!shouldRetry) {
      console.warn(`Step ${step.id} permanently failed.`);
    }
  }
}
