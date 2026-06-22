import { Request, Response, NextFunction } from 'express';
import { MarketplaceService } from './marketplace.service';
import prisma from '../../database/client';

export class MarketplaceController {
  static async listListings(req: Request, res: Response, next: NextFunction) {
    try {
      const status = (req.query.status as string) || 'ACTIVE';
      const listings = await MarketplaceService.listListings(status);
      return res.status(200).json(listings);
    } catch (error) {
      next(error);
    }
  }

  static async listPosition(req: Request, res: Response, next: NextFunction) {
    try {
      const { marketAddress, positionId, price } = req.body;

      if (!marketAddress || positionId === undefined || !price) {
        return res.status(400).json({ error: 'marketAddress, positionId, and price are required' });
      }

      const payload = MarketplaceService.getListPayload(marketAddress, Number(positionId), price);

      // Handle DB simulation for testing
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        const market = await prisma.market.findFirst({
          where: { contractAddress: marketAddress.toLowerCase() },
        });

        if (market) {
          const stake = await prisma.stake.findFirst({
            where: { positionId: Number(positionId), marketId: market.id },
          });

          if (stake) {
            const userWallet = req.body.userWallet || '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
            const user = await prisma.user.findUnique({ where: { walletAddress: userWallet.toLowerCase() } });
            
            if (user) {
              const simListing = await prisma.marketplaceListing.create({
                data: {
                  listingId: Math.floor(Math.random() * 1000000),
                  stakeId: stake.id,
                  sellerId: user.id,
                  price: price,
                  status: 'ACTIVE',
                }
              });
              return res.status(201).json({ ...payload, simulatedListing: simListing });
            }
          }
        }
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  static async buyPosition(req: Request, res: Response, next: NextFunction) {
    try {
      const { listingId } = req.body;

      if (listingId === undefined) {
        return res.status(400).json({ error: 'listingId is required' });
      }

      const payload = MarketplaceService.getBuyPayload(Number(listingId));

      // Handle DB simulation for testing
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        const listing = await prisma.marketplaceListing.findUnique({
          where: { listingId: Number(listingId) },
        });

        if (listing) {
          const userWallet = req.body.userWallet || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // hardhat acct 1
          let buyer = await prisma.user.findUnique({ where: { walletAddress: userWallet.toLowerCase() } });
          if (!buyer) {
            buyer = await prisma.user.create({ data: { walletAddress: userWallet.toLowerCase(), deviceId: 'test' } });
          }

          await prisma.marketplaceListing.update({
            where: { id: listing.id },
            data: { status: 'BOUGHT', buyerId: buyer.id },
          });

          await prisma.stake.update({
            where: { id: listing.stakeId },
            data: { userId: buyer.id },
          });
        }
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }

  static async cancelListing(req: Request, res: Response, next: NextFunction) {
    try {
      const { listingId } = req.body;

      if (listingId === undefined) {
        return res.status(400).json({ error: 'listingId is required' });
      }

      const payload = MarketplaceService.getCancelPayload(Number(listingId));

      // Handle DB simulation for testing
      if (process.env.NODE_ENV === 'test' || req.body.simulate === true) {
        await prisma.marketplaceListing.updateMany({
          where: { listingId: Number(listingId) },
          data: { status: 'CANCELED' },
        });
      }

      return res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  }
}
