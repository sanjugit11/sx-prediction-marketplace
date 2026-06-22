import prisma from '../../database/client';
import BlockchainService from '../../blockchain/blockchain.service';
import config from '../../config';
import { NotFoundError } from '../../utils/errors';

export class MarketsService {
  static async listMarkets(resolved?: boolean) {
    const whereClause: any = {};
    if (resolved !== undefined) {
      whereClause.resolved = resolved;
    }
    
    return prisma.market.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { stakes: true },
        },
      },
    });
  }

  static async getMarketById(idOrAddress: string, chainId: number = config.HOODI_CHAIN_ID) {
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

    // Retrieve live info from the blockchain contract
    try {
      const liveDetails = await BlockchainService.MarketService.getMarketDetails(
        market.contractAddress,
        chainId
      );
      return {
        ...market,
        yesPool: liveDetails.yesPool.toString(),
        noPool: liveDetails.noPool.toString(),
        totalPool: liveDetails.totalPool.toString(),
        liveOddsYes: (Number(await BlockchainService.MarketService.getOdds(market.contractAddress, true, chainId)) / 1e18).toString(),
        liveOddsNo: (Number(await BlockchainService.MarketService.getOdds(market.contractAddress, false, chainId)) / 1e18).toString(),
      };
    } catch (err) {
      // Fallback if blockchain RPC is down/mocked
      return market;
    }
  }

  static getCreatePayload(question: string, endTime: number, minimumStake: string, tokenAddress: string = config.USDC_ADDRESS) {
    return {
      contractAddress: config.FACTORY_ADDRESS,
      method: 'createMarket',
      args: [question, endTime, minimumStake, tokenAddress],
      description: `Create prediction market: "${question}" expiring at ${new Date(endTime * 1000).toISOString()}`,
    };
  }

  static async getOdds(idOrAddress: string, chainId: number = config.HOODI_CHAIN_ID) {
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

    try {
      const oddsYes = await BlockchainService.MarketService.getOdds(market.contractAddress, true, chainId);
      const oddsNo = await BlockchainService.MarketService.getOdds(market.contractAddress, false, chainId);
      return {
        yes: (Number(oddsYes) / 1e18).toString(),
        no: (Number(oddsNo) / 1e18).toString(),
      };
    } catch (err) {
      return { yes: '2.0', no: '2.0' }; // Default default odds
    }
  }

  static async getStakesByMarketAddress(contractAddress: string) {
    const market = await prisma.market.findUnique({
      where: { contractAddress: contractAddress.toLowerCase() },
    });

    if (!market) {
      throw new NotFoundError('Market not found');
    }

    return prisma.stake.findMany({
      where: { marketId: market.id },
      include: {
        user: {
          select: { id: true, walletAddress: true },
        },
      },
    });
  }
}
