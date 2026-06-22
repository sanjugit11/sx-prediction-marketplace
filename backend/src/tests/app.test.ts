import request from 'supertest';
import jwt from 'jsonwebtoken';
import { HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, InternalServerError } from '../utils/errors';
import { AccountController } from '../modules/account/account.controller';
import { AccountService } from '../modules/account/account.service';
import { MarketplaceService } from '../modules/marketplace/marketplace.service';
import { MarketplaceController } from '../modules/marketplace/marketplace.controller';
import { LeaderboardService } from '../modules/leaderboard/leaderboard.service';
import { ResolutionController } from '../modules/resolution/resolution.controller';
import { StakingController } from '../modules/staking/staking.controller';
import { SecurityController } from '../modules/security/security.controller';
import { EventsController } from '../modules/events/events.controller';
import { MarketsController } from '../modules/markets/markets.controller';
import { StatsController } from '../modules/stats/stats.controller';

// Mock ioredis before importing app/queues
jest.mock('ioredis', () => {
  const EventEmitter = require('events');
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    emitter.ping = jest.fn().mockResolvedValue('PONG');
    emitter.disconnect = jest.fn().mockResolvedValue(undefined);
    emitter.quit = jest.fn().mockResolvedValue(undefined);
    return emitter;
  });
});

import app from '../app';
import prisma from '../database/client';
import BlockchainService from '../blockchain/blockchain.service';
import config from '../config';

// Mock BullMQ queues
jest.mock('../queues/queue.setup', () => ({
  redisConnection: {
    ping: jest.fn().mockResolvedValue('PONG'),
  },
  leaderboardUpdateQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  },
  rewardDistributionQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  },
  eventProcessingQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  },
  reorgRecoveryQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  },
}));

// Mock blockchain services
jest.mock('../blockchain/blockchain.service', () => ({
  getProvider: jest.fn().mockReturnValue({
    getBlockNumber: jest.fn().mockResolvedValue(12345),
  }),
  SXUAService: {
    getUnifiedBalance: jest.fn().mockResolvedValue(1000n),
    getUncommittedBalance: jest.fn().mockResolvedValue(600n),
    getCommittedBalances: jest.fn().mockResolvedValue(400n),
    getUserSubAccounts: jest.fn().mockResolvedValue([1n]),
    getAccruedYield: jest.fn().mockResolvedValue(50n),
  },
  MarketService: {
    getMarketDetails: jest.fn().mockResolvedValue({
      question: 'Will ETH hit $5,000?',
      endTime: 1798761600,
      minimumStake: 1000n,
      collateralToken: '0xusdc',
      yesPool: 5000n,
      noPool: 3000n,
      totalPool: 8000n,
      resolved: false,
    }),
    getOdds: jest.fn().mockResolvedValue(2000000000000000000n), // 2.0x in 1e18
  },
}));

// Mock database client with default and named prisma exports
jest.mock('../database/client', () => {
  const mockClient = {
    market: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    stake: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    marketplaceListing: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    leaderboardSnapshot: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    securityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    syncStatus: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  };

  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  };
});

