import { Request, Response, NextFunction } from 'express';
import { StatsService } from './stats.service';

export class StatsController {
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await StatsService.getPlatformStats();
      return res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }
}
