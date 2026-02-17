import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  redisClient = createClient({ url: redisUrl });

  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  redisClient.on('connect', () => logger.info('Connected to Redis'));
  redisClient.on('ready', () => logger.info('Redis client ready'));
  redisClient.on('end', () => logger.info('Redis connection ended'));

  await redisClient.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}