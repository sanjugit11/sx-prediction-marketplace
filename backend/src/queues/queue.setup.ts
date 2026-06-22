import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

redisConnection.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

export const eventProcessingQueue = new Queue('event-processing', { connection: redisConnection as any });
export const leaderboardUpdateQueue = new Queue('leaderboard-update', { connection: redisConnection as any });
export const rewardDistributionQueue = new Queue('reward-distribution', { connection: redisConnection as any });
export const reorgRecoveryQueue = new Queue('reorg-recovery', { connection: redisConnection as any });

export { redisConnection };
