// runPlanLocally.ts

import { TaskStep } from './agent';

// === MOCK INTERNAL FUNCTIONS ===

const internalFunctionRegistry: { [key: string]: (params: any) => Promise<any> } = {
  async generateUserSummary(params: { userId: string }): Promise<{ summary: string }> {
    console.log('Mock generateUserSummary:', params);
    await new Promise(res => setTimeout(res, 100));
    return { summary: `Weekly summary for user ${params.userId}` };
  },

  async checkLoginActivity(params: { userId: string }): Promise<{ anomalies: any[] }> {
    console.log('Mock checkLoginActivity:', params);
    await new Promise(res => setTimeout(res, 50));
    return { anomalies: Math.random() > 0.5 ? [{ alert: 'Odd login' }] : [] };
  },

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<{ status: string }> {
    console.log('Mock sendEmail:');
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`Body: ${params.body}`);
    await new Promise(res => setTimeout(res, 200));
    return { status: 'sent' };
  },
};

// === HELPERS ===

function getNestedProperty(obj: any, path: string[]): any {
  if (!obj || !path) return undefined;
  return path.reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function resolveInputMapping(step: TaskStep, completedSteps: { [id: string]: TaskStep }): { [key: string]: any } {
  const actionParams: { [key: string]: any } = {};

  if (!step.action.inputMapping) return step.action.params || {};

  for (const param in step.action.inputMapping) {
    const map = step.action.inputMapping[param];

    if (typeof map === 'string') {
      actionParams[param] = map;
    } else if (map.from) {
      const dep = completedSteps[map.from];
      if (!dep || dep.state !== 'completed' || !dep.output) {
        throw new Error(`Dependency "${map.from}" not resolved for "${param}" in step "${step.id}"`);
      }

      let value = dep.output;
      if (map.field) {
        value = Array.isArray(map.field)
          ? getNestedProperty(value, map.field)
          : value[map.field];
        if (value === undefined) throw new Error(`Field "${map.field}" not found in output of ${map.from}`);
      }
      actionParams[param] = value;
    }
  }

  return { ...step.action.params, ...actionParams };
}

// === MAIN STEP EXECUTOR ===

async function executeStep(step: TaskStep, completedSteps: { [id: string]: TaskStep }): Promise<TaskStep> {
  console.log(`--- Executing ${step.id}: ${step.description}`);
  const updated: TaskStep = { ...step, state: 'executing' };

  try {
    const params = resolveInputMapping(step, completedSteps);
    console.log(`Resolved Params:`, params);

    let result: any;

    switch (step.action.type) {
      case 'callFunction':
        const fn1 = internalFunctionRegistry[step.action.functionName!];
        if (!fn1) throw new Error(`Function ${step.action.functionName} not in registry`);
        result = await fn1(params);
        break;

      case 'sendEmail':
        const fn2 = internalFunctionRegistry.sendEmail;
        result = await fn2(params);
        break;

      default:
        throw new Error(`Unknown action type: ${step.action.type}`);
    }

    return {
      ...updated,
      state: 'completed',
      output: result,
      result,
      completedAt: new Date() as any,
    };
  } catch (err: any) {
    console.error(`Step ${step.id} failed: ${err.message}`);
    return {
      ...updated,
      state: 'failed',
      error: err.message,
      completedAt: new Date() as any,
    };
  }
}

// === RUN FULL PLAN LOCALLY ===

export async function runPlanLocally(plan: TaskStep[]) {
  console.log(`=== Starting local plan execution ===`);
  const completed: { [id: string]: TaskStep } = {};
  const pending = [...plan];

  while (pending.length > 0) {
    const next = pending.find(step =>
      step.state === 'pending' &&
      (step.dependencies || []).every(dep => completed[dep])
    );

    if (!next) break;

    const updatedStep = await executeStep(next, completed);
    completed[updatedStep.id!] = updatedStep;
    const idx = plan.findIndex(s => s.id === updatedStep.id);
    plan[idx] = updatedStep;
  }

  console.log(`\n✅ Plan Execution Complete:`);
  plan.forEach(step => {
    console.log(`- ${step.id}: ${step.state} ${step.error ? `❌ (${step.error})` : '✅'}`);
  });
}
