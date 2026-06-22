import prisma from '../../database/client';

export class StatsService {
  static async getPlatformStats() {
    const [marketsCount, usersCount, stakesCount, volumeAggregate, rewardsAggregate] = await Promise.all([
      prisma.market.count(),
      prisma.user.count(),
      prisma.stake.count(),
      prisma.stake.aggregate({
        _sum: {
          amount: true,
        },
      }),
      prisma.leaderboardSnapshot.aggregate({
        _sum: {
          rewardAmount: true,
        },
      }),
    ]);

    return {
      markets: marketsCount,
      users: usersCount,
      stakes: stakesCount,
      volume: volumeAggregate._sum.amount ? volumeAggregate._sum.amount.toString() : '0',
      rewards: rewardsAggregate._sum.rewardAmount ? rewardsAggregate._sum.rewardAmount.toString() : '0',
    };
  }
}
