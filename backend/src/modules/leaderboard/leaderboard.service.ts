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

    if (!latestSnapshot) {
      return [];
    }

    return prisma.leaderboardSnapshot.findMany({
      where: {
        snapshotDate: latestSnapshot.snapshotDate,
      },
      orderBy: {
        rank: 'asc',
      },
    });
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
