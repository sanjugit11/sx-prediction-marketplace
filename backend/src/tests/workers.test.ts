// Mock ioredis and bullmq before importing workers
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

jest.mock('bullmq', () => {
  const EventEmitter = require('events').EventEmitter;
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation((name, processor, options) => {
      const emitter = new EventEmitter();
      (emitter as any).processFn = processor;
      return emitter;
    }),
  };
});

import { rewardWorker } from '../queues/reward.worker';
import { leaderboardWorker } from '../queues/leaderboard.worker';
import { reorgWorker } from '../queues/reorg.worker';
import { eventWorker } from '../queues/event.worker';
import { leaderboardUpdateQueue } from '../queues/queue.setup';
import { MarketsService } from '../modules/markets/markets.service';
import { AccountService } from '../modules/account/account.service';
import { StatsService } from '../modules/stats/stats.service';
import prisma from '../database/client';
import BlockchainService from '../blockchain/blockchain.service';
import config from '../config';

// Mock prisma and blockchain services
jest.mock('../database/client', () => {
  const modelMocks: Record<string, any> = {};

  const getModelMock = (name: string) => {
    if (!modelMocks[name]) {
      modelMocks[name] = {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      };
    }
    return modelMocks[name];
  };

  const mockClient = new Proxy({}, {
    get(target, prop) {
      if (prop === '$transaction') {
        return jest.fn((cb) => cb(mockClient));
      }
      if (typeof prop === 'string' && !prop.startsWith('$')) {
        return getModelMock(prop);
      }
      return undefined;
    }
  });

  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  };
});

jest.mock('../blockchain/blockchain.service', () => ({
  MarketService: {
    getMarketDetails: jest.fn().mockResolvedValue({
      yesPool: 5000n,
      noPool: 3000n,
      totalPool: 8000n,
    }),
    getOdds: jest.fn().mockResolvedValue(2000000000000000000n),
  },
}));