describe('SX Marketplace Endpoints Tests', () => {
  const mockToken = jwt.sign(
    { userId: 'user-id', walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' },
    config.JWT_SECRET
  );

  const mockAdminToken = jwt.sign(
    { userId: 'admin-id', walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' }, // hardhat account 0 (admin)
    config.JWT_SECRET
  );

  const mockMarket = {
    id: 'market-uuid',
    contractAddress: '0xmarketaddress',
    question: 'Will ETH hit $5,000?',
    creator: '0xcreator',
    endTime: new Date(),
    resolved: false,
  };

  beforeEach(() => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-id',
      walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      totpEnabled: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Account Module', () => {
    it('GET /api/account/balance should return correct balance components', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-id', walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' });
      const res = await request(app)
        .get('/api/account/balance')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.unifiedBalance).toBe('1000');
      expect(res.body.uncommittedBalance).toBe('600');
      expect(res.body.committedBalances).toBe('400');
      expect(res.body.accruedYield).toBe('50');
    });

    it('POST /api/account/deposit should return deposit payloads', async () => {
      const res = await request(app)
        .post('/api/account/deposit')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ amount: '100000', committedPercentage: 50 });

      expect(res.status).toBe(200);
      expect(res.body.method).toBe('deposit');
      expect(res.body.args[1]).toBe('100000');
    });
  });

  describe('Markets Module', () => {
    it('GET /api/markets should fetch markets', async () => {
      (prisma.market.findMany as jest.Mock).mockResolvedValue([mockMarket]);
      const res = await request(app).get('/api/markets');

      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe(mockMarket.id);
    });

    it('GET /api/markets/:id should fetch details with live odds', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      const res = await request(app).get(`/api/markets/${mockMarket.id}`);

      expect(res.status).toBe(200);
      expect(res.body.yesPool).toBe('5000');
      expect(res.body.liveOddsYes).toBe('2');
    });
  });

  describe('Staking Module', () => {
    it('POST /api/markets/:id/stake should generate stake payload', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      const res = await request(app)
        .post(`/api/markets/${mockMarket.id}/stake`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ outcome: true, amount: '1000' });

      expect(res.status).toBe(201);
      expect(res.body.method).toBe('stakeYes');
    });
  });

  describe('Resolution Module', () => {
    it('POST /api/markets/:id/resolve should generate resolve payload for admin', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      const res = await request(app)
        .post(`/api/markets/${mockMarket.id}/resolve`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({ winner: true });

      expect(res.status).toBe(200);
      expect(res.body.method).toBe('resolveMarket');
    });
  });

  describe('Marketplace Module', () => {
    it('GET /api/listings should fetch listings', async () => {
      (prisma.marketplaceListing.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get('/api/listings');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Stats Module', () => {
    it('GET /api/stats should fetch platform aggregates', async () => {
      (prisma.market.count as jest.Mock).mockResolvedValue(5);
      (prisma.user.count as jest.Mock).mockResolvedValue(10);
      (prisma.stake.count as jest.Mock).mockResolvedValue(20);
      (prisma.stake.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 50000n } });
      (prisma.leaderboardSnapshot.aggregate as jest.Mock).mockResolvedValue({ _sum: { rewardAmount: 1000n } });

      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(res.body.markets).toBe(5);
      expect(res.body.users).toBe(10);
      expect(res.body.volume).toBe('50000');
    });
  });

  describe('Health Module', () => {
    it('GET /api/health should verify health components status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.database).toBe(true);
      expect(res.body.redis).toBe(true);
    });
  });

  describe('Additional integration coverage', () => {
    it('POST /api/account/withdraw should generate withdraw payload', async () => {
      const res = await request(app)
        .post('/api/account/withdraw')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ amount: '1000', isCommitted: false });
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('withdrawUncommitted');
    });

    it('POST /api/markets/create should allow admin to create a market', async () => {
      (prisma.market.create as jest.Mock).mockResolvedValue(mockMarket);
      const res = await request(app)
        .post('/api/markets/create')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          question: 'Will ETH hit $5,000?',
          endTime: Math.floor(Date.now() / 1000) + 10000,
          minimumStake: '1000',
        });
      expect(res.status).toBe(201);
    });

    it('GET /api/markets/:id/odds should fetch odds', async () => {
      const res = await request(app).get(`/api/markets/${mockMarket.id}/odds?outcome=true`);
      expect(res.status).toBe(200);
      expect(res.body.yes).toBeDefined();
    });

    it('GET /api/markets/:address/stakes should query contract/db stakes', async () => {
      (prisma.market.findUnique as jest.Mock).mockResolvedValue(mockMarket);
      (prisma.stake.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get(`/api/markets/${mockMarket.contractAddress}/stakes`);
      expect(res.status).toBe(200);
    });

    it('GET /api/users/:wallet/positions should query user positions', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-uuid',
        walletAddress: mockMarket.creator.toLowerCase(),
        stakes: [],
      });
      const res = await request(app).get(`/api/users/${mockMarket.creator}/positions`);
      expect(res.status).toBe(200);
    });

    it('POST /api/markets/:id/claim should generate payout claim payload', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue({ ...mockMarket, resolved: true });
      (prisma.stake.findFirst as jest.Mock).mockResolvedValue({ id: 'stake-id', outcome: true });
      const res = await request(app)
        .post(`/api/markets/${mockMarket.id}/claim`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ positionId: 1 });
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('claimPayout');
    });

    it('GET /api/leaderboard should fetch snapshot', async () => {
      (prisma.leaderboardSnapshot.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get('/api/leaderboard');
      expect(res.status).toBe(200);
    });

    it('POST /api/leaderboard/recalculate should allow admin to enqueue update', async () => {
      const res = await request(app)
        .post('/api/leaderboard/recalculate')
        .set('Authorization', `Bearer ${mockAdminToken}`);
      expect(res.status).toBe(202);
    });

    it('POST /api/leaderboard/distribute should allow admin to enqueue distribution', async () => {
      const res = await request(app)
        .post('/api/leaderboard/distribute')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({ token: '0xtoken', totalPool: '10000', topUsers: ['0xuser'] });
      expect(res.status).toBe(200);
    });

    it('POST /api/leaderboard/claim should generate reward claim payload', async () => {
      (prisma.leaderboardSnapshot.findFirst as jest.Mock).mockResolvedValue({ id: 'snap-id' });
      const res = await request(app)
        .post('/api/leaderboard/claim')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ wallet: '0xuser' });
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('claimReward');
    });

    it('POST /api/listings should list position', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      (prisma.stake.findFirst as jest.Mock).mockResolvedValue({ id: 'stake-id', outcome: true });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-id', walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' });
      (prisma.marketplaceListing.create as jest.Mock).mockResolvedValue({ id: 'listing-id' });
      const res = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ marketAddress: mockMarket.contractAddress, positionId: 1, price: '500' });
      expect(res.status).toBe(201);
      expect(res.body.method).toBe('listPosition');
    });

    it('POST /api/listings/buy should generate purchase payload', async () => {
      (prisma.marketplaceListing.findUnique as jest.Mock).mockResolvedValue({ id: 'listing-uuid', price: '500', stakeId: 'stake-id' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'buyer-id' });
      const res = await request(app)
        .post('/api/listings/buy')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ listingId: 12345 });
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('buyPosition');
    });

    it('POST /api/listings/cancel should generate cancellation payload', async () => {
      (prisma.marketplaceListing.findUnique as jest.Mock).mockResolvedValue({ id: 'listing-id', seller: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' });
      const res = await request(app)
        .post('/api/listings/cancel')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ listingId: 'listing-id' });
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('cancelListing');
    });

    it('GET /api/events should list logged events', async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get('/api/events?chainId=82008');
      expect(res.status).toBe(200);
    });

    it('GET /api/events/:chainId/:txHash should retrieve specific event', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: 'event-id' });
      const res = await request(app).get('/api/events/82008/0xtxhash');
      expect(res.status).toBe(200);
    });

    it('POST /api/security/jailbreak-log should record jailbreak alerts', async () => {
      (prisma.securityLog.create as jest.Mock).mockResolvedValue({ id: 'log-id' });
      const res = await request(app)
        .post('/api/security/jailbreak-log')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          ipAddress: '1.2.3.4',
          walletAddress: '0xwallet',
          payload: 'bad input',
          detectedType: 'SQL_INJECTION',
          severity: 'HIGH',
        });
      expect(res.status).toBe(201);
    });

    it('GET /api/security/logs should threat logs for admin', async () => {
      (prisma.securityLog.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/security/logs')
        .set('Authorization', `Bearer ${mockAdminToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/users/:wallet/positions should return 404 if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/users/0xnonexistent/positions`);
      expect(res.status).toBe(404);
    });

    it('GET /api/users/:wallet/positions should map positions and estimate payout', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-uuid',
        walletAddress: '0xwallet',
        stakes: [
          {
            id: 'stake-uuid',
            positionId: 1,
            marketId: 'market-uuid',
            amount: '1000',
            oddsAtEntry: '1.5',
            outcome: true,
            claimed: false,
            market: {
              question: 'Will Hoodi hit $10?',
              contractAddress: '0xmarketAddress',
              resolved: false,
              winner: null,
            },
          },
        ],
      });
      const res = await request(app)
        .get(`/api/users/0xwallet/positions`);
      expect(res.status).toBe(200);
      expect(res.body[0].estimatedPayout).toBe('1500');
    });

    it('POST /api/markets/:id/resolve should return 404 if market not found', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await request(app)
        .post('/api/markets/nonexistent/resolve')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({ winner: true });
      expect(res.status).toBe(404);
    });

    it('POST /api/markets/:id/claim should return 404 if market not found', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await request(app)
        .post('/api/markets/nonexistent/claim')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ positionId: 1 });
      expect(res.status).toBe(404);
    });

    it('GET /api/events with filters should list logged events', async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/events?eventName=MarketCreated&market=0xmarketAddress&wallet=0xwalletAddress');
      expect(res.status).toBe(200);
    });

    it('GET /api/events/:chainId/:txHash should return 404 if event transaction not found', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await request(app).get('/api/events/82008/0xnonexistenttx');
      expect(res.status).toBe(404);
    });

    it('POST /api/account/deposit validation errors', async () => {
      const res = await request(app)
        .post('/api/account/deposit')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/account/withdraw validation errors', async () => {
      const res1 = await request(app)
        .post('/api/account/withdraw')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ isCommitted: true });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/account/withdraw')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ isCommitted: false });
      expect(res2.status).toBe(400);
    });

    it('POST /api/markets/:id/stake validation errors and non-existent market', async () => {
      const res1 = await request(app)
        .post('/api/markets/some-market/stake')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});
      expect(res1.status).toBe(400);

      (prisma.market.findFirst as jest.Mock).mockResolvedValue(null);
      const res2 = await request(app)
        .post('/api/markets/non-existent/stake')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ outcome: true, amount: '1000' });
      expect(res2.status).toBe(404);
    });

    it('POST /api/markets/:id/stake should simulate and create user if missing', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'admin-id', walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', totpEnabled: false })
        .mockResolvedValueOnce(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'new-user-id' });
      (prisma.stake.create as jest.Mock).mockResolvedValue({ id: 'sim-stake-id' });

      const res = await request(app)
        .post(`/api/markets/${mockMarket.id}/stake`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ outcome: true, amount: '1000' });
      expect(res.status).toBe(201);
    });

    it('POST /api/markets/:id/stake should return payload in production env', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);

      const res = await request(app)
        .post(`/api/markets/${mockMarket.id}/stake`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ outcome: true, amount: '1000', simulate: false });

      process.env.NODE_ENV = oldEnv;
      expect(res.status).toBe(200);
    });

    it('GET /api/health degraded state when db or redis errors', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
      jest.spyOn(require('../queues/queue.setup').redisConnection, 'ping').mockRejectedValueOnce(new Error('Redis error'));
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
    });

    it('GET /api/health check sync status checkpoints mapping', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ 1: 1 }]);
      (prisma.syncStatus.findMany as jest.Mock).mockResolvedValue([
        { chainId: config.HOODI_CHAIN_ID, lastProcessedBlock: 100 },
        { chainId: config.BASE_SEPOLIA_CHAIN_ID, lastProcessedBlock: 200 }
      ]);
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.indexer.hoodiIndexedBlock).toBe(100);
      expect(res.body.indexer.baseIndexedBlock).toBe(200);
    });

    it('GET /api/markets filtered by resolved state', async () => {
      (prisma.market.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get('/api/markets?resolved=true');
      expect(res.status).toBe(200);
      expect(prisma.market.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { resolved: true }
      }));
    });

    it('GET /api/markets/:id should return 404 if market not found', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await request(app).get('/api/markets/nonexistent');
      expect(res.status).toBe(404);
    });

    it('GET /api/markets/:id fallback when blockchain RPC fails', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      jest.spyOn(BlockchainService.MarketService, 'getMarketDetails').mockRejectedValueOnce(new Error('RPC down'));
      const res = await request(app).get(`/api/markets/${mockMarket.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockMarket.id);
    });

    it('GET /api/markets/:id/odds should return 404 if market not found', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await request(app).get('/api/markets/nonexistent/odds');
      expect(res.status).toBe(404);
    });

    it('GET /api/markets/:id/odds fallback when blockchain RPC fails', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      jest.spyOn(BlockchainService.MarketService, 'getOdds').mockRejectedValueOnce(new Error('RPC down'));
      const res = await request(app).get(`/api/markets/${mockMarket.id}/odds`);
      expect(res.status).toBe(200);
      expect(res.body.yes).toBe('2.0');
    });

    it('GET /api/markets/:address/stakes should return 404 if market not found', async () => {
      (prisma.market.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await request(app).get('/api/markets/0xnonexistent/stakes');
      expect(res.status).toBe(404);
    });

    it('POST /api/security/jailbreak-log validation error', async () => {
      const res = await request(app)
        .post('/api/security/jailbreak-log')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('GET /api/security/logs filtered by severity', async () => {
      (prisma.securityLog.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/security/logs?severity=HIGH')
        .set('Authorization', `Bearer ${mockAdminToken}`);
      expect(res.status).toBe(200);
      expect(prisma.securityLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { severity: 'HIGH' }
      }));
    });

    it('POST /api/leaderboard/distribute validation error', async () => {
      const res = await request(app)
        .post('/api/leaderboard/distribute')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/listings validation error', async () => {
      const res = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/listings/buy validation error', async () => {
      const res = await request(app)
        .post('/api/listings/buy')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/listings/cancel validation error', async () => {
      const res = await request(app)
        .post('/api/listings/cancel')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/listings should return listing payload directly in production', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ marketAddress: mockMarket.contractAddress, positionId: 1, price: '500', simulate: false });

      process.env.NODE_ENV = oldEnv;
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('listPosition');
    });

    it('POST /api/listings/buy should create buyer user if not exists during simulation', async () => {
      (prisma.marketplaceListing.findUnique as jest.Mock).mockResolvedValue({ id: 'listing-uuid', price: '500', stakeId: 'stake-id' });
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'admin-id', walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', totpEnabled: false }) // middleware
        .mockResolvedValueOnce(null); // controller
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'new-buyer-id' });
      (prisma.marketplaceListing.update as jest.Mock).mockResolvedValue({});
      (prisma.stake.update as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/api/listings/buy')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ listingId: 12345 });
      expect(res.status).toBe(200);
    });

    it('GET /api/account/withdraw committed with subAccountId should return withdrawCommitted method', async () => {
      const res = await request(app)
        .post('/api/account/withdraw')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ amount: '1000', isCommitted: true, subAccountId: 123 });
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('withdrawCommitted');
    });

    it('POST /api/markets/:id/stake with outcome false should generate stakeNo payload', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      const res = await request(app)
        .post(`/api/markets/${mockMarket.id}/stake`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ outcome: false, amount: '1000' });
      expect(res.status).toBe(201);
      expect(res.body.method).toBe('stakeNo');
    });

    it('GET /api/leaderboard with snapshot coverage', async () => {
      (prisma.leaderboardSnapshot.findFirst as jest.Mock).mockResolvedValue({ snapshotDate: new Date() });
      (prisma.leaderboardSnapshot.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get('/api/leaderboard');
      expect(res.status).toBe(200);
    });

    it('LeaderboardService.getDistributePayload validation limits', () => {
      expect(() => LeaderboardService.getDistributePayload('0xtoken', '1000', [])).toThrow('Must distribute to between 1 and 10 users');
    });

    it('MarketplaceService.listListings default status parameter', async () => {
      (prisma.marketplaceListing.findMany as jest.Mock).mockResolvedValue([]);
      const result = await MarketplaceService.listListings();
      expect(result).toEqual([]);
    });

    it('HttpError subclasses default messages', () => {
      expect(new BadRequestError().message).toBe('Bad Request');
      expect(new UnauthorizedError().message).toBe('Unauthorized');
      expect(new ForbiddenError().message).toBe('Forbidden');
      expect(new NotFoundError().message).toBe('Not Found');
      expect(new ConflictError().message).toBe('Conflict');
      expect(new InternalServerError().message).toBe('Internal Server Error');
    });

    it('logger fallback in production', () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      jest.isolateModules(() => {
        const prodLogger = require('../utils/logger').default;
        expect(prodLogger.level).toBe('info');
      });
      process.env.NODE_ENV = oldEnv;
    });


    it('POST /api/markets/:id/resolve with winner false should generate winner false resolve payload', async () => {
      (prisma.market.findFirst as jest.Mock).mockResolvedValue(mockMarket);
      const res = await request(app)
        .post(`/api/markets/${mockMarket.id}/resolve`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({ winner: false });
      expect(res.status).toBe(200);
      expect(res.body.args[1]).toBe(false);
    });

    it('POST /api/markets/:id/resolve validation error if winner is missing', async () => {
      const res = await request(app)
        .post(`/api/markets/some-id/resolve`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/markets/:id/claim validation error if positionId is missing', async () => {
      const res = await request(app)
        .post(`/api/markets/some-id/claim`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('MarketplaceController simulation missing entities paths', async () => {
      const resObj: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // 1. market not found
      (prisma.market.findFirst as jest.Mock).mockResolvedValueOnce(null);
      await MarketplaceController.listPosition({
        body: { marketAddress: '0xmarket', positionId: 1, price: '100', simulate: true }
      } as any, resObj, next);
      expect(resObj.status).toHaveBeenCalledWith(200);

      // 2. stake not found
      (prisma.market.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'market-1' });
      (prisma.stake.findFirst as jest.Mock).mockResolvedValueOnce(null);
      await MarketplaceController.listPosition({
        body: { marketAddress: '0xmarket', positionId: 1, price: '100', simulate: true }
      } as any, resObj, next);
      expect(resObj.status).toHaveBeenCalledWith(200);

      // 3. user not found
      (prisma.market.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'market-1' });
      (prisma.stake.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'stake-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await MarketplaceController.listPosition({
        body: { marketAddress: '0xmarket', positionId: 1, price: '100', simulate: true }
      } as any, resObj, next);
      expect(resObj.status).toHaveBeenCalledWith(200);

      // 4. listing not found for buy
      (prisma.marketplaceListing.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await MarketplaceController.buyPosition({
        body: { listingId: 123 }
      } as any, resObj, next);
      expect(resObj.status).toHaveBeenCalledWith(200);
    });

    it('should invoke next(error) on controller exceptions', async () => {
      const req: any = { 
        query: {}, 
        params: { id: 'some-id', wallet: '0xwallet', address: '0xaddress', chainId: '82008', txHash: '0xhash' }, 
        body: { amount: '100', committedPercentage: 50, isCommitted: false, winner: true, positionId: 1, listingId: 1, price: '100', outcome: true, token: '0x', totalPool: '100', topUsers: ['0x'], severity: 'HIGH', message: 'test', marketAddress: '0xmarketAddress', payload: 'some-payload', detectedType: 'SQL_INJECTION' },
        user: { id: 'user-id', walletAddress: '0xwallet', role: 'ADMIN' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' }
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // AccountController
      jest.spyOn(AccountService, 'getBalance').mockRejectedValueOnce(new Error('err'));
      await AccountController.getBalance(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(AccountService, 'getDepositPayload').mockImplementationOnce(() => { throw new Error('err'); });
      await AccountController.deposit(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(AccountService, 'getWithdrawPayload').mockImplementationOnce(() => { throw new Error('err'); });
      await AccountController.withdraw(req, res, next);
      expect(next).toHaveBeenCalled();

      // EventsController
      next.mockClear();
      jest.spyOn(require('../modules/events/events.service').EventsService, 'queryEvents').mockRejectedValueOnce(new Error('err'));
      await EventsController.queryEvents(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(require('../modules/events/events.service').EventsService, 'getEventByTxHash').mockRejectedValueOnce(new Error('err'));
      await EventsController.getEventByTxHash(req, res, next);
      expect(next).toHaveBeenCalled();

      // MarketplaceController
      next.mockClear();
      jest.spyOn(MarketplaceService, 'listListings').mockRejectedValueOnce(new Error('err'));
      await MarketplaceController.listListings(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(MarketplaceService, 'getListPayload').mockImplementationOnce(() => { throw new Error('err'); });
      await MarketplaceController.listPosition(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(MarketplaceService, 'getBuyPayload').mockImplementationOnce(() => { throw new Error('err'); });
      await MarketplaceController.buyPosition(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(MarketplaceService, 'getCancelPayload').mockImplementationOnce(() => { throw new Error('err'); });
      await MarketplaceController.cancelListing(req, res, next);
      expect(next).toHaveBeenCalled();

      // ResolutionController
      next.mockClear();
      jest.spyOn(require('../modules/resolution/resolution.service').ResolutionService, 'getResolvePayload').mockImplementationOnce(() => { throw new Error('err'); });
      await ResolutionController.resolveMarket(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(require('../modules/resolution/resolution.service').ResolutionService, 'getClaimPayload').mockImplementationOnce(() => { throw new Error('err'); });
      await ResolutionController.claimPayout(req, res, next);
      expect(next).toHaveBeenCalled();

      // StakingController
      next.mockClear();
      jest.spyOn(require('../modules/staking/staking.service').StakingService, 'getStakePayload').mockImplementationOnce(() => { throw new Error('err'); });
      await StakingController.stake(req, res, next);
      expect(next).toHaveBeenCalled();

      // SecurityController
      next.mockClear();
      jest.spyOn(prisma.securityLog, 'create').mockRejectedValueOnce(new Error('err'));
      await SecurityController.logJailbreak(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      jest.spyOn(prisma.securityLog, 'findMany').mockRejectedValueOnce(new Error('err'));
      await SecurityController.getLogs(req, res, next);
      expect(next).toHaveBeenCalled();

      // MarketsController
      next.mockClear();
      jest.spyOn(require('../modules/markets/markets.service').MarketsService, 'getMarketById').mockRejectedValueOnce(new Error('err'));
      await MarketsController.getMarketById(req, res, next);
      expect(next).toHaveBeenCalled();

      // StatsController
      next.mockClear();
      jest.spyOn(require('../modules/stats/stats.service').StatsService, 'getPlatformStats').mockRejectedValueOnce(new Error('Stats Err'));
      await StatsController.getStats(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('SecurityController.logJailbreak ip address and payload branches', async () => {
      const resObj: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // 1. req.ip is falsy, req.socket.remoteAddress is truthy
      await SecurityController.logJailbreak({
        body: { payload: 'bad input', detectedType: 'SQL_INJECTION', severity: 'HIGH' },
        socket: { remoteAddress: '2.2.2.2' }
      } as any, resObj, next);
      
      // 2. req.ip and req.socket are falsy
      await SecurityController.logJailbreak({
        body: { payload: 'bad input', detectedType: 'SQL_INJECTION', severity: 'HIGH' }
      } as any, resObj, next);

      // 3. payload is an object
      (prisma.securityLog.create as jest.Mock).mockResolvedValueOnce({ id: 'log-id' });
      await SecurityController.logJailbreak({
        body: { payload: { error: 'bad' }, detectedType: 'SQL_INJECTION', severity: 'HIGH' },
        ip: '1.1.1.1'
      } as any, resObj, next);
    });

    it('ResolutionController env production simulation tests', async () => {
      const resObj: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // 1. resolveMarket simulate true
        (prisma.market.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'market-1' });
        await ResolutionController.resolveMarket({
          params: { id: 'market-1' },
          body: { winner: true, simulate: true }
        } as any, resObj, next);

        // 2. claimPayout simulate true
        await ResolutionController.claimPayout({
          params: { id: 'market-1' },
          body: { positionId: 1, simulate: true }
        } as any, resObj, next);
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('EventsController getEventByTxHash validation error branch', async () => {
      const resObj: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await EventsController.getEventByTxHash({
        params: { chainId: 'abc', txHash: '0xhash' }
      } as any, resObj, next);

      expect(resObj.status).toHaveBeenCalledWith(400);
    });

    it('LeaderboardService default parameter branches', () => {
      // 1. getDistributePayload without tokenAddress
      const payload1 = LeaderboardService.getDistributePayload(undefined, '1000', ['0xuser']);
      expect(payload1.args[0]).toBe(config.USDC_ADDRESS);

      // 2. getClaimRewardPayload without tokenAddress
      const payload2 = LeaderboardService.getClaimRewardPayload(undefined);
      expect(payload2.args[0]).toBe(config.USDC_ADDRESS);
    });

    it('AccountService default parameter branches', async () => {
      // 1. getBalance default parameters
      const balance = await AccountService.getBalance('0xwallet');
      expect(balance.unifiedBalance).toBeDefined();

      // 2. getDepositPayload default tokenAddress
      const deposit = AccountService.getDepositPayload(undefined, '100', 50);
      expect(deposit.args[0]).toBe(config.USDC_ADDRESS);

      // 3. getWithdrawPayload default tokenAddress
      const withdraw = AccountService.getWithdrawPayload(undefined, '100', false);
      expect(withdraw.args[0]).toBe(config.USDC_ADDRESS);
    });
  });
});
