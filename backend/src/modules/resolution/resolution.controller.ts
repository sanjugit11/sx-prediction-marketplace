import { Request, Response, NextFunction } from 'express';
import { ResolutionService } from './resolution.service';
import prisma from '../../database/client';

export class ResolutionController {
  static async resolveMarket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { winner } = req.body;

      if (winner === undefined) {
        return res.status(400).json({ error: 'winner (boolean) is required' });
      }

      const payload = await ResolutionService.getResolvePayload(id, !!winner);

      // Handle DB simulation for testing
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        const market = await prisma.market.findFirst({
          where: {
            OR: [
              { id },
              { contractAddress: id.toLowerCase() },
            ],
          },
        });
        
        if (market) {
          await prisma.market.update({
            where: { id: market.id },
            data: { resolved: true, winner: !!winner },
          });
        }
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  static async claimPayout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // market DB id or address
      const { positionId } = req.body;

      if (positionId === undefined) {
        return res.status(400).json({ error: 'positionId is required' });
      }

      const payload = await ResolutionService.getClaimPayload(id, Number(positionId));

      // Handle DB simulation for testing
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        await prisma.stake.updateMany({
          where: { positionId: Number(positionId) },
          data: { claimed: true },
        });
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }
}
