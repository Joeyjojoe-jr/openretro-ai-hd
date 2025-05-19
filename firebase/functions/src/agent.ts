import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Removed getFunctions and httpsCallable as they are not needed in agent.ts for Firestore triggers
import * as nodemailer from 'nodemailer';
admin.initializeApp(); // Initialize Firebase Admin SDK
import { simulateDataFetch, generateUserSummary, checkLoginActivity } from './internalFunctions'; // Import the internal functions

const db = admin.firestore();

export interface UserRequest {
  id?: string; // Firestore document ID
  userId: string;
  prompt: string; // Natural language request
  status: 'received' | 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface Task {
  id?: string; // Firestore document ID
  requestId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: TaskStep[];
  createdAt: admin.firestore.Timestamp;

  updatedAt: admin.firestore.Timestamp; // Timestamp of last update
  error?: string; // Error message if task failed
}

export interface TaskStep {
  id?: string; // Unique ID for the step
  taskId: string;
  requestId: string; // Add requestId to TaskStep
  description: string;
  state: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'; // Rename status to state
  action: { // Define action details
    type: 'callFunction' | 'updateFirestore' | 'sendEmail' | 'callApi';
    functionName?: string;
    apiEndpoint?: string;
    firestorePath?: string;
    emailDetails?: {
      to: string;
      subject: string;
      body: string;
    };
    params?: { [key: string]: any }; // Add params for callFunction
 inputMapping?: { // Add inputMapping field
 [actionParamName: string]: string | { from: string, field?: string | string[] };
 };
  };
  result?: any; // Result of the step execution
  error?: string; // Change error type to string for simplicity
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  startedAt?: admin.firestore.Timestamp; // Add timing fields
  completedAt?: admin.firestore.Timestamp;
  retries?: number; // Add retry counter
  output?: any; // Add optional output field to store step results
 dependencies?: string[]; // Add optional dependencies field
}

// Configure Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  host: functions.config().email.host,
  port: functions.config().email.port,
  secure: functions.config().email.secure, // true for 465, false for other ports
  auth: {
    user: functions.config().email.auth.user,
    pass: functions.config().email.auth.pass,
  },
});

// Define a registry of internal functions
const internalFunctionRegistry: { [key: string]: (params: any) => Promise<any> } = {
  simulateDataFetch: simulateDataFetch,
  generateUserSummary: generateUserSummary,
  checkLoginActivity: checkLoginActivity,
  // Add other internal functions here
};

/**
 * Safely accesses a nested property within an object using a string array path.
 * @param obj The object to traverse.
 * @param path The array of keys representing the path.
 * @returns The value at the specified path, or undefined if any part of the path is invalid.
 */
function getNestedProperty(obj: any, path: string[]): any {
 if (!obj || !path || path.length === 0) {
 return undefined;
 }
 let current = obj;
 for (const key of path) {
 if (current === null || typeof current !== 'object' || !(key in current)) {
 return undefined;
 }
 current = current[key];
 }
 return current;
}

/**
 * Resolves the input parameters for an action based on the step's input mapping and dependency outputs.
 */
export async function processRequest(userRequest: UserRequest): Promise<void> {
  try {
    const newRequest: UserRequest = {
      // id will be set by Firestore add
      ...userRequest,
      status: 'planning', // Change initial status to planning
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(), // Ensure timestamps are set
    };
    const docRef = await db.collection('requests').add(newRequest);
    console.log('Request saved to Firestore with ID:', docRef.id);

  } catch (error) {
    console.error('Error processing request:', error);
    // In a real system, you'd likely update the request status to 'failed' here
  }
}

/**
 * Resolves the input parameters for a step's action based on its input mapping and dependency outputs.
 * @param step The TaskStep being executed.
 * @param plan The full plan array from the UserRequest.
 * @returns An object containing the resolved action parameters.
 */
