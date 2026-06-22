import { Request, Response, NextFunction } from 'express';
import prisma from '../database/client';
import logger from '../utils/logger';

const JAILBREAK_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+an\s+ai/i,
  /bypass\s+security/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /developer\s+mode\s+enabled/i,
  /override\s+rules/i,
];

const SQL_INJECTION_PATTERNS = [
  /union\s+select/i,
  /select\s+.*\s+from/i,
  /insert\s+into/i,
  /drop\s+table/i,
  /or\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
];

function scanPayload(data: any): { detected: boolean; pattern: string; type: string } | null {
  if (!data) return null;

  if (typeof data === 'string') {
    for (const pattern of JAILBREAK_PATTERNS) {
      if (pattern.test(data)) {
        return { detected: true, pattern: pattern.toString(), type: 'PROMPT_INJECTION' };
      }
    }
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(data)) {
        return { detected: true, pattern: pattern.toString(), type: 'SQL_INJECTION' };
      }
    }
  } else if (typeof data === 'object') {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const result = scanPayload(data[key]);
        if (result) return result;
      }
    }
  }
  return null;
}

export async function securityScanner(req: Request, res: Response, next: NextFunction) {
  try {
    // Scan body, query, and params
    const scanResult = 
      scanPayload(req.body) || 
      scanPayload(req.query) || 
      scanPayload(req.params);

    if (scanResult) {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const walletAddress = (req as any).user?.walletAddress || null;
      const payload = JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params,
        url: req.originalUrl,
      });

      logger.warn(`Security alert: Detected ${scanResult.type} match: ${scanResult.pattern} from IP: ${ipAddress}`);

      // Log threat to database
      await prisma.securityLog.create({
        data: {
          ipAddress,
          walletAddress,
          payload,
          detectedType: scanResult.type,
          severity: scanResult.type === 'PROMPT_INJECTION' ? 'HIGH' : 'CRITICAL',
        },
      });

      // We block suspicious inputs for security
      return res.status(400).json({
        error: 'Security validation failed',
        message: 'Suspicious payload detected',
      });
    }
  } catch (error) {
    logger.error('Security scanner error:', error);
  }
  next();
}
