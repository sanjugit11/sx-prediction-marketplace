import prisma from '../../database/client';
import config from '../../config';
import { NotFoundError, BadRequestError } from '../../utils/errors';

export class MarketplaceService {
  static async listListings(status: string = 'ACTIVE') {
    return prisma.marketplaceListing.findMany({
      where: {
        status,
      },
      include: {
        stake: {
          include: {
            market: true,
          },
        },
        seller: {
          select: { id: true, walletAddress: true },
        },
        buyer: {
          select: { id: true, walletAddress: true },
        },
      },
    });
  }

  static getListPayload(marketAddress: string, positionId: number, price: string) {
    return {
      contractAddress: config.MARKETPLACE_ADDRESS,
      method: 'listPosition',
      args: [marketAddress.toLowerCase(), positionId, price],
      description: `List position ${positionId} from market ${marketAddress} for ${price} tokens`,
    };
  }

  static getBuyPayload(listingId: number) {
    return {
      contractAddress: config.MARKETPLACE_ADDRESS,
      method: 'buyPosition',
      args: [listingId],
      description: `Purchase position listing ${listingId}`,
    };
  }

  static getCancelPayload(listingId: number) {
    return {
      contractAddress: config.MARKETPLACE_ADDRESS,
      method: 'cancelListing',
      args: [listingId],
      description: `Cancel position listing ${listingId}`,
    };
  }
}
