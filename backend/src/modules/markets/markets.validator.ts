import { z } from 'zod';

export const createMarketSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
  endTime: z.number().int().gt(Math.floor(Date.now() / 1000), 'End time must be in the future'),
  minimumStake: z.string().min(1, 'Minimum stake is required'),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address').optional(),
});
