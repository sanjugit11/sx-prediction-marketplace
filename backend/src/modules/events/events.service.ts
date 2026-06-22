import prisma from '../../database/client';
import { NotFoundError } from '../../utils/errors';

export class EventsService {
  static async queryEvents(filters: {
    eventName?: string;
    market?: string;
    wallet?: string;
    chainId?: number;
  }) {
    const whereClause: any = {};

    if (filters.eventName) {
      whereClause.eventName = filters.eventName;
    }
    
    if (filters.chainId) {
      whereClause.chainId = filters.chainId;
    }

    if (filters.market) {
      whereClause.contractAddress = filters.market.toLowerCase();
    }

    if (filters.wallet) {
      const walletLower = filters.wallet.toLowerCase();
      // Match if the event details contain the wallet address
      whereClause.eventData = {
        path: ['user'],
        equals: walletLower,
      };
    }

    return prisma.event.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: 100, // limit to latest 100 events
    });
  }

  static async getEventByTxHash(chainId: number, txHash: string) {
    const event = await prisma.event.findFirst({
      where: {
        chainId,
        transactionHash: txHash,
      },
    });

    if (!event) {
      throw new NotFoundError('Event transaction not found');
    }

    return event;
  }
}
