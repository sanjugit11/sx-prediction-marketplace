import { Worker, Job } from 'bullmq';
import prisma from '../database/client';
import { redisConnection } from './queue.setup';
import logger from '../utils/logger';

export const leaderboardWorker = new Worker(
  'leaderboard-update',
  async (job: Job) => {
    logger.info('Running leaderboard calculation...');

    // Fetch all users
    const users = await prisma.user.findMany({
      include: {
        stakes: {
          include: {
            market: true,
          },
        },
      },
    });

    const leaderboardEntries: any[] = [];

    for (const user of users) {
      const stakes = user.stakes;
      const totalPredictions = stakes.length;

      // Filter stakes that are in resolved markets
      const resolvedStakes = stakes.filter((s) => s.market.resolved);
      const correctPredictions = resolvedStakes.filter(
        (s) => s.outcome === s.market.winner
      ).length;

      // Calculate accuracy
      const accuracy = totalPredictions >= 1
        ? (correctPredictions * 100) / totalPredictions
        : 0;

      // Calculate total volume
      const volume = stakes.reduce((acc, stake) => acc + Number(stake.amount), 0);

      // Include any user with at least 1 prediction
      if (totalPredictions >= 1) {
        leaderboardEntries.push({
          wallet: user.walletAddress,
          accuracy,
          totalPredictions,
          correctPredictions,
          volume,
          rewardAmount: 0, // calculated later during distribution
        });
      }
    }

    // Sort: Accuracy DESC, Volume DESC, Predictions DESC
    leaderboardEntries.sort((a, b) => {
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      if (b.volume !== a.volume) {
        return b.volume - a.volume;
      }
      return b.totalPredictions - a.totalPredictions;
    });

    // Save rankings
    await prisma.$transaction(async (tx) => {
      // Clear current snapshots
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      await tx.leaderboardSnapshot.deleteMany({
        where: {
          snapshotDate: {
            gte: todayStart,
          },
        },
      });

      // Insert new rank entries
      for (let i = 0; i < leaderboardEntries.length; i++) {
        const entry = leaderboardEntries[i];
        await tx.leaderboardSnapshot.create({
          data: {
            wallet: entry.wallet,
            rank: i + 1,
            accuracy: entry.accuracy,
            totalPredictions: entry.totalPredictions,
            correctPredictions: entry.correctPredictions,
            volume: entry.volume,
            rewardAmount: entry.rewardAmount,
            snapshotDate: new Date(),
          },
        });
      }
    });

    logger.info(`Leaderboard update finished. Ranked ${leaderboardEntries.length} users.`);
  },
  { connection: redisConnection as any }
);

leaderboardWorker.on('completed', () => {
  logger.info('Leaderboard calculation job completed');
});

leaderboardWorker.on('failed', (job, err) => {
  logger.error('Leaderboard calculation job failed:', err);
});
