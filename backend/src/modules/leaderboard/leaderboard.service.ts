import prisma from '../../database/client';
import config from '../../config';
import { BadRequestError } from '../../utils/errors';

export class LeaderboardService {
  static async getLeaderboard() {
    // Get the latest snapshot entries
    const latestSnapshot = await prisma.leaderboardSnapshot.findFirst({
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    });

    if (latestSnapshot) {
      return prisma.leaderboardSnapshot.findMany({
        where: {
          snapshotDate: latestSnapshot.snapshotDate,
        },
        orderBy: {
          rank: 'asc',
        },
      });
    }

    // No snapshot exists — compute live from stakes
    const users = await prisma.user.findMany({
      include: {
        stakes: {
          include: { market: true },
        },
      },
    });

    const entries: any[] = [];
    for (const user of users) {
      if (user.stakes.length === 0) continue;
      const totalPredictions = user.stakes.length;
      const resolvedStakes = user.stakes.filter(s => s.market.resolved);
      const correctPredictions = resolvedStakes.filter(s => s.outcome === s.market.winner).length;
      const accuracy = resolvedStakes.length > 0
        ? (correctPredictions * 100) / resolvedStakes.length
        : 0;
      const volume = user.stakes.reduce((acc, s) => acc + Number(s.amount), 0);

      entries.push({
        wallet: user.walletAddress,
        rank: 0,
        accuracy: Number(accuracy.toFixed(2)),
        totalPredictions,
        correctPredictions,
        volume: volume.toString(),
        rewardAmount: '0',
        snapshotDate: new Date(),
      });
    }

    entries.sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (Number(b.volume) !== Number(a.volume)) return Number(b.volume) - Number(a.volume);
      return b.totalPredictions - a.totalPredictions;
    });

    entries.forEach((e, i) => { e.rank = i + 1; });
    return entries;
  }

  static getDistributePayload(tokenAddress: string = config.USDC_ADDRESS, totalPool: string, topUsers: string[]) {
    if (topUsers.length === 0 || topUsers.length > 10) {
      throw new BadRequestError('Must distribute to between 1 and 10 users');
    }
    
    return {
      contractAddress: config.LEADERBOARD_ADDRESS,
      method: 'distributeRewards',
      args: [tokenAddress, totalPool, topUsers.map(u => u.toLowerCase())],
      description: `Distribute a reward pool of ${totalPool} tokens to top ${topUsers.length} users`,
    };
  }

  static getClaimRewardPayload(tokenAddress: string = config.USDC_ADDRESS) {
    return {
      contractAddress: config.LEADERBOARD_ADDRESS,
      method: 'claimReward',
      args: [tokenAddress],
      description: `Claim tournament rewards from Leaderboard contract`,
    };
  }
}
