import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

export async function simulateDataFetch(params: { [key: string]: any }): Promise<any> {
  console.log('Simulating data fetch with parameters:', params);
  await new Promise(resolve => setTimeout(resolve, 1000));
  const mockData = {
    success: true,
    data: {
      items: ['simulated_item_A', 'simulated_item_B'],
      parameters_received: params,
      timestamp: new Date().toISOString(),
    }
  };
  console.log('Simulated data fetch completed:', mockData);
  return mockData;
}

export async function generateUserSummary(params: { userId: string, [key: string]: any }): Promise<{ summary: string }> {
  console.log('Generating user summary for:', params.userId);
  const summary = `Weekly summary for user ${params.userId}:\n- Total actions: 150\n- Recent logins: 10\n- Last activity: 2 days ago`;
  return { summary };
}

export async function checkLoginActivity(params: { userId: string, [key: string]: any }): Promise<{ anomalies: { userId: string, activity: string, timestamp: string }[] }> {
  console.log('Checking login activity for:', params.userId);
  const anomalies: { userId: string, activity: string, timestamp: string }[] = [];
  if (Math.random() > 0.6) {
    anomalies.push({
      userId: params.userId,
      activity: 'Login from unusual location detected.',
      timestamp: new Date().toISOString()
    });
  }
  return { anomalies };
}

export async function sendEmail(params: { to: string, subject: string, body: string, [key: string]: any }): Promise<{ status: string }> {
  console.log('Sending email to:', params.to);
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(`Email sent to ${params.to} with subject: "${params.subject}"`);
  return { status: "sent" };
}

export { simulateDataFetch, generateUserSummary, checkLoginActivity, sendEmail };
