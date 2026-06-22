import { Worker, Job } from 'bullmq';
import prisma from '../database/client';
import { redisConnection } from './queue.setup';
import logger from '../utils/logger';

interface RewardJobData {
  token: string;
  totalPool: string; // BigInt representation in string
  topUsers: string[];
}

export const rewardWorker = new Worker(
  'reward-distribution',
  async (job: Job<RewardJobData>) => {
    const { token, totalPool, topUsers } = job.data;
    logger.info(`Processing reward distribution of ${totalPool} for ${topUsers.length} users`);

    const poolVal = Number(totalPool);

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < topUsers.length; i++) {
        const userWallet = topUsers[i].toLowerCase();
        
        let rewardAmount = 0;
        if (i === 0) {
          rewardAmount = (poolVal * 20) / 100; // 20%
        } else if (i === 1) {
          rewardAmount = (poolVal * 15) / 100; // 15%
        } else if (i === 2) {
          rewardAmount = (poolVal * 10) / 100; // 10%
        } else {
          rewardAmount = (poolVal * 5) / 100;  // 5%
        }

        // Update the user's snapshot reward amount
        const latestSnapshot = await tx.leaderboardSnapshot.findFirst({
          where: {
            wallet: userWallet,
          },
          orderBy: {
            snapshotDate: 'desc',
          },
        });

        if (latestSnapshot) {
          await tx.leaderboardSnapshot.update({
            where: { id: latestSnapshot.id },
            data: {
              rewardAmount: (Number(latestSnapshot.rewardAmount) + rewardAmount).toString(),
            },
          });
        }
      }
    });

    logger.info('Reward distribution processed successfully.');
  },
  { connection: redisConnection as any }
);

rewardWorker.on('completed', () => {
  logger.info('Reward distribution job completed');
});

rewardWorker.on('failed', (job, err) => {
  logger.error('Reward distribution job failed:', err);
});
