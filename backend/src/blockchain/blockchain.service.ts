import { ethers } from 'ethers';
import config from '../config';
import {
  SXUA_ABI,
  FACTORY_ABI,
  PREDICTION_MARKET_ABI,
  LEADERBOARD_ABI,
  RESOLUTION_MANAGER_ABI,
  MARKETPLACE_ABI,
} from './abis';
import logger from '../utils/logger';

// Retry helper
export async function retryCall<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      logger.error('Blockchain RPC call failed after all retries');
      throw error;
    }
    logger.warn(`RPC call failed, retrying in ${delay}ms... (Retries left: ${retries})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryCall(fn, retries - 1, delay * 2);
  }
}

export class BlockchainService {
  private static providers: { [chainId: number]: ethers.JsonRpcProvider } = {};

  static getProvider(chainId: number): ethers.JsonRpcProvider {
    if (!this.providers[chainId]) {
      const rpcUrl =
        chainId === config.HOODI_CHAIN_ID
          ? config.HOODI_RPC_URL
          : config.BASE_SEPOLIA_RPC_URL;
      
      this.providers[chainId] = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true, // Prevents eth_chainId calls on every request
      });
    }
    return this.providers[chainId];
  }

  // SXUA Service Wrapper
  static getSXUAContract(chainId: number) {
    const provider = this.getProvider(chainId);
    return new ethers.Contract(config.SXUA_ADDRESS, SXUA_ABI, provider);
  }

  // Factory Service Wrapper
  static getFactoryContract(chainId: number) {
    const provider = this.getProvider(chainId);
    return new ethers.Contract(config.FACTORY_ADDRESS, FACTORY_ABI, provider);
  }

  // Leaderboard Service Wrapper
  static getLeaderboardContract(chainId: number) {
    const provider = this.getProvider(chainId);
    return new ethers.Contract(config.LEADERBOARD_ADDRESS, LEADERBOARD_ABI, provider);
  }

  // Resolution Manager Service Wrapper
  static getResolutionManagerContract(chainId: number) {
    const provider = this.getProvider(chainId);
    return new ethers.Contract(config.RESOLUTION_MANAGER_ADDRESS, RESOLUTION_MANAGER_ABI, provider);
  }

  // Marketplace Service Wrapper
  static getMarketplaceContract(chainId: number) {
    const provider = this.getProvider(chainId);
    return new ethers.Contract(config.MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);
  }

  // Market Instance Service Wrapper
  static getMarketContract(marketAddress: string, chainId: number) {
    const provider = this.getProvider(chainId);
    return new ethers.Contract(marketAddress, PREDICTION_MARKET_ABI, provider);
  }

  // --- Sub-service abstractions ---

  // SXUAService
  static SXUAService = {
    getUnifiedBalance: async (user: string, token: string, chainId: number): Promise<bigint> => {
      const contract = BlockchainService.getSXUAContract(chainId);
      return retryCall(() => contract.getUnifiedBalance(user, token));
    },
    getCommittedBalances: async (user: string, token: string, chainId: number): Promise<bigint> => {
      const contract = BlockchainService.getSXUAContract(chainId);
      return retryCall(() => contract.getCommittedBalances(user, token));
    },
    getUncommittedBalance: async (user: string, token: string, chainId: number): Promise<bigint> => {
      const contract = BlockchainService.getSXUAContract(chainId);
      return retryCall(() => contract.getUncommittedBalance(user, token));
    },
    getAccruedYield: async (user: string, subAccountId: number, chainId: number): Promise<bigint> => {
      const contract = BlockchainService.getSXUAContract(chainId);
      return retryCall(() => contract.getAccruedYield(user, subAccountId));
    },
    getUserSubAccounts: async (user: string, chainId: number): Promise<bigint[]> => {
      const contract = BlockchainService.getSXUAContract(chainId);
      return retryCall(() => contract.getUserSubAccounts(user));
    },
    getSubAccountDetails: async (subAccountId: number, chainId: number) => {
      const contract = BlockchainService.getSXUAContract(chainId);
      const res = await retryCall(() => contract.subAccounts(subAccountId));
      return {
        id: Number(res[0]),
        token: res[1],
        owner: res[2],
        principal: res[3],
        createdAt: Number(res[4]),
        maturityDate: Number(res[5]),
        accruedYield: res[6],
        withdrawn: res[7],
      };
    },
  };

  // FactoryService
  static FactoryService = {
    getMarkets: async (chainId: number): Promise<string[]> => {
      const contract = BlockchainService.getFactoryContract(chainId);
      return retryCall(() => contract.getMarkets());
    },
  };

  // MarketService
  static MarketService = {
    getMarketDetails: async (marketAddress: string, chainId: number) => {
      const contract = BlockchainService.getMarketContract(marketAddress, chainId);
      const [question, endTime, minimumStake, collateralToken, yesPool, noPool, totalPool, resolved, winningOutcome] =
        await Promise.all([
          retryCall(() => contract.question()),
          retryCall(() => contract.endTime()),
          retryCall(() => contract.minimumStake()),
          retryCall(() => contract.collateralToken()),
          retryCall(() => contract.yesPool()),
          retryCall(() => contract.noPool()),
          retryCall(() => contract.totalPool()),
          retryCall(() => contract.resolved()),
          retryCall(() => contract.winningOutcome().catch(() => false)),
        ]);
      return {
        question,
        endTime: Number(endTime),
        minimumStake,
        collateralToken,
        yesPool,
        noPool,
        totalPool,
        resolved,
        winningOutcome,
      };
    },
    getOdds: async (marketAddress: string, outcome: boolean, chainId: number): Promise<bigint> => {
      const contract = BlockchainService.getMarketContract(marketAddress, chainId);
      return retryCall(() => contract.getOdds(outcome));
    },
    getPosition: async (marketAddress: string, positionId: number, chainId: number) => {
      const contract = BlockchainService.getMarketContract(marketAddress, chainId);
      const res = await retryCall(() => contract.getPosition(positionId));
      return {
        id: Number(res[0]),
        owner: res[1],
        outcome: res[2],
        amount: res[3],
        oddsAtEntry: res[4],
        createdAt: Number(res[5]),
        claimed: res[6],
      };
    },
    getUserPositions: async (marketAddress: string, user: string, chainId: number): Promise<bigint[]> => {
      const contract = BlockchainService.getMarketContract(marketAddress, chainId);
      return retryCall(() => contract.getUserPositions(user));
    },
  };

  // LeaderboardService
  static LeaderboardService = {
    getUserStats: async (user: string, chainId: number) => {
      const contract = BlockchainService.getLeaderboardContract(chainId);
      const res = await retryCall(() => contract.getUserStats(user));
      return {
        totalPredictions: Number(res[0]),
        correctPredictions: Number(res[1]),
        totalVolume: res[2],
      };
    },
    getAccuracy: async (user: string, chainId: number): Promise<bigint> => {
      const contract = BlockchainService.getLeaderboardContract(chainId);
      return retryCall(() => contract.getAccuracy(user));
    },
    getAllUsers: async (chainId: number): Promise<string[]> => {
      const contract = BlockchainService.getLeaderboardContract(chainId);
      return retryCall(() => contract.getAllUsers());
    },
    getClaimableRewards: async (user: string, token: string, chainId: number): Promise<bigint> => {
      const contract = BlockchainService.getLeaderboardContract(chainId);
      return retryCall(() => contract.claimableRewards(user, token));
    },
  };

  // MarketplaceService
  static MarketplaceService = {
    getListingDetails: async (listingId: number, chainId: number) => {
      const contract = BlockchainService.getMarketplaceContract(chainId);
      const res = await retryCall(() => contract.listings(listingId));
      return {
        id: Number(res[0]),
        seller: res[1],
        market: res[2],
        positionId: Number(res[3]),
        price: res[4],
        active: res[5],
      };
    },
  };
}

export default BlockchainService;
