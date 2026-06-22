import prisma from '../../database/client';
import { NotFoundError } from '../../utils/errors';
import config from '../../config';

export class StakingService {
  static getStakePayload(marketAddress: string, outcome: boolean, amount: string) {
    const method = outcome ? 'stakeYes' : 'stakeNo';
    return {
      contractAddress: marketAddress.toLowerCase(),
      method,
      args: [amount],
      description: `Stake ${amount} tokens on ${outcome ? 'YES' : 'NO'} outcome in market ${marketAddress}`,
    };
  }

  static async getUserPositions(walletAddress: string) {
    const wallet = walletAddress.toLowerCase();
    
    const user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
      include: {
        stakes: {
          include: {
            market: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const positions = user.stakes.map((stake) => {
      const amount = Number(stake.amount);
      const odds = Number(stake.oddsAtEntry);
      const estimatedPayout = amount * odds;

      return {
        id: stake.id,
        positionId: stake.positionId,
        marketId: stake.marketId,
        question: stake.market.question,
        marketAddress: stake.market.contractAddress,
        outcome: stake.outcome,
        amount: stake.amount.toString(),
        oddsAtEntry: odds.toString(),
        claimed: stake.claimed,
        marketResolved: stake.market.resolved,
        marketWinner: stake.market.winner,
        estimatedPayout: estimatedPayout.toString(),
      };
    });

    return positions;
  }
}
