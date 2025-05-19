import { runPlanLocally } from './runPlanLocally';

const samplePlan = [
  {
    id: 'step1',
    taskId: 't1',
    requestId: 'r1',
    description: 'Generate Summary',
    state: 'pending',
    action: {
      type: 'callFunction',
      functionName: 'generateUserSummary',
      params: { userId: 'u123' },
    },
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
  },
  {
    id: 'step2',
    taskId: 't1',
    requestId: 'r1',
    description: 'Check Login',
    state: 'pending',
    dependencies: ['step1'],
    action: {
      type: 'callFunction',
      functionName: 'checkLoginActivity',
      params: { userId: 'u123' },
    },
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
  },
  {
    id: 'step3',
    taskId: 't1',
    requestId: 'r1',
    description: 'Email Report',
    state: 'pending',
    dependencies: ['step1', 'step2'],
    action: {
      type: 'sendEmail',
      inputMapping: {
        to: 'admin@example.com',
        subject: 'Weekly Report',
        body: { from: 'step1', field: 'summary' },
      },
    },
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
  },
];

runPlanLocally(samplePlan);
