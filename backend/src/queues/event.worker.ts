import { Worker, Job } from 'bullmq';
import prisma from '../database/client';
import { redisConnection, leaderboardUpdateQueue } from './queue.setup';
import logger from '../utils/logger';

interface EventJobData {
  eventName: string;
  contractAddress: string;
  chainId: number;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  eventData: any;
  timestamp: string;
}

export const eventWorker = new Worker(
  'event-processing',
  async (job: Job<EventJobData>) => {
    const {
      eventName,
      contractAddress,
      chainId,
      transactionHash,
      blockNumber,
      logIndex,
      eventData,
      timestamp,
    } = job.data;

    logger.info(`Processing event ${eventName} (Tx: ${transactionHash}) on Chain ${chainId}`);

    // Parse timestamp
    const eventTime = new Date(timestamp);

    // Save event to Database
    await prisma.event.upsert({
      where: {
        chainId_transactionHash_logIndex: {
          chainId,
          transactionHash,
          logIndex,
        },
      },
      update: {
        processedAt: new Date(),
      },
      create: {
        eventName,
        contractAddress: contractAddress.toLowerCase(),
        chainId,
        transactionHash,
        blockNumber,
        logIndex,
        eventData,
        timestamp: eventTime,
        processedAt: new Date(),
      },
    });

    // Event routing
    switch (eventName) {
      case 'SubAccountCreated': {
        const { id, owner, token, principal, maturityDate } = eventData;
        const ownerAddress = owner.toLowerCase();
        
        let user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
        if (!user) {
          user = await prisma.user.create({
            data: { walletAddress: ownerAddress, deviceId: 'indexer' },
          });
        }

        await prisma.committedSubAccount.upsert({
          where: { id: Number(id) },
          update: {
            userId: user.id,
            principal: principal.toString(),
            creationTimestamp: eventTime,
            maturityDate: new Date(Number(maturityDate) * 1000),
            withdrawn: false,
          },
          create: {
            id: Number(id),
            userId: user.id,
            principal: principal.toString(),
            creationTimestamp: eventTime,
            maturityDate: new Date(Number(maturityDate) * 1000),
            withdrawn: false,
          },
        });
        break;
      }

      case 'Withdrawn': {
        const { user: userAddress, isCommitted, subAccountId } = eventData;
        
        if (isCommitted) {
          await prisma.committedSubAccount.updateMany({
            where: { id: Number(subAccountId) },
            data: { withdrawn: true },
          });
        }
        break;
      }

      case 'MarketCreated': {
        const { marketAddress, question, endTime, creator, collateralToken } = eventData;
        const creatorAddr = creator || 'factory';

        await prisma.market.upsert({
          where: { contractAddress: marketAddress.toLowerCase() },
          update: {
            question,
            endTime: new Date(Number(endTime) * 1000),
          },
          create: {
            contractAddress: marketAddress.toLowerCase(),
            question,
            creator: creatorAddr.toLowerCase(),
            endTime: new Date(Number(endTime) * 1000),
            resolved: false,
          },
        });
        break;
      }

      case 'Staked': {
        const { user: userAddress, outcome, amount, odds, positionId } = eventData;
        const userAddr = userAddress.toLowerCase();

        let user = await prisma.user.findUnique({ where: { walletAddress: userAddr } });
        if (!user) {
          user = await prisma.user.create({
            data: { walletAddress: userAddr, deviceId: 'indexer' },
          });
        }

        const market = await prisma.market.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
        });

        if (market) {
          const oddsDecimal = Number(odds) / 1e18; // scale down
          await prisma.stake.upsert({
            where: { positionId: Number(positionId) },
            update: {
              amount: amount.toString(),
              oddsAtEntry: oddsDecimal.toString(),
            },
            create: {
              positionId: Number(positionId),
              marketId: market.id,
              userId: user.id,
              outcome,
              amount: amount.toString(),
              oddsAtEntry: oddsDecimal.toString(),
              claimed: false,
            },
          });
        }
        break;
      }

      case 'MarketResolved': {
        const { winner } = eventData;
        
        // Wait, MarketResolved is emitted by PredictionMarket or ResolutionManager
        // If contractAddress is the prediction market:
        const market = await prisma.market.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
        });

        if (market) {
          await prisma.market.update({
            where: { id: market.id },
            data: { resolved: true, winner },
          });

          // Trigger leaderboard updates for all users who staked in this market
          const stakes = await prisma.stake.findMany({
            where: { marketId: market.id },
            include: { user: true },
          });

          for (const stake of stakes) {
            await leaderboardUpdateQueue.add(`update-${stake.user.walletAddress}`, {
              wallet: stake.user.walletAddress,
            });
          }
        }
        break;
      }

      case 'PayoutClaimed': {
        const { positionId } = eventData;

        await prisma.stake.updateMany({
          where: { positionId: Number(positionId) },
          data: { claimed: true },
        });
        break;
      }

      case 'PositionListed': {
        const { listingId, seller, market, positionId, price } = eventData;
        const sellerAddress = seller.toLowerCase();

        let user = await prisma.user.findUnique({ where: { walletAddress: sellerAddress } });
        if (!user) {
          user = await prisma.user.create({
            data: { walletAddress: sellerAddress, deviceId: 'indexer' },
          });
        }

        const marketRecord = await prisma.market.findUnique({
          where: { contractAddress: market.toLowerCase() },
        });

        if (marketRecord) {
          const stake = await prisma.stake.findFirst({
            where: { positionId: Number(positionId), marketId: marketRecord.id },
          });

          if (stake) {
            await prisma.marketplaceListing.upsert({
              where: { listingId: Number(listingId) },
              update: {
                price: price.toString(),
                status: 'ACTIVE',
              },
              create: {
                listingId: Number(listingId),
                stakeId: stake.id,
                sellerId: user.id,
                price: price.toString(),
                status: 'ACTIVE',
              },
            });
          }
        }
        break;
      }

      case 'PositionPurchased': {
        const { listingId, buyer } = eventData;
        const buyerAddr = buyer.toLowerCase();

        let buyerUser = await prisma.user.findUnique({ where: { walletAddress: buyerAddr } });
        if (!buyerUser) {
          buyerUser = await prisma.user.create({
            data: { walletAddress: buyerAddr, deviceId: 'indexer' },
          });
        }

        const listing = await prisma.marketplaceListing.findUnique({
          where: { listingId: Number(listingId) },
          include: { stake: true },
        });

        if (listing && buyerUser) {
          await prisma.marketplaceListing.update({
            where: { id: listing.id },
            data: {
              status: 'BOUGHT',
              buyerId: buyerUser.id,
            },
          });

          // Transfer stake ownership to buyer
          await prisma.stake.update({
            where: { id: listing.stakeId },
            data: {
              userId: buyerUser.id,
            },
          });
        }
        break;
      }

      case 'ListingCanceled': {
        const { listingId } = eventData;

        await prisma.marketplaceListing.updateMany({
          where: { listingId: Number(listingId) },
          data: {
            status: 'CANCELED',
          },
        });
        break;
      }

      default:
        logger.debug(`Unhandled event processing: ${eventName}`);
    }
  },
  { connection: redisConnection as any }
);

eventWorker.on('completed', (job) => {
  logger.info(`Job event-processing:${job.id} completed successfully`);
});

eventWorker.on('failed', (job, err) => {
  logger.error(`Job event-processing:${job?.id} failed:`, err);
});