function resolveInputMapping(step: TaskStep, plan: TaskStep[]): { [key: string]: any } {
  const actionParams: { [key: string]: any } = {};

  if (!step.action.inputMapping) {
    // If no input mapping, return existing params or an empty object
    return step.action.params || {};
  }

  const dependencyOutputs: { [stepId: string]: any } = {};
  if (step.dependencies) {
    for (const depId of step.dependencies) {
      const dependentStep = plan.find(s => s.id === depId);
      // The trigger should prevent this, but defensive check is good
      if (dependentStep && dependentStep.state === 'completed' && dependentStep.output !== undefined) {
         dependencyOutputs[depId] = dependentStep.output;
      } else {
         console.warn(`Dependency ${depId} not found, not completed, or has no output for step ${step.id}. This might indicate a planning or trigger issue.`);
         // Decide how to handle missing dependencies in mapping - for now, the value will be undefined
      }
    }
  }

  // Apply input mapping
  for (const paramName in step.action.inputMapping) {
      const mapping = step.action.inputMapping[paramName];

      if (typeof mapping === 'string') {
          // Static value
          actionParams[paramName] = mapping;
      } else if (mapping.from && dependencyOutputs[mapping.from] !== undefined) {
          // Value from dependency output
          let value = dependencyOutputs[mapping.from];
          if (mapping.field !== undefined) { // Check if field is specified
              if (typeof mapping.field === 'string') {
                  // Single field
                  value = value[mapping.field];
              } else if (Array.isArray(mapping.field)) {
                  // Nested field path
                  value = getNestedProperty(value, mapping.field);
              } else {
                  console.warn(`Invalid field type in input mapping for parameter ${paramName} in step ${step.id}.`);
                  value = undefined; // Or handle as an error
              }
          }
          actionParams[paramName] = value;
      } else {
          console.warn(`Mapping for parameter ${paramName} could not be resolved (dependency not found or no output) for step ${step.id}.`);
          actionParams[paramName] = undefined; // Or handle as an error
      }
  }
export async function planTask(userRequest: UserRequest): Promise<void> {
  console.log(`Planning task for request ID: ${userRequest.id}`);

 try {
    let plan: TaskStep[] = [];

    // Simple parsing for the specific email request
    if (userRequest.prompt.toLowerCase().includes('send a test email to test@example.com')) {
      const emailStep: TaskStep = {
        // Generate a simple ID for the step
        id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        taskId: userRequest.id!, // Associate with the request ID (used as Task ID for simplicity now)
        requestId: userRequest.id!, // Add requestId
        description: 'Send a test email',
        state: 'pending',
        action: {
          type: 'sendEmail',
          emailDetails: {
            to: 'test@example.com',
            subject: 'Test',
            body: 'This is a test email.',
          },
        },
        createdAt: admin.firestore.Timestamp.now(), // Ensure timestamps are set for steps
        updatedAt: admin.firestore.Timestamp.now(),
        retries: 0,
      };
      plan.push(emailStep);
    } else {
      // Handle other requests or mark as unplannable for now
      console.warn(`Unrecognized request prompt for planning: ${userRequest.prompt}`);
      // For now, we'll create an empty plan and mark the request as failed
      await db.collection('requests').doc(userRequest.id!).update({
 status: 'failed',
           updatedAt: admin.firestore.Timestamp.now(),
           error: 'Could not plan task for this request prompt.',
       });
       return; // Stop execution if planning failed
    }

    // Update the request document with the generated plan
    await db.collection('requests').doc(userRequest.id!).update({
      plan: plan,
      status: 'executing', // Change status to executing after planning
      updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log(`Plan created and saved for request ID: ${userRequest.id}`);

  } catch (error) {
    console.error(`Error planning task for request ID ${userRequest.id}:`, error);
    await db.collection('requests').doc(userRequest.id!).update({
      status: 'failed',
      updatedAt: admin.firestore.Timestamp.now(),
      error: `Planning failed: ${error}`,
    });
  }
}

export async function executeStep(step: TaskStep, request: UserRequest): Promise<void> {
  console.log(`Executing step ${step.id} for request ${request.id}`);

  try {
    // Update step state to executing and add startedAt timestamp
    await db.collection('requests').doc(request.id!).update({
      plan: request.plan?.map(s => s.id === step.id ? { ...s, state: 'executing', startedAt: admin.firestore.Timestamp.now() } : s)
    });

    let stepResult: any = null;
    let stepError: string | undefined = undefined;

    // Resolve action parameters using input mapping and dependency outputs
    const actionParams = resolveInputMapping(step, request.plan || []);

    switch (step.action.type) {
      case 'sendEmail': { // Use a block for variable scoping
        console.log('Action: sendEmail');
        if (!step.action.emailDetails) {
          throw new Error('Email details are missing for sendEmail action.');
        }
        const mailOptions = {
          from: functions.config().email.sender_address || 'noreply@yourproject.com', // Use a configured sender address or a default
          to: actionParams.to || step.action.emailDetails.to, // Use mapped 'to' if available, otherwise fallback
          subject: actionParams.subject || step.action.emailDetails.subject, // Use mapped 'subject' if available, otherwise fallback
          text: step.action.emailDetails.body,
          // html: '<b>HTML body</b>' // Optional HTML body
        };
        try {
          const info = await transporter.sendMail(mailOptions);
          console.log('Email sent:', info.response);
          stepResult = { messageId: info.messageId, response: info.response };
        } catch (emailError: any) {
          console.error('Error sending email:', emailError);
          stepError = `Failed to send email: ${emailError.message}`;
          // Re-throw the error to be caught by the outer catch block
          throw new Error(stepError);
        }
        break;
      }
      case 'callFunction': {
        console.log('Action: callFunction');
        const functionName = step.action.functionName;
        if (!functionName) {
          throw new Error('functionName is missing for callFunction action.');
        }
        const internalFunction = internalFunctionRegistry[functionName];
        if (!internalFunction) {
          throw new Error(`Internal function "${functionName}" not found in registry.`);
        }
        try {
          stepResult = await internalFunction(actionParams); // Call the internal function with resolved params
        } catch (funcError: any) {
          stepError = `Error calling internal function "${functionName}": ${funcError.message}`;
          throw new Error(stepError); // Re-throw to be caught by outer block
        }
        break;
      }
      // Add cases for other action types (callFunction, updateFirestore, callApi) later
      default:
        throw new Error(`Unknown action type: ${step.action.type}`);
    } // End switch

    // Update step state to completed and add result/completedAt timestamp
     // Update the specific step within the plan array
     await db.collection('requests').doc(request.id!).update({
      plan: request.plan?.map(s => s.id === step.id ? { ...s, state: 'completed', result: stepResult, completedAt: admin.firestore.Timestamp.now() } : s)
    });

  } catch (error: any) {
    // Update step state to failed and add error/completedAt timestamp
    await db.collection('requests').doc(request.id!).update({
       // Update the specific step within the plan array
       plan: request.plan?.map(s => s.id === step.id ? { ...s, state: 'failed', error: error.message, completedAt: admin.firestore.Timestamp.now() } : s)
    });
    console.error(`Error executing step ${step.id} for request ${request.id}:`, error);
  }
}

export async function handleError(step: TaskStep, request: UserRequest): Promise<void> {
    console.log(`Handling error for step ${step.id} (state: ${step.state}, error: ${step.error}) for request ${request.id}`);

    const requestRef = db.collection('requests').doc(request.id!); // Get request reference
    // Note: We are updating the step directly via its path in the plan subcollection now
    const stepRef = requestRef.collection('plan').doc(step.id!); // Get step reference

    const maxRetries = 3; // Define a maximum number of retries
    const currentRetries = step.retries || 0;

    let newStepState: TaskStep['state'] = 'failed'; // Assume failed by default
    let updateRequestState: boolean = false;
    let newRequestState: UserRequest['status'] = request.status;

    if (step.error?.includes('Unknown functionName')) {
        // If the error is 'Unknown functionName', it's a permanent error, do not retry
        console.warn(`Step ${step.id} failed due to unknown function name. Marking as permanently failed.`);
        newStepState = 'failed'; // Explicitly mark as failed
        // No change to retries count needed here as it's not a retry scenario

         // If a required step fails permanently, mark the whole request as failed
         updateRequestState = true;
         newRequestState = 'failed';

    } else if (currentRetries < maxRetries) {
        // For other errors, if retries are available, set state back to pending
        console.log(`Attempting retry for step ${step.id}. Retry count: ${currentRetries + 1}`);
        newStepState = 'pending';
        await stepRef.update({
            retries: currentRetries + 1,
            error: null, // Clear the error for the retry attempt
            state: newStepState, // Update state
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return; // Exit the function early as step state is updated for retry
    } else {
        // If max retries reached for other errors, mark as failed
        console.error(`Step ${step.id} failed after ${maxRetries} retries. Marking as permanently failed.`);
        newStepState = 'failed';
         // If a required step fails permanently after retries, mark the whole request as failed
         updateRequestState = true;
         newRequestState = 'failed';
    }

    // Update the step state to the final state (failed if no retry)
     await stepRef.update({
        state: newStepState,
        // Note: Error and retries are already updated when setting state to 'pending' for retry
        updatedAt: admin.firestore.Timestamp.now(),
     });

    // If the request state needs to be updated (e.g., to failed)
    if (updateRequestState) {
        await requestRef.update({
            status: newRequestState,
            updatedAt: admin.firestore.Timestamp.now(),
            // Optionally add a top-level error message if the request fails
             error: `Task failed due to step ${step.description} failing: ${step.error}`
        });
         console.log(`Request ${request.id} marked as ${newRequestState}.`);
    }
}