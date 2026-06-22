import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import prisma from '../../database/client';
import config from '../../config';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import logger from '../../utils/logger';

export class AuthService {
  static async register(walletAddress: string, deviceId: string) {
    const wallet = walletAddress.toLowerCase();

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
    });

    if (user) {
      throw new BadRequestError('User with this wallet address already registered');
    }

    // Generate TOTP secret for the user
    const tempSecret = speakeasy.generateSecret({
      name: `SX Prediction Marketplace (${wallet.slice(0, 6)}...${wallet.slice(-4)})`,
    });

    // Create user
    user = await prisma.user.create({
      data: {
        walletAddress: wallet,
        deviceId,
        totpEnabled: false,
        totpSecret: tempSecret.base32,
      },
    });

    // Generate QR code URL
    const qrCodeDataUrl = await qrcode.toDataURL(tempSecret.otpauth_url || '');

    return {
      userId: user.id,
      walletAddress: user.walletAddress,
      totpSecret: tempSecret.base32,
      qrCode: qrCodeDataUrl,
    };
  }

  static async login(walletAddress: string, signature: string, message: string, totpCode?: string) {
    const wallet = walletAddress.toLowerCase();

    // Verify wallet signature using Ethers v6
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (err) {
      throw new BadRequestError('Invalid signature format');
    }

    if (recoveredAddress.toLowerCase() !== wallet) {
      throw new UnauthorizedError('Signature verification failed');
    }

    // Replay attack prevention: message should contain timestamp
    // Example: "Sign this message to login to SX Prediction: 2026-06-21T13:40:00Z"
    const timestampMatch = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/);
    if (!timestampMatch) {
      throw new BadRequestError('Message must contain a valid timestamp');
    }

    const messageTime = new Date(timestampMatch[0]).getTime();
    const currentTime = Date.now();
    const timeDifference = Math.abs(currentTime - messageTime);

    if (timeDifference > 5 * 60 * 1000) {
      // 5 minutes expiry
      throw new UnauthorizedError('Message expired. Nonce/timestamp is too old.');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
    });

    if (!user) {
      throw new NotFoundError('User not registered. Please register first.');
    }

    // Check TOTP
    if (user.totpEnabled) {
      if (!totpCode) {
        throw new UnauthorizedError('TOTP verification code required');
      }

      const verified = speakeasy.totp.verify({
        secret: user.totpSecret || '',
        encoding: 'base32',
        token: totpCode,
        window: 1, // Allow 1-step window deviation
      });

      if (!verified) {
        throw new UnauthorizedError('Invalid TOTP code');
      }
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        walletAddress: user.walletAddress,
        totpVerified: user.totpEnabled,
      },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        totpEnabled: user.totpEnabled,
      },
    };
  }

  static async verifyTotp(userId: string, totpCode: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.totpEnabled) {
      throw new BadRequestError('TOTP already enabled');
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret || '',
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestError('Invalid TOTP verification code');
    }

    // Enable in database
    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    // Generate updated JWT with totpVerified = true
    const token = jwt.sign(
      {
        userId: user.id,
        walletAddress: user.walletAddress,
        totpVerified: true,
      },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      token,
    };
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        committedSubAccounts: true,
        stakes: {
          include: {
            market: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}
