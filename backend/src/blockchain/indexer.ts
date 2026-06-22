import { ethers } from 'ethers';
import prisma from '../database/client';
import BlockchainService from './blockchain.service';
import config from '../config';
import { eventProcessingQueue, reorgRecoveryQueue } from '../queues/queue.setup';
import logger from '../utils/logger';
import {
  SXUA_ABI,
  FACTORY_ABI,
  PREDICTION_MARKET_ABI,
  LEADERBOARD_ABI,
  RESOLUTION_MANAGER_ABI,
  MARKETPLACE_ABI,
} from './abis';

export class BlockIndexer {
  private chainId: number;
  private provider: ethers.JsonRpcProvider;
  private isScanning = false;
  
  // Keep last 50 block hashes in memory to detect reorgs quickly
  private blockHashCache: Map<number, string> = new Map();

  // Combined interface for decoding logs from any contract
  private contractInterface: ethers.Interface;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.provider = BlockchainService.getProvider(chainId);

    // Build unified interface to decode any log
    this.contractInterface = new ethers.Interface([
      ...SXUA_ABI,
      ...FACTORY_ABI,
      ...PREDICTION_MARKET_ABI,
      ...LEADERBOARD_ABI,
      ...RESOLUTION_MANAGER_ABI,
      ...MARKETPLACE_ABI,
    ]);
  }

  // Get list of contract addresses to index logs from
  private async getActiveAddresses(): Promise<string[]> {
    const addresses = [
      config.SXUA_ADDRESS.toLowerCase(),
      config.FACTORY_ADDRESS.toLowerCase(),
      config.LEADERBOARD_ADDRESS.toLowerCase(),
      config.RESOLUTION_MANAGER_ADDRESS.toLowerCase(),
      config.MARKETPLACE_ADDRESS.toLowerCase(),
    ];

    // Fetch dynamically created market contract addresses from DB
    const markets = await prisma.market.findMany({
      select: { contractAddress: true },
    });
    
    for (const m of markets) {
      addresses.push(m.contractAddress.toLowerCase());
    }

    return addresses;
  }

  async start() {
    logger.info(`Starting block indexer for chain ${this.chainId}...`);
    
    // Periodically scan blocks
    setInterval(async () => {
      if (this.isScanning) return;
      try {
        await this.scan();
      } catch (err) {
        logger.error(`Error in scan loop for chain ${this.chainId}:`, err);
      }
    }, 10000); // scan every 10 seconds
  }

  private async scan() {
    this.isScanning = true;
    try {
      // Get sync status
      let syncStatus = await prisma.syncStatus.findUnique({
        where: { chainId: this.chainId },
      });

      const currentBlock = await this.provider.getBlockNumber();

      if (!syncStatus) {
        // Start scanning from current block - 20, or config value
        syncStatus = await prisma.syncStatus.create({
          data: {
            chainId: this.chainId,
            lastProcessedBlock: currentBlock - 20,
          },
        });
      }

      let fromBlock = syncStatus.lastProcessedBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 49); // batch scan 50 blocks max at a time

      if (fromBlock > toBlock) {
        this.isScanning = false;
        return;
      }

      logger.info(`Scanning chain ${this.chainId} from block ${fromBlock} to ${toBlock}...`);

      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        const block = await this.provider.getBlock(blockNum);
        if (!block) continue;

        // --- Reorg Detection ---
        const prevBlockNum = blockNum - 1;
        const cachedParentHash = this.blockHashCache.get(prevBlockNum);

        if (cachedParentHash && block.parentHash !== cachedParentHash) {
          logger.warn(`Chain reorganization detected on chain ${this.chainId} at block ${blockNum}!`);
          logger.warn(`Expected parent hash: ${cachedParentHash}, got: ${block.parentHash}`);

          // Trace back to find the fork point
          let forkBlock = prevBlockNum;
          while (forkBlock > fromBlock - 20) {
            const rpcBlock = await this.provider.getBlock(forkBlock);
            const dbEvent = await prisma.event.findFirst({
              where: { chainId: this.chainId, blockNumber: forkBlock },
            });
            if (rpcBlock && dbEvent && rpcBlock.hash === dbEvent.transactionHash) {
              // Found match
              break;
            }
            forkBlock--;
          }

          // Trigger recovery
          await reorgRecoveryQueue.add(`reorg-${this.chainId}-${blockNum}`, {
            chainId: this.chainId,
            blockNumber: forkBlock,
            oldHash: cachedParentHash,
            newHash: block.parentHash,
          });

          // Stop scanning this chain, wait for reorg recovery job to finish
          this.isScanning = false;
          return;
        }

        // Cache the current block hash
        this.blockHashCache.set(blockNum, block.hash || '');
        if (this.blockHashCache.size > 100) {
          // Keep cache size bounded
          const oldestKey = Math.min(...this.blockHashCache.keys());
          this.blockHashCache.delete(oldestKey);
        }

        // --- Scan Logs in the block ---
        const addresses = await this.getActiveAddresses();
        const logs = await this.provider.getLogs({
          fromBlock: blockNum,
          toBlock: blockNum,
          address: addresses,
        });

        for (const log of logs) {
          try {
            const decoded = this.contractInterface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });

            if (decoded) {
              const eventName = decoded.name;
              
              // Extract event parameters
              const eventData: { [key: string]: any } = {};
              decoded.fragment.inputs.forEach((input, index) => {
                let val = decoded.args[index];
                if (typeof val === 'bigint') {
                  val = val.toString(); // Serialize BigInt to string for JSON storage
                }
                eventData[input.name] = val;
              });

              // Add job to processing queue
              await eventProcessingQueue.add(`${this.chainId}-${eventName}-${log.transactionHash}`, {
                eventName,
                contractAddress: log.address.toLowerCase(),
                chainId: this.chainId,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
                logIndex: log.index,
                eventData,
                timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
              });
            }
          } catch (decodeErr) {
            // Ethers parseLog throws if log doesn't match ABI (can happen for unrelated transfer events)
            // Log indexing error only if it was a target transaction we failed to parse
            logger.debug(`Skipping unparseable log at tx ${log.transactionHash}: ${decodeErr}`);
          }
        }

        // Update sync checkpoint in DB
        await prisma.syncStatus.update({
          where: { chainId: this.chainId },
          data: { lastProcessedBlock: blockNum },
        });
      }
    } catch (err) {
      logger.error(`Indexer scanning failed on chain ${this.chainId}:`, err);
      // Log to indexing_errors table
      await prisma.indexingError.create({
        data: {
          chainId: this.chainId,
          txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          error: err instanceof Error ? err.stack || err.message : String(err),
        },
      });
    } finally {
      this.isScanning = false;
    }
  }
}
