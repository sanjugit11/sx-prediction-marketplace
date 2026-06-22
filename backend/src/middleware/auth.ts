import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import prisma from '../database/client';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    deviceId: string;
    totpEnabled: boolean;
  };
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new UnauthorizedError('Missing authentication token'));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      userId: string;
      walletAddress: string;
      totpVerified?: boolean;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }

    // If TOTP is enabled in the database, the JWT must contain totpVerified = true
    if (user.totpEnabled && !decoded.totpVerified) {
      return next(new ForbiddenError('TOTP verification required'));
    }

    (req as AuthenticatedRequest).user = {
      id: user.id,
      walletAddress: user.walletAddress,
      deviceId: user.deviceId,
      totpEnabled: user.totpEnabled,
    };

    next();
  } catch (error) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

// Admin / Roles authorization placeholder
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return next(new UnauthorizedError());
  }

  // Check if wallet address is admin. In this implementation, we allow configuring admin wallets,
  // or verifying on-chain role. We'll check config or let any valid logged in user perform operations in dev,
  // but we enforce a list of admin addresses. Let's make it check if the wallet is in a designated admin list
  // or matching the deployed contract creator / admin.
  // We can let config define the ADMIN wallet list.
  const adminWallets = [
    // Pre-seed some admin addresses, or allow config override
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // hardhat account 0
    config.ACCESS_CONTROL_ADDRESS,
  ].map(w => w.toLowerCase());

  if (!adminWallets.includes(user.walletAddress.toLowerCase())) {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
}
