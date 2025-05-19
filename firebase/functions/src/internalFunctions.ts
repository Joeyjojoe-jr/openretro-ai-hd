import * as functions from 'firebase-functions';

// This is a mock internal function to simulate fetching data.
export async function simulateDataFetch(params: { [key: string]: any }): Promise<any> {
  console.log('Simulating data fetch with parameters:', params);

  // Simulate an asynchronous data fetching operation
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second

  // Return mock data
  const mockData = {
    success: true,
    data: {
      items: ['simulated_item_1', 'simulated_item_2'],
      parameters_received: params,
      timestamp: new Date().toISOString()
    }
  };

  console.log('Simulated data fetch completed, returning mock data:', mockData);
  return mockData;
}

// This is a mock internal function to simulate generating a user summary.
export async function generateUserSummary(params: { userId: string, [key: string]: any }): Promise<{ summary: string }> {
  console.log('Simulating user summary generation for userId:', params.userId, 'with parameters:', params);

  // Simulate an asynchronous operation
  await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for 1.5 seconds

  const summary = `Mock weekly summary for user ${params.userId}. Total activities: 50. Recent logins: 7.`;

  console.log('Simulated user summary generation completed.');
  return { summary };
}

// This is a mock internal function to simulate checking login activity.
export async function checkLoginActivity(params: { userId: string, [key: string]: any }): Promise<{ anomalies: { userId: string, activity: string }[] }> {
  console.log('Simulating login activity check for userId:', params.userId, 'with parameters:', params);

  // Simulate an asynchronous operation
  await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for 1.2 seconds

  // Simulate finding an anomaly occasionally, or based on params if desired
  const anomalies = Math.random() > 0.7 ? [{ userId: params.userId, activity: 'Unusual login location detected.' }] : [];

  console.log('Simulated login activity check completed.');
  return { anomalies };
}


// This is a mock internal function to simulate generating a user summary.
export async function generateUserSummary(params: { userId: string, [key: string]: any }): Promise<{ summary: string }> {
  console.log('Simulating user summary generation for userId:', params.userId, 'with parameters:', params);

  // Simulate an asynchronous operation
  await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for 1.5 seconds

  const summary = `Mock weekly summary for user ${params.userId}. Total activities: 50. Recent logins: 7.`;

  console.log('Simulated user summary generation completed.');
  return { summary };
}

// This is a mock internal function to simulate checking login activity.
export async function checkLoginActivity(params: { userId: string, [key: string]: any }): Promise<{ anomalies: { userId: string, activity: string }[] }> {
  console.log('Simulating login activity check for userId:', params.userId, 'with parameters:', params);

  // Simulate an asynchronous operation
  await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for 1.2 seconds

  console.log('Simulated login activity check completed.');
  return { anomalies: [] }; // Return empty anomalies for simplicity in mock
}
}