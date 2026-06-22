// Mock ioredis before importing app/queues
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

import { BlockIndexer } from '../blockchain/indexer';
import prisma from '../database/client';
import BlockchainService from '../blockchain/blockchain.service';
import { eventProcessingQueue, reorgRecoveryQueue } from '../queues/queue.setup';

jest.mock('../database/client', () => ({
  syncStatus: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  market: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  indexingError: {
    create: jest.fn(),
  },
  event: {
    findFirst: jest.fn(),
  },
}));

jest.mock('../blockchain/blockchain.service', () => ({
  getProvider: jest.fn(),
}));

jest.mock('../queues/queue.setup', () => ({
  eventProcessingQueue: {
    add: jest.fn(),
  },
  reorgRecoveryQueue: {
    add: jest.fn(),
  },
}));

describe('BlockIndexer Tests', () => {
  let providerMock: any;
  let indexer: BlockIndexer;

  beforeEach(() => {
    providerMock = {
      getBlockNumber: jest.fn().mockResolvedValue(100),
      getBlock: jest.fn().mockResolvedValue({
        number: 100,
        hash: '0xblock100hash',
        parentHash: '0xblock99hash',
        timestamp: 1620000000,
      }),
      getLogs: jest.fn().mockResolvedValue([]),
    };
    (BlockchainService.getProvider as jest.Mock).mockReturnValue(providerMock);
    
    // Instantiate indexer for chain ID 82008
    indexer = new BlockIndexer(82008);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should run scanner and index logs', async () => {
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 99,
    });

    // Run one tick of scan (private method but we can call using type bypass)
    await (indexer as any).scan();

    expect(providerMock.getBlockNumber).toHaveBeenCalled();
    expect(providerMock.getBlock).toHaveBeenCalledWith(100);
    expect(providerMock.getLogs).toHaveBeenCalled();
    expect(prisma.syncStatus.update).toHaveBeenCalledWith({
      where: { chainId: 82008 },
      data: { lastProcessedBlock: 100 },
    });
  });

  it('should detect block reorg and trigger reorg recovery job', async () => {
    // 1. First scan sets the cache for block 99
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 98,
    });
    
    providerMock.getBlock.mockImplementation((blockNum: number) => {
      if (blockNum === 99) {
        return Promise.resolve({
          number: 99,
          hash: '0xblock99hash',
          parentHash: '0xblock98hash',
          timestamp: 1620000000,
        });
      }
      if (blockNum === 100) {
        return Promise.resolve({
          number: 100,
          hash: '0xblock100hash',
          parentHash: '0xblock99mismatch', // Parent hash mismatch!
          timestamp: 1620000100,
        });
      }
      return Promise.resolve({
        number: blockNum,
        hash: `0xblock${blockNum}hash`,
        parentHash: `0xblock${blockNum-1}hash`,
        timestamp: 1620000000 + blockNum,
      });
    });

    // Scan block 99
    await (indexer as any).scan();

    // Now scanner starts from block 100. It will check if parentHash is 0xblock99hash
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 99,
    });

    // Mock search for fork point
    (prisma.event.findFirst as jest.Mock).mockResolvedValue({
      transactionHash: '0xblock99hash',
    });

    await (indexer as any).scan();

    // Reorg recovery queue should be added to
    expect(reorgRecoveryQueue.add).toHaveBeenCalled();
  });

  it('should handle scan errors and create indexing error logs', async () => {
    const scanError = new Error('Database connection failed');
    (prisma.syncStatus.findUnique as jest.Mock).mockRejectedValue(scanError);

    await (indexer as any).scan();

    expect(prisma.indexingError.create).toHaveBeenCalledWith({
      data: {
        chainId: 82008,
        txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        error: expect.stringContaining('Database connection failed'),
      },
    });
  });

  it('should start scan loop interval', async () => {
    jest.useFakeTimers();
    const scanSpy = jest.spyOn(indexer as any, 'scan').mockResolvedValue(undefined);

    await indexer.start();
    jest.advanceTimersByTime(10000);

    expect(scanSpy).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('should retrieve active addresses including markets from DB', async () => {
    (prisma.market.findMany as jest.Mock).mockResolvedValue([
      { contractAddress: '0xmarketAddr1' },
      { contractAddress: '0xmarketAddr2' },
    ]);

    const addresses = await (indexer as any).getActiveAddresses();
    expect(addresses).toContain('0xmarketaddr1');
    expect(addresses).toContain('0xmarketaddr2');
  });

  it('should handle unparseable logs without crashing', async () => {
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 99,
    });

    providerMock.getLogs.mockResolvedValue([
      {
        address: '0xcontractAddress',
        topics: ['0xunrelatedTopic'],
        data: '0x',
        transactionHash: '0xtxhash',
        blockNumber: 100,
        index: 0,
      },
    ]);

    await (indexer as any).scan();
    expect(prisma.syncStatus.update).toHaveBeenCalled();
  });

  it('should decode logs and add them to the processing queue', async () => {
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 99,
    });

    providerMock.getLogs.mockResolvedValue([
      {
        address: '0xcontractAddress',
        topics: ['0xtopic'],
        data: '0x',
        transactionHash: '0xtxhash',
        blockNumber: 100,
        index: 0,
      },
    ]);

    jest.spyOn((indexer as any).contractInterface, 'parseLog').mockReturnValue({
      name: 'MarketCreated',
      fragment: {
        inputs: [
          { name: 'marketAddress' },
          { name: 'question' },
          { name: 'endTime' },
          { name: 'creator' },
        ],
      },
      args: ['0xmarket', 'Is it hot?', 1800000000n, '0xcreator'],
    } as any);

    await (indexer as any).scan();

    expect(eventProcessingQueue.add).toHaveBeenCalledWith(
      expect.stringContaining('82008-MarketCreated-0xtxhash'),
      expect.objectContaining({
        eventName: 'MarketCreated',
        contractAddress: '0xcontractaddress',
        chainId: 82008,
        transactionHash: '0xtxhash',
        blockNumber: 100,
        eventData: {
          marketAddress: '0xmarket',
          question: 'Is it hot?',
          endTime: '1800000000',
          creator: '0xcreator',
        },
      })
    );
  });

  it('should evict oldest key from block hash cache when size exceeds 100', async () => {
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 99,
    });

    const cache = (indexer as any).blockHashCache;
    for (let i = 0; i < 105; i++) {
      cache.set(i, i === 99 ? '0xblock99hash' : `hash-${i}`);
    }

    await (indexer as any).scan();

    expect(cache.has(0)).toBe(false);
    expect(cache.size).toBe(104);
  });

  it('should handle log decoding errors and log debug message', async () => {
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 99,
    });

    providerMock.getLogs.mockResolvedValue([
      {
        address: '0xcontractAddress',
        topics: ['0xtopic'],
        data: '0x',
        transactionHash: '0xtxhash',
        blockNumber: 100,
        index: 0,
      },
    ]);

    jest.spyOn((indexer as any).contractInterface, 'parseLog').mockImplementationOnce(() => {
      throw new Error('decoding failed');
    });

    await (indexer as any).scan();
    expect(prisma.syncStatus.update).toHaveBeenCalled();
  });

  it('should handle start interval scans', async () => {
    jest.useFakeTimers();
    const mockScan = jest.spyOn(indexer as any, 'scan').mockRejectedValueOnce(new Error('Scan failed'));
    const loggerSpy = jest.spyOn(require('../utils/logger').default, 'error').mockImplementation(() => {});
    
    indexer.start();
    
    await jest.advanceTimersByTimeAsync(10000);
    
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Error in scan loop'), expect.any(Error));
    loggerSpy.mockRestore();
    mockScan.mockRestore();
    jest.useRealTimers();
  });

  it('should create syncStatus if not exists', async () => {
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.syncStatus.create as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 80,
    });

    await (indexer as any).scan();

    expect(prisma.syncStatus.create).toHaveBeenCalled();
  });

  it('should return early if fromBlock > toBlock', async () => {
    (prisma.syncStatus.findUnique as jest.Mock).mockResolvedValue({
      chainId: 82008,
      lastProcessedBlock: 100,
    });
    providerMock.getBlockNumber.mockResolvedValue(100);

    await (indexer as any).scan();

    expect(providerMock.getBlock).not.toHaveBeenCalled();
  });
});
