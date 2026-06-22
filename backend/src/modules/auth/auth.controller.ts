import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema, verifyTotpSchema } from './auth.validator';
import { AuthenticatedRequest } from '../../middleware/auth';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = registerSchema.parse(req.body);
      const result = await AuthService.register(parsedData.walletAddress, parsedData.deviceId);
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = loginSchema.parse(req.body);
      const result = await AuthService.login(
        parsedData.walletAddress,
        parsedData.signature,
        parsedData.message,
        parsedData.totpCode
      );
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async verifyTotp(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const parsedData = verifyTotpSchema.parse(req.body);
      const result = await AuthService.verifyTotp(user.id, parsedData.totpCode);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await AuthService.getProfile(user.id);
      return res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }
}