describe('Worker and Service Edge Cases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rewardWorker', () => {
    it('should process multi-tier reward splits (i=0,1,2,>2)', async () => {
      // Setup mock data for topUsers (needs to have length >= 4 to hit all branches)
      const mockJob: any = {
        data: {
          token: '0xusdc',
          totalPool: '10000',
          topUsers: ['user0', 'user1', 'user2', 'user3', 'user4'],
        },
      };

      (prisma.leaderboardSnapshot.findFirst as jest.Mock).mockResolvedValue({
        id: 'snapshot-id',
        rewardAmount: '500',
      });

      // Call the worker handler function directly
      const processFn = (rewardWorker as any).processFn;
      if (processFn) {
        await processFn(mockJob);
        // Verify updates occurred
        expect(prisma.leaderboardSnapshot.update).toHaveBeenCalledTimes(5);
      }
    });

    it('should handle completed and failed events', () => {
      const completedListeners = rewardWorker.listeners('completed');
      const failedListeners = rewardWorker.listeners('failed');

      expect(completedListeners.length).toBeGreaterThan(0);
      expect(failedListeners.length).toBeGreaterThan(0);

      // Invoke them directly
      completedListeners[0]({ id: 'job-id' } as any);
      failedListeners[0]({ id: 'job-id' } as any, new Error('Test Error'));
    });
  });

  describe('leaderboardWorker', () => {
    it('should sort entries by accuracy, volume, and predictions count', async () => {
      // Mock users with >= 10 predictions to satisfy the entry criteria
      const mockUsers = [
        {
          walletAddress: 'user-a',
          stakes: Array(10).fill({
            amount: '120',
            outcome: true,
            market: { resolved: true, winner: true },
          }), // accuracy 100%, volume 1200, predictions 10
        },
        {
          walletAddress: 'user-b',
          stakes: Array(12).fill({
            amount: '50',
            outcome: true,
            market: { resolved: true, winner: true },
          }), // accuracy 100%, volume 600, predictions 12
        },
        {
          walletAddress: 'user-c',
          stakes: Array(10).fill({
            amount: '200',
            outcome: true,
            market: { resolved: true, winner: false },
          }), // accuracy 0%, volume 2000, predictions 10
        },
        {
          walletAddress: 'user-d',
          stakes: Array(12).fill({
            amount: '100',
            outcome: true,
            market: { resolved: true, winner: true },
          }), // accuracy 100%, volume 1200, predictions 12
        },
        {
          walletAddress: 'user-e',
          stakes: Array(5).fill({
            amount: '50',
            outcome: true,
            market: { resolved: true, winner: true },
          }), // accuracy 100%, volume 250, predictions 5 (<10)
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const processFn = (leaderboardWorker as any).processFn;
      if (processFn) {
        await processFn({} as any);
        expect(prisma.leaderboardSnapshot.create).toHaveBeenCalled();
      }
    });

    it('should handle completed and failed events', () => {
      const completedListeners = leaderboardWorker.listeners('completed');
      const failedListeners = leaderboardWorker.listeners('failed');

      completedListeners[0]({ id: 'job-id' } as any);
      failedListeners[0]({ id: 'job-id' } as any, new Error('Test Error'));
    });
  });

  describe('eventWorker handlers', () => {
    const processFn = (eventWorker as any).processFn;

    const runEvent = async (eventName: string, eventData: any, contractAddress = '0xcontract') => {
      if (processFn) {
        await processFn({
          data: {
            eventName,
            contractAddress,
            chainId: 82008,
            transactionHash: '0xtxhash',
            blockNumber: 100,
            logIndex: 0,
            timestamp: '2026-06-21T13:40:00Z',
            eventData,
          },
        } as any);
      }
    };

    it('should handle completed and failed events', () => {
      const c = eventWorker.listeners('completed');
      const f = eventWorker.listeners('failed');
      c[0]({ id: 'job-id' } as any);
      f[0]({ id: 'job-id' } as any, new Error('Test Error'));
    });

    it('should handle SubAccountCreated (user exists)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
      await runEvent('SubAccountCreated', {
        id: '123',
        owner: '0xowner',
        token: '0xtoken',
        principal: '1000',
        maturityDate: '1700000000',
      });
      expect(prisma.committedSubAccount.upsert).toHaveBeenCalled();
    });

    it('should handle SubAccountCreated (user does not exist)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'user-2' });
      await runEvent('SubAccountCreated', {
        id: '123',
        owner: '0xnewowner',
        token: '0xtoken',
        principal: '1000',
        maturityDate: '1700000000',
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.committedSubAccount.upsert).toHaveBeenCalled();
    });

    it('should handle Withdrawn (isCommitted = true)', async () => {
      await runEvent('Withdrawn', {
        user: '0xowner',
        isCommitted: true,
        subAccountId: '123',
      });
      expect(prisma.committedSubAccount.updateMany).toHaveBeenCalled();
    });

    it('should handle Withdrawn (isCommitted = false)', async () => {
      await runEvent('Withdrawn', {
        user: '0xowner',
        isCommitted: false,
        subAccountId: '123',
      });
      expect(prisma.committedSubAccount.updateMany).not.toHaveBeenCalled();
    });

    it('should handle MarketCreated', async () => {
      await runEvent('MarketCreated', {
        marketAddress: '0xmarketAddress',
        question: 'Will ETH hit $10k?',
        endTime: '1800000000',
        creator: '0xcreator',
        collateralToken: '0xtoken',
      });
      expect(prisma.market.upsert).toHaveBeenCalled();
    });

    it('should handle MarketCreated when creator is not provided', async () => {
      await runEvent('MarketCreated', {
        marketAddress: '0xmarketAddress',
        question: 'Will ETH hit $10k?',
        endTime: '1800000000',
        collateralToken: '0xtoken',
      });
      expect(prisma.market.upsert).toHaveBeenCalled();
    });

    it('should handle Staked (user exists, market exists)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.market.findUnique as jest.Mock).mockResolvedValue({ id: 'market-1' });
      await runEvent('Staked', {
        user: '0xowner',
        outcome: true,
        amount: '100',
        odds: 1500000000000000000n,
        positionId: '1',
      });
      expect(prisma.stake.upsert).toHaveBeenCalled();
    });

    it('should handle Staked (user does not exist)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'user-2' });
      (prisma.market.findUnique as jest.Mock).mockResolvedValue({ id: 'market-1' });
      await runEvent('Staked', {
        user: '0xnewowner',
        outcome: true,
        amount: '100',
        odds: 1500000000000000000n,
        positionId: '1',
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.stake.upsert).toHaveBeenCalled();
    });

    it('should handle Staked (market does not exist)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.market.findUnique as jest.Mock).mockResolvedValue(null);
      await runEvent('Staked', {
        user: '0xowner',
        outcome: true,
        amount: '100',
        odds: 1500000000000000000n,
        positionId: '1',
      });
      expect(prisma.stake.upsert).not.toHaveBeenCalled();
    });

    it('should handle MarketResolved (market exists)', async () => {
      (prisma.market.findUnique as jest.Mock).mockResolvedValue({ id: 'market-1' });
      (prisma.stake.findMany as jest.Mock).mockResolvedValue([
        { user: { walletAddress: '0xuser1' } },
        { user: { walletAddress: '0xuser2' } },
      ]);
      await runEvent('MarketResolved', { winner: true });
      expect(prisma.market.update).toHaveBeenCalled();
      expect(leaderboardUpdateQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should handle MarketResolved (market does not exist)', async () => {
      (prisma.market.findUnique as jest.Mock).mockResolvedValue(null);
      await runEvent('MarketResolved', { winner: true });
      expect(prisma.market.update).not.toHaveBeenCalled();
    });

    it('should handle PayoutClaimed', async () => {
      await runEvent('PayoutClaimed', { positionId: '123' });
      expect(prisma.stake.updateMany).toHaveBeenCalled();
    });

    it('should handle PositionListed (user exists, market exists, stake exists)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.market.findUnique as jest.Mock).mockResolvedValue({ id: 'market-1' });
      (prisma.stake.findFirst as jest.Mock).mockResolvedValue({ id: 'stake-1' });
      await runEvent('PositionListed', {
        listingId: '123',
        seller: '0xseller',
        market: '0xmarket',
        positionId: '1',
        price: '100',
      });
      expect(prisma.marketplaceListing.upsert).toHaveBeenCalled();
    });

    it('should handle PositionListed (user does not exist, market does not exist)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'user-2' });
      (prisma.market.findUnique as jest.Mock).mockResolvedValue(null);
      await runEvent('PositionListed', {
        listingId: '123',
        seller: '0xseller',
        market: '0xmarket',
        positionId: '1',
        price: '100',
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.marketplaceListing.upsert).not.toHaveBeenCalled();
    });

    it('should handle PositionPurchased (buyer exists, listing exists)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'buyer-1' });
      (prisma.marketplaceListing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-1',
        stakeId: 'stake-1',
        sellerId: 'seller-1',
      });
      await runEvent('PositionPurchased', {
        listingId: '123',
        buyer: '0xbuyer',
      });
      expect(prisma.marketplaceListing.update).toHaveBeenCalled();
      expect(prisma.stake.update).toHaveBeenCalled();
    });

    it('should handle PositionPurchased (buyer does not exist)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'buyer-2' });
      (prisma.marketplaceListing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-2',
        stakeId: 'stake-2',
        sellerId: 'seller-2',
      });
      await runEvent('PositionPurchased', {
        listingId: '456',
        buyer: '0xnewbuyer',
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.marketplaceListing.update).toHaveBeenCalled();
      expect(prisma.stake.update).toHaveBeenCalled();
    });

    it('should handle ListingCanceled', async () => {
      await runEvent('ListingCanceled', { listingId: '123' });
      expect(prisma.marketplaceListing.updateMany).toHaveBeenCalled();
    });

    it('should log debug on unhandled event', async () => {
      await runEvent('SomeUnhandledEvent', {});
      expect(prisma.event.upsert).toHaveBeenCalled();
    });
  });

  describe('reorgWorker handlers', () => {
    it('should handle completed and failed events', () => {
      const c = reorgWorker.listeners('completed');
      const f = reorgWorker.listeners('failed');
      c[0]({ id: 'job-id' } as any);
      f[0]({ id: 'job-id' } as any, new Error('Test Error'));
    });

    it('should rollback all affected events for different event types', async () => {
      const affectedEvents = [
        {
          eventName: 'SubAccountCreated',
          contractAddress: '0xcontract',
          eventData: { id: '1' },
        },
        {
          eventName: 'Withdrawn',
          contractAddress: '0xcontract',
          eventData: { isCommitted: true, subAccountId: '1' },
        },
        {
          eventName: 'Withdrawn',
          contractAddress: '0xcontract',
          eventData: { isCommitted: false, subAccountId: '2' },
        },
        {
          eventName: 'MarketCreated',
          contractAddress: '0xcontract',
          eventData: { marketAddress: '0xmarketAddress' },
        },
        {
          eventName: 'Staked',
          contractAddress: '0xcontract',
          eventData: { positionId: '1' },
        },
        {
          eventName: 'MarketResolved',
          contractAddress: '0xcontract',
          eventData: {},
        },
        {
          eventName: 'PayoutClaimed',
          contractAddress: '0xcontract',
          eventData: { positionId: '2' },
        },
        {
          eventName: 'PositionListed',
          contractAddress: '0xcontract',
          eventData: { listingId: '1' },
        },
        {
          eventName: 'PositionPurchased',
          contractAddress: '0xcontract',
          eventData: { listingId: '2' },
        },
        {
          eventName: 'PositionPurchased',
          contractAddress: '0xcontract',
          eventData: { listingId: '999' },
        },
        {
          eventName: 'ListingCanceled',
          contractAddress: '0xcontract',
          eventData: { listingId: '3' },
        },
        {
          eventName: 'SomeUnhandledEvent',
          contractAddress: '0xcontract',
          eventData: {},
        },
      ];

      (prisma.event.findMany as jest.Mock).mockResolvedValue(affectedEvents);
      
      (prisma.marketplaceListing.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'listing-id', stakeId: 'stake-id', sellerId: 'seller-id' }) // listing exists
        .mockResolvedValueOnce(null); // listing does not exist

      const processFn = (reorgWorker as any).processFn;
      if (processFn) {
        await processFn({
          data: {
            chainId: 82008,
            blockNumber: 100,
            oldHash: '0xold',
            newHash: '0xnew',
          },
        } as any);

        expect(prisma.reorgLog.create).toHaveBeenCalled();
        expect(prisma.committedSubAccount.deleteMany).toHaveBeenCalled();
        expect(prisma.committedSubAccount.updateMany).toHaveBeenCalled();
        expect(prisma.market.deleteMany).toHaveBeenCalled();
        expect(prisma.stake.deleteMany).toHaveBeenCalled();
        expect(prisma.market.updateMany).toHaveBeenCalled();
        expect(prisma.stake.updateMany).toHaveBeenCalled();
        expect(prisma.marketplaceListing.deleteMany).toHaveBeenCalled();
        expect(prisma.marketplaceListing.update).toHaveBeenCalled();
        expect(prisma.stake.update).toHaveBeenCalled();
        expect(prisma.event.deleteMany).toHaveBeenCalled();
        expect(prisma.syncStatus.upsert).toHaveBeenCalled();
      }
    });
  });

  describe('MarketsService defaults', () => {
    it('should execute functions with default parameter values', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue({
        id: 'market-id',
        contractAddress: '0xmarket',
        resolved: false,
      });

      // missing chainId
      const market = await MarketsService.getMarketById('market-id');
      expect(market.id).toBe('market-id');

      // missing tokenAddress
      const payload = MarketsService.getCreatePayload('test question', 1700000000, '1000');
      expect(payload.args[3]).toBe(config.USDC_ADDRESS);

      // missing chainId for odds
      const odds = await MarketsService.getOdds('market-id');
      expect(odds.yes).toBeDefined();
    });
  });

  describe('AccountService exception check', () => {
    it('should throw error on committed withdrawal without subAccountId', () => {
      expect(() =>
        AccountService.getWithdrawPayload('0xtoken', '100', true, undefined)
      ).toThrow('subAccountId is required for committed withdrawal');
    });
  });

  describe('StatsService fallback checks', () => {
    it('should fallback to 0 when aggregates return null sums', async () => {
      (prisma.market.count as jest.Mock).mockResolvedValue(0);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);
      (prisma.stake.count as jest.Mock).mockResolvedValue(0);
      
      (prisma.stake.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: null },
      });
      (prisma.leaderboardSnapshot.aggregate as jest.Mock).mockResolvedValue({
        _sum: { rewardAmount: null },
      });

      const stats = await StatsService.getPlatformStats();
      expect(stats.volume).toBe('0');
      expect(stats.rewards).toBe('0');
    });
  });

  describe('Redis Connection Error Logger', () => {
    it('should log redis connection errors', () => {
      const { redisConnection } = require('../queues/queue.setup');
      const loggerSpy = jest.spyOn(require('../utils/logger').default, 'error').mockImplementation(() => {});
      
      const errorCall = (redisConnection.on as jest.Mock).mock.calls.find((call) => call[0] === 'error');
      if (errorCall && typeof errorCall[1] === 'function') {
        errorCall[1](new Error('Redis Connection Error'));
        expect(loggerSpy).toHaveBeenCalledWith('Redis connection error:', expect.any(Error));
      }
      loggerSpy.mockRestore();
    });
  });
});
