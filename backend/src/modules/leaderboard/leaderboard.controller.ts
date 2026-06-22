import { Request, Response, NextFunction } from 'express';
import { LeaderboardService } from './leaderboard.service';
import { leaderboardUpdateQueue, rewardDistributionQueue } from '../../queues/queue.setup';
import config from '../../config';

export class LeaderboardController {
  static async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const rankings = await LeaderboardService.getLeaderboard();
      return res.status(200).json(rankings);
    } catch (error) {
      next(error);
    }
  }

  static async distributeRewards(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.body.token || config.USDC_ADDRESS;
      const { totalPool, topUsers } = req.body;

      if (!totalPool || !topUsers || !Array.isArray(topUsers)) {
        return res.status(400).json({ error: 'totalPool and topUsers (array) are required' });
      }

      const payload = LeaderboardService.getDistributePayload(token, totalPool, topUsers);

      // In test/dev simulate distribution via queues
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        await rewardDistributionQueue.add('simulated-distribution', {
          token,
          totalPool,
          topUsers,
        });
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  static async claimReward(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.body.token || config.USDC_ADDRESS;
      const payload = LeaderboardService.getClaimRewardPayload(token);
      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  // Trigger manual recalculation (Operator utility)
  static async recalculate(req: Request, res: Response, next: NextFunction) {
    try {
      await leaderboardUpdateQueue.add('manual-recalculate', {});
      return res.status(202).json({ message: 'Leaderboard recalculation triggered' });
    } catch (error) {
      next(error);
    }
  }
}
