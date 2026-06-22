import { Request, Response, NextFunction } from 'express';
import prisma from '../../database/client';

export class SecurityController {
  static async logJailbreak(req: Request, res: Response, next: NextFunction) {
    try {
      const { walletAddress, payload, detectedType, severity } = req.body;

      if (!payload || !detectedType || !severity) {
        return res.status(400).json({ error: 'payload, detectedType, and severity are required' });
      }

      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      const securityLog = await prisma.securityLog.create({
        data: {
          ipAddress,
          walletAddress: walletAddress ? walletAddress.toLowerCase() : null,
          payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
          detectedType,
          severity,
        },
      });

      return res.status(201).json(securityLog);
    } catch (error) {
      next(error);
    }
  }

  static async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const severity = req.query.severity as string;
      const whereClause: any = {};
      
      if (severity) {
        whereClause.severity = severity;
      }

      const logs = await prisma.securityLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: 100, // limit to latest 100 logs
      });

      return res.status(200).json(logs);
    } catch (error) {
      next(error);
    }
  }
}
