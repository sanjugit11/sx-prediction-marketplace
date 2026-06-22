import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import swaggerSpec from './swagger/swagger';
import { authenticateToken, requireAdmin } from './middleware/auth';
import { standardRateLimiter, authRateLimiter } from './middleware/rateLimiter';
import { securityScanner } from './middleware/security';
import { HttpError } from './utils/errors';
import logger from './utils/logger';

// Import controllers
import { AuthController } from './modules/auth/auth.controller';
import { AccountController } from './modules/account/account.controller';
import { MarketsController } from './modules/markets/markets.controller';
import { StakingController } from './modules/staking/staking.controller';
import { ResolutionController } from './modules/resolution/resolution.controller';
import { LeaderboardController } from './modules/leaderboard/leaderboard.controller';
import { MarketplaceController } from './modules/marketplace/marketplace.controller';
import { EventsController } from './modules/events/events.controller';
import { StatsController } from './modules/stats/stats.controller';
import { HealthController } from './modules/health/health.controller';
import { SecurityController } from './modules/security/security.controller';

const app = express();

// Standard middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Log HTTP requests
app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) }
}));

// Apply global security input scanner
app.use(securityScanner);

// Swagger UI Route
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health route (no rate limiting for uptime checkers)
app.get('/api/health', HealthController.getHealth);

// Apply rate limiter to other routes
app.use('/api/', standardRateLimiter);

// --- API Routes ---

// Auth Module
app.post('/api/auth/register', authRateLimiter, AuthController.register);
app.post('/api/auth/login', authRateLimiter, AuthController.login);
app.post('/api/auth/verify', authenticateToken, AuthController.verifyTotp);
app.get('/api/auth/profile', authenticateToken, AuthController.getProfile);

// Account Module
app.get('/api/account/balance', authenticateToken, AccountController.getBalance);
app.post('/api/account/deposit', authenticateToken, AccountController.deposit);
app.post('/api/account/withdraw', authenticateToken, AccountController.withdraw);

// Markets Module
app.get('/api/markets', MarketsController.listMarkets);
app.get('/api/markets/:id', MarketsController.getMarketById);
app.post('/api/markets/create', authenticateToken, MarketsController.createMarket);
app.get('/api/markets/:id/odds', MarketsController.getOdds);
app.get('/api/markets/:address/stakes', MarketsController.getStakes);

// Staking Module
app.post('/api/markets/:id/stake', authenticateToken, StakingController.stake);
app.get('/api/users/:wallet/positions', StakingController.getUserPositions);

// Resolution Module
app.post('/api/markets/:id/resolve', authenticateToken, requireAdmin, ResolutionController.resolveMarket);
app.post('/api/markets/:id/claim', ResolutionController.claimPayout);

// Leaderboard Module
app.get('/api/leaderboard', LeaderboardController.getLeaderboard);
app.post('/api/leaderboard/recalculate', authenticateToken, requireAdmin, LeaderboardController.recalculate);
app.post('/api/leaderboard/distribute', authenticateToken, requireAdmin, LeaderboardController.distributeRewards);
app.post('/api/leaderboard/claim', LeaderboardController.claimReward);

// Marketplace Module
app.get('/api/listings', MarketplaceController.listListings);
app.post('/api/listings', authenticateToken, MarketplaceController.listPosition);
app.post('/api/listings/buy', authenticateToken, MarketplaceController.buyPosition);
app.post('/api/listings/cancel', authenticateToken, MarketplaceController.cancelListing);

// Events Module
app.get('/api/events', EventsController.queryEvents);
app.get('/api/events/:chainId/:txHash', EventsController.getEventByTxHash);

// Stats Module
app.get('/api/stats', StatsController.getStats);

// Security Module
app.post('/api/security/jailbreak-log', SecurityController.logJailbreak);
app.get('/api/security/logs', authenticateToken, requireAdmin, SecurityController.getLogs);

// Global Error Handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors,
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
    });
  }

  // Handle express-rate-limit payload structure
  if ((err as any).statusCode === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      message: err.message,
    });
  }

  logger.error(`Unhandled Error: ${err.message}`, err);
  return res.status(500).json({
    error: 'Internal Server Error',
  });
});

import { z } from 'zod';

export { app };
export default app;
