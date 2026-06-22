import { Request, Response, NextFunction } from 'express';
import { StakingService } from './staking.service';
import prisma from '../../database/client';

export class StakingController {
  static async stake(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // market DB id or address
      const { outcome, amount } = req.body;

      if (outcome === undefined || !amount) {
        return res.status(400).json({ error: 'outcome and amount are required' });
      }

      const market = await prisma.market.findFirst({
        where: {
          OR: [
            { id },
            { contractAddress: id.toLowerCase() },
          ],
        },
      });

      if (!market) {
        return res.status(404).json({ error: 'Market not found' });
      }

      const payload = StakingService.getStakePayload(market.contractAddress, !!outcome, amount);

      // Handle local DB simulation for testing
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        const userWallet = req.body.userWallet || '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
        let user = await prisma.user.findUnique({ where: { walletAddress: userWallet.toLowerCase() } });
        if (!user) {
          user = await prisma.user.create({ data: { walletAddress: userWallet.toLowerCase(), deviceId: 'test' } });
        }

        const simStake = await prisma.stake.create({
          data: {
            positionId: Math.floor(Math.random() * 1000000),
            marketId: market.id,
            userId: user.id,
            outcome: !!outcome,
            amount: amount,
            oddsAtEntry: '2.0',
            claimed: false,
          }
        });
        return res.status(201).json({ ...payload, simulatedStake: simStake });
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  static async getUserPositions(req: Request, res: Response, next: NextFunction) {
    try {
      const { wallet } = req.params;
      const positions = await StakingService.getUserPositions(wallet);
      return res.status(200).json(positions);
    } catch (error) {
      next(error);
    }
  }
}
