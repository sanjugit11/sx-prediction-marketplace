import prisma from '../../database/client';
import { NotFoundError } from '../../utils/errors';
import config from '../../config';

export class ResolutionService {
  static async getResolvePayload(idOrAddress: string, winner: boolean) {
    const market = await prisma.market.findFirst({
      where: {
        OR: [
          { id: idOrAddress },
          { contractAddress: idOrAddress.toLowerCase() },
        ],
      },
    });

    if (!market) {
      throw new NotFoundError('Market not found');
    }

    return {
      contractAddress: config.RESOLUTION_MANAGER_ADDRESS,
      method: 'resolveMarket',
      args: [market.contractAddress, winner],
      description: `Resolve market "${market.question}" with winner: ${winner ? 'YES' : 'NO'}.`,
    };
  }

  static async getClaimPayload(idOrAddress: string, positionId: number) {
    const market = await prisma.market.findFirst({
      where: {
        OR: [
          { id: idOrAddress },
          { contractAddress: idOrAddress.toLowerCase() },
        ],
      },
    });

    if (!market) {
      throw new NotFoundError('Market not found');
    }

    return {
      contractAddress: config.RESOLUTION_MANAGER_ADDRESS,
      method: 'claimPayout',
      args: [market.contractAddress, positionId],
      description: `Claim payout for position ${positionId} in market "${market.question}"`,
    };
  }
}
