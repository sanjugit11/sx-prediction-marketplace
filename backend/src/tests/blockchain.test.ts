// Mock ethers globally before any other imports
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');

  const mockContractInstance = {
    getUnifiedBalance: jest.fn().mockResolvedValue(100n),
    getUncommittedBalance: jest.fn().mockResolvedValue(80n),
    getCommittedBalances: jest.fn().mockResolvedValue(20n),
    getUserSubAccounts: jest.fn().mockResolvedValue([1n]),
    getAccruedYield: jest.fn().mockResolvedValue(5n),
    subAccounts: jest.fn().mockResolvedValue([
      1n, // id
      '0xtoken', // token
      '0xowner', // owner
      1000n, // principal
      1620000000n, // createdAt
      1650000000n, // maturityDate
      50n, // accruedYield
      false, // withdrawn
    ]),
    getMarkets: jest.fn().mockResolvedValue(['0xmarket1', '0xmarket2']),
    question: jest.fn().mockResolvedValue('Will BTC hit $100k?'),
    endTime: jest.fn().mockResolvedValue(1798761600n),
    minimumStake: jest.fn().mockResolvedValue(100n),
    collateralToken: jest.fn().mockResolvedValue('0xcollateral'),
    yesPool: jest.fn().mockResolvedValue(1000n),
    noPool: jest.fn().mockResolvedValue(500n),
    totalPool: jest.fn().mockResolvedValue(1500n),
    resolved: jest.fn().mockResolvedValue(false),
    winningOutcome: jest.fn().mockResolvedValue(true),
    getOdds: jest.fn().mockResolvedValue(1800000000000000000n),
    getPosition: jest.fn().mockResolvedValue([
      1n, // id
      '0xowner', // owner
      true, // outcome
      100n, // amount
      1500000000000000000n, // oddsAtEntry
      1620000000n, // createdAt
      false, // claimed
    ]),
    getUserPositions: jest.fn().mockResolvedValue([1n, 2n]),
    getUserStats: jest.fn().mockResolvedValue([10n, 8n, 1000n]),
    getAccuracy: jest.fn().mockResolvedValue(80n),
    getAllUsers: jest.fn().mockResolvedValue(['0xuser1', '0xuser2']),
    claimableRewards: jest.fn().mockResolvedValue(500n),
    listings: jest.fn().mockResolvedValue([
      1n, // id
      '0xseller', // seller
      '0xmarket', // market
      2n, // positionId
      500n, // price
      true, // active
    ]),
  };

  const mockJsonRpcProvider = jest.fn().mockImplementation(() => ({
    getBlockNumber: jest.fn().mockResolvedValue(12345),
  }));

  const mockContract = jest.fn().mockImplementation(() => mockContractInstance);

  const mockedEthers = {
    ...original.ethers,
    JsonRpcProvider: mockJsonRpcProvider,
    Contract: mockContract,
  };

  return {
    ...original,
    ethers: mockedEthers,
    JsonRpcProvider: mockJsonRpcProvider,
    Contract: mockContract,
  };
});

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

// Mock bullmq
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));

import BlockchainService, { retryCall } from '../blockchain/blockchain.service';

describe('Blockchain Service Tests', () => {
  const mockWallet = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
  const mockToken = '0xusdc';
  const mockMarketAddress = '0xmarketAddress';

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retryCall helper', () => {
    it('should resolve immediately if call succeeds', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const res = await retryCall(fn);
      expect(res).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually throw if all fail', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('rpc error'));
      await expect(retryCall(fn, 2, 10)).rejects.toThrow('rpc error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial call + 2 retries
    });
  });

  it('should get JSON RPC provider for correct chainId', () => {
    const provider1 = BlockchainService.getProvider(82008);
    expect(provider1).toBeDefined();
    // Test base sepolia provider path (fallback chainId check)
    const provider2 = BlockchainService.getProvider(84532);
    expect(provider2).toBeDefined();
  });

  it('should instantiate various contracts correctly', () => {
    expect(BlockchainService.getSXUAContract(82008)).toBeDefined();
    expect(BlockchainService.getFactoryContract(82008)).toBeDefined();
    expect(BlockchainService.getLeaderboardContract(82008)).toBeDefined();
    expect(BlockchainService.getResolutionManagerContract(82008)).toBeDefined();
    expect(BlockchainService.getMarketplaceContract(82008)).toBeDefined();
    expect(BlockchainService.getMarketContract('0xmarket', 82008)).toBeDefined();
  });

  describe('SXUAService', () => {
    it('should query balances and subaccounts correctly', async () => {
      const unified = await BlockchainService.SXUAService.getUnifiedBalance(mockWallet, mockToken, 82008);
      const uncommitted = await BlockchainService.SXUAService.getUncommittedBalance(mockWallet, mockToken, 82008);
      const committed = await BlockchainService.SXUAService.getCommittedBalances(mockWallet, mockToken, 82008);
      const subAccounts = await BlockchainService.SXUAService.getUserSubAccounts(mockWallet, 82008);
      const yieldAmt = await BlockchainService.SXUAService.getAccruedYield(mockWallet, 1, 82008);
      const details = await BlockchainService.SXUAService.getSubAccountDetails(1, 82008);

      expect(unified).toBe(100n);
      expect(uncommitted).toBe(80n);
      expect(committed).toBe(20n);
      expect(subAccounts).toEqual([1n]);
      expect(yieldAmt).toBe(5n);
      expect(details.owner).toBe('0xowner');
    });
  });

  describe('FactoryService', () => {
    it('should query list of markets correctly', async () => {
      const markets = await BlockchainService.FactoryService.getMarkets(82008);
      expect(markets).toEqual(['0xmarket1', '0xmarket2']);
    });
  });

  describe('MarketService', () => {
    it('should query market details, odds, and positions', async () => {
      const details = await BlockchainService.MarketService.getMarketDetails(mockMarketAddress, 82008);
      const odds = await BlockchainService.MarketService.getOdds(mockMarketAddress, true, 82008);
      const pos = await BlockchainService.MarketService.getPosition(mockMarketAddress, 1, 82008);
      const userPos = await BlockchainService.MarketService.getUserPositions(mockMarketAddress, mockWallet, 82008);

      expect(details.question).toBe('Will BTC hit $100k?');
      expect(odds).toBe(1800000000000000000n);
      expect(pos.owner).toBe('0xowner');
      expect(userPos).toEqual([1n, 2n]);
    });
  });

  describe('LeaderboardService', () => {
    it('should query accuracy, stats, and rewards', async () => {
      const stats = await BlockchainService.LeaderboardService.getUserStats(mockWallet, 82008);
      const acc = await BlockchainService.LeaderboardService.getAccuracy(mockWallet, 82008);
      const users = await BlockchainService.LeaderboardService.getAllUsers(82008);
      const reward = await BlockchainService.LeaderboardService.getClaimableRewards(mockWallet, mockToken, 82008);

      expect(stats.totalPredictions).toBe(10);
      expect(acc).toBe(80n);
      expect(users).toEqual(['0xuser1', '0xuser2']);
      expect(reward).toBe(500n);
    });
  });

  describe('MarketplaceService', () => {
    it('should query listing details correctly', async () => {
      const details = await BlockchainService.MarketplaceService.getListingDetails(1, 82008);
      expect(details.seller).toBe('0xseller');
      expect(details.active).toBe(true);
    });
  });
});
