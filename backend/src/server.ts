import app from './app';
import config from './config';
import prisma from './database/client';
import { BlockIndexer } from './blockchain/indexer';
import logger from './utils/logger';

// Import workers to initialize them
import './queues/event.worker';
import './queues/leaderboard.worker';
import './queues/reward.worker';
import './queues/reorg.worker';

const port = config.PORT;

const server = app.listen(port, async () => {
  logger.info(`Server is running on port ${port} in ${config.NODE_ENV} mode`);

  // Verify DB Connection
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
  } catch (err) {
    logger.error('Failed to connect to database on startup:', err);
    process.exit(1);
  }

  // Start block indexers if not running in test mode
  if (config.NODE_ENV !== 'test') {
    const hoodiIndexer = new BlockIndexer(config.HOODI_CHAIN_ID);
    const baseIndexer = new BlockIndexer(config.BASE_SEPOLIA_CHAIN_ID);

    hoodiIndexer.start().catch((err) => logger.error('Hoodi Indexer error:', err));
    baseIndexer.start().catch((err) => logger.error('Base Sepolia Indexer error:', err));
  }
});

// Graceful Shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, shutting down gracefully...');
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database disconnected.');
    process.exit(0);
  });

  // Force exit after 10s if not clean
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
export default server;
