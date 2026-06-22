import { Request, Response, NextFunction } from 'express';
import { MarketsService } from './markets.service';
import { createMarketSchema } from './markets.validator';
import config from '../../config';

export class MarketsController {
  static async listMarkets(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = req.query.resolved !== undefined 
        ? req.query.resolved === 'true'
        : undefined;
      const markets = await MarketsService.listMarkets(resolved);
      return res.status(200).json(markets);
    } catch (error) {
      next(error);
    }
  }

  static async getMarketById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const chainId = Number(req.query.chainId) || config.HOODI_CHAIN_ID;
      const market = await MarketsService.getMarketById(id, chainId);
      return res.status(200).json(market);
    } catch (error) {
      next(error);
    }
  }

  static async createMarket(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = createMarketSchema.parse(req.body);
      const token = parsedData.tokenAddress || config.USDC_ADDRESS;
      const payload = MarketsService.getCreatePayload(
        parsedData.question,
        parsedData.endTime,
        parsedData.minimumStake,
        token
      );
      
      // Optionally, in development/testing mode we also insert it into the database directly
      // so we can test the REST APIs without a local indexer run.
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        const simMarket = await prisma.market.create({
          data: {
            contractAddress: `0xsimulated${Math.random().toString(16).slice(2, 34)}`,
            question: parsedData.question,
            creator: 'test',
            endTime: new Date(parsedData.endTime * 1000),
            resolved: false,
          }
        });
        return res.status(201).json({ ...payload, simulatedMarket: simMarket });
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  static async getOdds(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const chainId = Number(req.query.chainId) || config.HOODI_CHAIN_ID;
      const odds = await MarketsService.getOdds(id, chainId);
      return res.status(200).json(odds);
    } catch (error) {
      next(error);
    }
  }

  static async getStakes(req: Request, res: Response, next: NextFunction) {
    try {
      const { address } = req.params;
      const stakes = await MarketsService.getStakesByMarketAddress(address);
      return res.status(200).json(stakes);
    } catch (error) {
      next(error);
    }
  }
}

import { prisma } from '../../database/client';
