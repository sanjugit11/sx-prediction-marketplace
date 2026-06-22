import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { ethers } from 'ethers';

// Mock ioredis before importing app/queues
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

// Mock bullmq to prevent queue connection attempts
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
    })),
  };
});

import app from '../app';
import prisma from '../database/client';
import config from '../config';
import { AuthController } from '../modules/auth/auth.controller';

// Mock database client
jest.mock('../database/client', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  securityLog: {
    create: jest.fn(),
  },
}));

// Mock ethers
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    ethers: {
      ...original.ethers,
      verifyMessage: jest.fn(),
    },
  };
});

describe('Auth Controller Tests', () => {
  const mockUser = {
    id: 'user-uuid-123',
    walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    deviceId: 'test-device',
    totpEnabled: false,
    totpSecret: 'MOCKSECRETBASE32',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          walletAddress: mockUser.walletAddress,
          deviceId: mockUser.deviceId,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('totpSecret');
      expect(res.body).toHaveProperty('qrCode');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should fail if user already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          walletAddress: mockUser.walletAddress,
          deviceId: mockUser.deviceId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('User with this wallet address already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    const loginPayload = {
      walletAddress: mockUser.walletAddress,
      signature: '0xmocksignature',
      message: 'Sign this message to login to SX Prediction: 2026-06-21T13:40:00Z',
    };

    beforeEach(() => {
      // Stub time so that signature isn't expired (2026-06-21T13:40:00Z is 1771594800000)
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-21T13:42:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should log in a user and return a JWT', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(mockUser.walletAddress);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.id).toBe(mockUser.id);
    });

    it('should fail login if signature does not match', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue('0xwrongwallet');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginPayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Signature verification failed');
    });

    it('should fail if TOTP code is required but missing', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(mockUser.walletAddress);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        totpEnabled: true,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginPayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('TOTP verification code required');
    });
  });

  describe('POST /api/auth/login edge cases', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-21T13:42:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should fail if message does not contain timestamp', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(mockUser.walletAddress);
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          walletAddress: mockUser.walletAddress,
          signature: '0xmocksignature',
          message: 'Sign this message without time',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message must contain a valid timestamp');
    });

    it('should fail if signature timestamp is too old', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(mockUser.walletAddress);
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          walletAddress: mockUser.walletAddress,
          signature: '0xmocksignature',
          message: 'Sign this message: 2026-06-21T13:30:00Z', // 12 mins old
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Message expired. Nonce/timestamp is too old.');
    });

    it('should fail if user is not registered', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(mockUser.walletAddress);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          walletAddress: mockUser.walletAddress,
          signature: '0xmocksignature',
          message: 'Sign this message to login to SX Prediction: 2026-06-21T13:40:00Z',
        });
      expect(res.status).toBe(404);
    });

    it('should fail if TOTP code is incorrect', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(mockUser.walletAddress);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        totpEnabled: true,
      });
      jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          walletAddress: mockUser.walletAddress,
          signature: '0xmocksignature',
          message: 'Sign this message to login to SX Prediction: 2026-06-21T13:40:00Z',
          totpCode: '000000',
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid TOTP code');
    });
  });

  describe('POST /api/auth/verify', () => {
    const token = jwt.sign(
      { userId: mockUser.id, walletAddress: mockUser.walletAddress, totpVerified: true },
      config.JWT_SECRET
    );

    it('should verify and enable TOTP', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        totpEnabled: true,
      });

      jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(true);

      const res = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ totpCode: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should fail if TOTP is already enabled', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        totpEnabled: true,
      });

      const res = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ totpCode: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('TOTP already enabled');
    });

    it('should fail if TOTP code verification fails', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(false);

      const res = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ totpCode: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid TOTP verification code');
    });
  });

  describe('GET /api/auth/profile', () => {
    const token = jwt.sign(
      { userId: mockUser.id, walletAddress: mockUser.walletAddress },
      config.JWT_SECRET
    );

    it('should fetch user profile details successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        committedSubAccounts: [],
        stakes: [],
      });

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockUser.id);
    });

    it('should return 404 if user not found', async () => {
      // First call (middleware check) returns a valid user
      // Second call (service check) returns null
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Auth Service Extra Edge Cases', () => {
    it('should fail with BadRequestError on invalid signature format', async () => {
      (ethers.verifyMessage as jest.Mock).mockImplementationOnce(() => {
        throw new Error('ethers error');
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          walletAddress: mockUser.walletAddress,
          signature: 'invalid-sig',
          message: 'Sign this message to login to SX Prediction: 2026-06-21T13:40:00Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid signature format');
    });

    it('should fail verifyTotp if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser) // for middleware
        .mockResolvedValueOnce(null); // for service

      const token = jwt.sign(
        { userId: mockUser.id, walletAddress: mockUser.walletAddress, totpVerified: true },
        config.JWT_SECRET
      );

      const res = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ totpCode: '123456' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });
  });

  describe('AuthController direct calls', () => {
    it('should return 401 in verifyTotp if user is missing', async () => {
      const req: any = {};
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();
      await AuthController.verifyTotp(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 in getProfile if user is missing', async () => {
      const req: any = {};
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();
      await AuthController.getProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
