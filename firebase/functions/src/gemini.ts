import * as functions from 'firebase-functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskStep } from './agent'; // Import TaskStep interface

// Initialize the Generative AI client
// Ensure you have GOOGLE_API_KEY configured in your environment variables
const genAI = new GoogleGenerativeAI(functions.config().google.api_key);

export const generatePlanWithGemini = functions.https.onCall(async (data, context) => {
  // Optional: Authenticate the user if needed
  // if (!context.auth) {
  //   throw new functions.https.HttpsError(
  //     'unauthenticated',
  //     'The function must be called while authenticated.'
  //   );
  // }

  const prompt: string = data.prompt;
  if (!prompt) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The "prompt" parameter is required.'
    );
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Use the appropriate model

    // Define the available tools/functions for the model
    const availableFunctions = [
        {
            name: "sendEmail",
            description: "Sends an email to a specified recipient.",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string", description: "The email address of the recipient." },
                    subject: { type: "string", description: "The subject of the email." },
                    body: { type: "string", description: "The body content of the email." }
                },
                required: ["to", "subject", "body"]
            }
        },
        {
            name: "generateUserSummary",
            description: "Generates a weekly user summary.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The ID of the user." }
                    // Add other potential parameters like date range here if needed
                },
                required: ["userId"]
            },
            output: { type: "object", properties: { summary: { type: "string" } } } // Mock output structure
        },
        {
            name: "checkLoginActivity",
            description: "Checks for unusual login activity for a user.",
            parameters: {
                 type: "object",
                 properties: { userId: { type: "string", description: "The ID of the user." } },
                 required: ["userId"]
            },
            output: { type: "object", properties: { anomalies: { type: "array", items: { type: "object" } } } } // Mock output structure
        }
        // Add descriptions for other available functions here
    ];


    const result = await model.generateContent(`
      You are an AI agent responsible for planning tasks based on user requests.
      Given the following user request, generate a JSON array of TaskStep objects
      that represents the plan to fulfill the request.
      The TaskStep objects should adhere to the following TypeScript interface (output as JSON):

      interface TaskStep {
        id: string; // Unique step ID (placeholder, will be generated later)
        description: string; // Natural language description of the step
        action: {
          type: 'callFunction' | 'updateFirestore' | 'sendEmail' | 'callApi';
          functionName?: string; // Required if type is 'callFunction'
          apiEndpoint?: string; // Required if type is 'callApi'
          firestorePath?: string; // Required if type is 'updateFirestore'
          updates?: { [key: string]: any }; // Required if type is 'updateFirestore'
          emailDetails?: { // Required if type is 'sendEmail'
            to: string;
            subject: string;
            body: string;
          };
          params?: { [key: string]: any }; // Optional parameters for 'callFunction' or 'callApi'
          // ... other action-specific details
        };
        state: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'; // Should always be 'pending' initially
        result?: any;
        error?: any;
        startedAt?: string; // Use string for timestamp in JSON
        completedAt?: string; // Use string for timestamp in JSON
        retries?: number; // Should always be 0 initially
      }

      Here are the available actions and functions you can use:
      - action.type: 'sendEmail' - Requires emailDetails.
      - action.type: 'callFunction' - Requires functionName and optionally params. Available function names: ${availableFunctions.filter(f => f.name !== 'sendEmail').map(f => f.name).join(', ')}
      - The output of a completed step can be used as input for a subsequent step by specifying 'dependencies' and 'inputMapping'.
      - inputMapping structure: { [actionParamName: string]: string | { from: string, field?: string | string[] } }
      - 'from': The ID of the dependency step.
      - 'field': Optional. Key from the dependency output. Can be string or string array for nested access.

      Example Request: "Create a weekly user summary, check for unusual login activity, and email me a report for user user123@example.com"
      Example Plan for the above request (demonstrating callFunction, dependencies, and inputMapping):
      [
        {
          "id": "step-summary",
          "description": "Generate weekly user summary for user123@example.com",
          "action": {
            "type": "callFunction",
            "functionName": "generateUserSummary",
            "params": { "userId": "user123@example.com" }
          },
          "state": "pending",
          "retries": 0
        },
        {
          "id": "step-login-check",
          "description": "Analyze login activity for anomalies for user123@example.com",
          "action": {
            "type": "callFunction",
            "functionName": "checkLoginActivity",
            "params": { "userId": "user123@example.com" }
          },
          "state": "pending",
          "retries": 0
        },
        {
          "id": "step-email-report",
          "description": "Compile and email report to user123@example.com",
          "action": { "type": "sendEmail", "emailDetails": {} },
          "state": "pending",
          "dependencies": ["step-summary", "step-login-check"],
          "inputMapping": { "to": "user123@example.com", "subject": "Weekly User Activity Report", "body": { "from": "step-summary", "field": "summary" }, "anomalies_data": { "from": "step-login-check", "field": "anomalies" } } // Mapping summary to body, anomalies to anomalies_data
        }
      ]

      Ensure the output is a valid JSON array of TaskStep objects.
      Do not include any other text in the response.

      Infer the user's email address from the prompt if possible, otherwise use a placeholder or default.
      User Request: "${prompt}"

    `);

    const response = result.response;
    const text = response.text();

    console.log("Gemini Output:", text); // Log Gemini's raw output for debugging

    // Attempt to parse the JSON output from the model
    let plan: TaskStep[] = [];
    try {
      plan = JSON.parse(text);
    } catch (parseError) {
       console.error("Failed to parse Gemini JSON output:", parseError);
        throw new functions.https.HttpsError(
            'internal',
            'Gemini model returned invalid JSON.',
             parseError
          );
    }


    // Basic validation of the generated plan structure
    if (!Array.isArray(plan) || plan.some(step => typeof step.description !== 'string' || typeof step.action?.type !== 'string')) {
         throw new functions.https.HttpsError(
            'internal',
            'Gemini model returned an invalid plan structure or missing action type.'
          );
    }

     // Further validation for callFunction type
     const invalidCallFunctionSteps = plan.filter(step =>
         step.action.type === 'callFunction' && typeof step.action.functionName !== 'string'
     );
     if(invalidCallFunctionSteps.length > 0){
         console.error("Gemini model generated callFunction steps without functionName:", invalidCallFunctionSteps);
          throw new functions.https.HttpsError(
            'internal',
            'Gemini model generated callFunction steps without specifying functionName.'
          );
     }


    return { plan: plan };

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error generating plan with Gemini.',
      error
    );
  }
});