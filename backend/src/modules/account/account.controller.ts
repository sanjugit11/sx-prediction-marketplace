import { Request, Response, NextFunction } from 'express';
import { AccountService } from './account.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import config from '../../config';

export class AccountController {
  static async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const token = (req.query.token as string) || config.USDC_ADDRESS;
      const chainId = Number(req.query.chainId) || config.HOODI_CHAIN_ID;

      const balance = await AccountService.getBalance(user.walletAddress, token, chainId);
      return res.status(200).json(balance);
    } catch (error) {
      next(error);
    }
  }

  static async deposit(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.body.token || config.USDC_ADDRESS;
      const { amount, committedPercentage } = req.body;

      if (!amount || committedPercentage === undefined) {
        return res.status(400).json({ error: 'amount and committedPercentage are required' });
      }

      const payload = AccountService.getDepositPayload(token, amount, Number(committedPercentage));
      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.body.token || config.USDC_ADDRESS;
      const { amount, isCommitted, subAccountId } = req.body;

      if (isCommitted && subAccountId === undefined) {
        return res.status(400).json({ error: 'subAccountId is required for committed withdrawal' });
      }
      if (!isCommitted && !amount) {
        return res.status(400).json({ error: 'amount is required for uncommitted withdrawal' });
      }

      const payload = AccountService.getWithdrawPayload(token, amount, !!isCommitted, subAccountId);
      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }
}
