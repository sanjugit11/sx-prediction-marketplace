import { Request, Response, NextFunction } from 'express';
import { EventsService } from './events.service';

export class EventsController {
  static async queryEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { eventName, market, wallet, chainId } = req.query;

      const filters: any = {};
      if (eventName) filters.eventName = eventName as string;
      if (market) filters.market = market as string;
      if (wallet) filters.wallet = wallet as string;
      if (chainId) filters.chainId = Number(chainId);

      const events = await EventsService.queryEvents(filters);
      return res.status(200).json(events);
    } catch (error) {
      next(error);
    }
  }

  static async getEventByTxHash(req: Request, res: Response, next: NextFunction) {
    try {
      const chainId = Number(req.params.chainId);
      const { txHash } = req.params;

      if (isNaN(chainId) || !txHash) {
        return res.status(400).json({ error: 'chainId (number) and txHash are required' });
      }

      const event = await EventsService.getEventByTxHash(chainId, txHash);
      return res.status(200).json(event);
    } catch (error) {
      next(error);
    }
  }
}
