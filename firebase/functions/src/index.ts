import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { processRequest, executeStep, UserRequest, TaskStep } from './agent'; // Import necessary functions and interfaces from agent.ts

admin.initializeApp();

const db = admin.firestore();


/**
 * HTTP trigger function to receive and store user requests.
 */
export const receiveUserRequest = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Assuming the request body contains the user ID and the request string
    const { userId, prompt } = req.body;

    if (!userId || !prompt) {
      return res.status(400).send('Missing userId or prompt in body');
    }

    // Create a UserRequest object with the correct interface
    const newUserRequest: UserRequest = {
      id: db.collection('requests').doc().id, // Generate a new ID
      userId: userId,
      prompt: prompt,
      timestamp: admin.firestore.Timestamp.now(),
      state: 'received', // Use 'received' state as defined in agent.ts
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    // Call the processRequest function from agent.ts
    await processRequest(newUserRequest);

    res.status(200).send({ id: newUserRequest.id, message: 'Request received and processing started.' });

  } catch (error) {
    console.error('Error receiving user request:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Firestore trigger to execute a task step when its state changes to 'pending'.
 */
export const executeStepTrigger = functions.firestore.document('requests/{requestId}/plan/{stepId}')
  .onUpdate(async (change, context) => {
    const stepBefore = change.before.data() as TaskStep;
    const stepAfter = change.after.data() as TaskStep;
    const requestId = context.params.requestId;
    const stepId = context.params.stepId;

    // Check if the state has changed to 'pending'
    if (stepBefore.state !== 'pending' && stepAfter.state === 'pending') {
      console.log(`Executing step ${stepId} for request ${requestId}`);

      try {
        // Retrieve the parent UserRequest document
        const requestDoc = await db.collection('requests').doc(requestId).get();
        const userRequest = requestDoc.data() as UserRequest;
        
        if (!userRequest) {
            console.error(`Request document ${requestId} not found for step ${stepId}. Skipping execution.`);
            return null;
        }

        // Check for dependencies
        if (stepAfter.dependencies && stepAfter.dependencies.length > 0) {
            const plan = userRequest.plan || [];
            const allDependenciesMet = stepAfter.dependencies.every(depId => {
                const dependentStep = plan.find(s => s.id === depId);
                return dependentStep && dependentStep.state === 'completed';
            });

            if (!allDependenciesMet) {
                console.log(`Dependencies for step ${stepId} not met. Skipping execution for now.`);
                return null; // Exit the trigger if dependencies are not met
            }
        }

        await executeStep(stepAfter, userRequest); // Execute the step if dependencies are met or non-existent
      } catch (error) {
        console.error(`Error executing step ${stepId} for request ${requestId}:`, error);
      }
    }
  });


/**
 * Firestore trigger to plan a task when a new request is created.
 */
export const planTaskTrigger = functions.firestore.document('requests/{requestId}')
    .onCreate(async (snapshot, context) => {
        const userRequest = snapshot.data() as UserRequest;
        // Check if the request already has a plan (e.g., from manual creation)
        if (userRequest && !userRequest.plan) {
             // Assuming planTask is exported from agent.ts
             // Need to import planTask from agent.ts if it's not already
            try {
                 const { planTask } = require('./agent'); // Dynamic import to avoid circular dependency if agent imports index
                 await planTask(userRequest);
            } catch (error) {
                 console.error(`Error triggering planTask for request ${userRequest.id}:`, error);
                 // Consider marking the request as failed if planning fails
                  await db.collection('requests').doc(userRequest.id).update({
                      state: 'failed',
                      updatedAt: admin.firestore.Timestamp.now(),
                      error: { message: 'Automated planning failed', details: error.toString() }
                 });
            }
        }
        return null;
    });


// Re-export other functions if necessary
// export { generatePlanWithGemini } from './gemini';
// export { handleErrorTrigger } from './index'; // If handleErrorTrigger is defined in index.ts