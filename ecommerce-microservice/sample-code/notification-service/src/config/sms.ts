import logger from '../utils/logger';

export async function sendSMS(to: string, message: string): Promise<void> {
  // Mock SMS sending - in production, integrate with Twilio, AWS SNS, etc.
  logger.info('SMS sent (mock)', { to, message });

  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 100));
}