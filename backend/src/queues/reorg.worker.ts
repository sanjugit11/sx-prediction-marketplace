import { Worker, Job } from 'bullmq';
import prisma from '../database/client';
import { redisConnection } from './queue.setup';
import logger from '../utils/logger';

interface ReorgJobData {
  chainId: number;
  blockNumber: number;
  oldHash: string;
  newHash: string;
}

export const reorgWorker = new Worker(
  'reorg-recovery',
  async (job: Job<ReorgJobData>) => {
    const { chainId, blockNumber, oldHash, newHash } = job.data;
    logger.warn(`Recovering from Reorg on Chain ${chainId} starting at block ${blockNumber}`);

    // Log the reorg to reorg_log
    await prisma.reorgLog.create({
      data: {
        chainId,
        blockNumber,
        oldHash,
        newHash,
      },
    });

    // 1. Fetch all events from DB that occurred on/after the fork block
    const affectedEvents = await prisma.event.findMany({
      where: {
        chainId,
        blockNumber: {
          gte: blockNumber,
        },
      },
      orderBy: {
        blockNumber: 'desc',
      },
    });

    logger.info(`Found ${affectedEvents.length} affected events to rollback.`);

    // 2. Perform state rollback in transaction
    await prisma.$transaction(async (tx) => {
      for (const event of affectedEvents) {
        const { eventName, eventData, contractAddress } = event;
        const data = eventData as any;

        switch (eventName) {
          case 'SubAccountCreated': {
            // Delete the sub-account record
            await tx.committedSubAccount.deleteMany({
              where: { id: Number(data.id) },
            });
            break;
          }

          case 'Withdrawn': {
            // If it was committed, mark it as not withdrawn again
            if (data.isCommitted) {
              await tx.committedSubAccount.updateMany({
                where: { id: Number(data.subAccountId) },
                data: { withdrawn: false },
              });
            }
            break;
          }

          case 'MarketCreated': {
            // Delete the market record
            await tx.market.deleteMany({
              where: { contractAddress: data.marketAddress.toLowerCase() },
            });
            break;
          }

          case 'Staked': {
            // Delete the stake record
            await tx.stake.deleteMany({
              where: { positionId: Number(data.positionId) },
            });
            break;
          }

          case 'MarketResolved': {
            // Revert the market status to unresolved
            await tx.market.updateMany({
              where: { contractAddress: contractAddress.toLowerCase() },
              data: { resolved: false, winner: null },
            });
            break;
          }

          case 'PayoutClaimed': {
            // Revert stake claimed status
            await tx.stake.updateMany({
              where: { positionId: Number(data.positionId) },
              data: { claimed: false },
            });
            break;
          }

          case 'PositionListed': {
            // Delete listing
            await tx.marketplaceListing.deleteMany({
              where: { listingId: Number(data.listingId) },
            });
            break;
          }

          case 'PositionPurchased': {
            // Revert purchase: status to ACTIVE, clear buyerId, transfer stake back to seller
            const listing = await tx.marketplaceListing.findUnique({
              where: { listingId: Number(data.listingId) },
            });
            if (listing) {
              await tx.marketplaceListing.update({
                where: { id: listing.id },
                data: { status: 'ACTIVE', buyerId: null },
              });
              await tx.stake.update({
                where: { id: listing.stakeId },
                data: { userId: listing.sellerId },
              });
            }
            break;
          }

          case 'ListingCanceled': {
            // Make active again
            await tx.marketplaceListing.updateMany({
              where: { listingId: Number(data.listingId) },
              data: { status: 'ACTIVE' },
            });
            break;
          }

          default:
            break;
        }
      }

      // 3. Delete the rolled-back events themselves
      await tx.event.deleteMany({
        where: {
          chainId,
          blockNumber: {
            gte: blockNumber,
          },
        },
      });

      // 4. Reset sync status back to parent block
      await tx.syncStatus.upsert({
        where: { chainId },
        update: {
          lastProcessedBlock: blockNumber - 1,
        },
        create: {
          chainId,
          lastProcessedBlock: blockNumber - 1,
        },
      });
    });

    logger.info(`Reorg recovery completed. Set sync height of chain ${chainId} to ${blockNumber - 1}`);
  },
  { connection: redisConnection as any }
);

reorgWorker.on('completed', () => {
  logger.info('Reorg recovery job completed');
});

reorgWorker.on('failed', (job, err) => {
  logger.error('Reorg recovery job failed:', err);
});
