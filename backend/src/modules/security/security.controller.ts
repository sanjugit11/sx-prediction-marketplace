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

  static async exportLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'json';
      
      const logs = await prisma.securityLog.findMany({
        orderBy: { timestamp: 'desc' },
      });

      if (format.toLowerCase() === 'csv') {
        const header = 'id,ipAddress,walletAddress,payload,detectedType,severity,timestamp\n';
        const csvRows = logs.map(log => {
          const payloadStr = log.payload ? log.payload.replace(/"/g, '""') : '';
          return `${log.id},${log.ipAddress || ''},${log.walletAddress || ''},"${payloadStr}",${log.detectedType},${log.severity},${log.timestamp.toISOString()}`;
        });
        const csvString = header + csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="jailbreak_logs.csv"');
        return res.status(200).send(csvString);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="jailbreak_logs.json"');
        return res.status(200).send(JSON.stringify(logs, null, 2));
      }
    } catch (error) {
      next(error);
    }
  }
}
