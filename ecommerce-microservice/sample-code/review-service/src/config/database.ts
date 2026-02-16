import mongoose from 'mongoose';
import logger from '../utils/logger';

export async function connectMongoDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/reviews';

  try {
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}