import { Request, Response } from 'express';
import prisma from '../../database/client';
import { redisConnection } from '../../queues/queue.setup';
import BlockchainService from '../../blockchain/blockchain.service';
import config from '../../config';

export class HealthController {
  static async getHealth(req: Request, res: Response) {
    const healthStatus: any = {
      status: 'UP',
      database: false,
      redis: false,
      hoodiRpc: false,
      baseRpc: false,
      indexer: {},
    };

    // 1. Check PostgreSQL Database
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthStatus.database = true;
    } catch (err) {
      healthStatus.status = 'DEGRADED';
    }

    // 2. Check Redis connection
    try {
      const ping = await redisConnection.ping();
      if (ping === 'PONG') {
        healthStatus.redis = true;
      }
    } catch (err) {
      healthStatus.status = 'DEGRADED';
    }

    // 3. Check Hoodi RPC connection
    try {
      const hoodiProvider = BlockchainService.getProvider(config.HOODI_CHAIN_ID);
      const height = await hoodiProvider.getBlockNumber();
      if (height > 0) {
        healthStatus.hoodiRpc = true;
        healthStatus.indexer.hoodiCurrentBlock = height;
      }
    } catch (err) {
      healthStatus.status = 'DEGRADED';
    }

    // 4. Check Base Sepolia RPC connection
    try {
      const baseProvider = BlockchainService.getProvider(config.BASE_SEPOLIA_CHAIN_ID);
      const height = await baseProvider.getBlockNumber();
      if (height > 0) {
        healthStatus.baseRpc = true;
        healthStatus.indexer.baseCurrentBlock = height;
      }
    } catch (err) {
      healthStatus.status = 'DEGRADED';
    }

    // 5. Get Indexer Checkpoints from DB
    try {
      const checkpoints = await prisma.syncStatus.findMany();
      checkpoints.forEach((cp) => {
        const chainName = cp.chainId === config.HOODI_CHAIN_ID ? 'hoodiIndexedBlock' : 'baseIndexedBlock';
        healthStatus.indexer[chainName] = cp.lastProcessedBlock;
      });
    } catch (err) {
      // ignore
    }

    const statusCode = healthStatus.status === 'UP' ? 200 : 503;
    return res.status(statusCode).json(healthStatus);
  }
}
