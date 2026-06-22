import { z } from 'zod';

export const UserRegistrationSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  termsApproved: z.boolean().refine(val => val === true, 'You must accept security enclave protocols'),
});

export type UserRegistrationInput = z.infer<typeof UserRegistrationSchema>;

export const MarketCreationSchema = z.object({
  question: z.string()
    .min(10, 'Question must be at least 10 characters')
    .max(200, 'Question cannot exceed 200 characters'),
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  category: z.enum(['Crypto', 'Politics', 'Tech', 'Sports', 'Science']),
  resolutionDate: z.string()
    .refine((val) => {
      const selected = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selected > today;
    }, 'Resolution date must be in the future'),
  totalLiquidity: z.number({ message: 'Amount must be a number' })
    .min(100, 'Minimum initial liquidity is 100 USDC'),
  oracleAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum contract address (0x...)'),
});

export type MarketCreationInput = z.infer<typeof MarketCreationSchema>;

export const StakeSchema = z.object({
  amount: z.number({ message: 'Amount must be a number' })
    .min(1, 'Minimum stake amount is 1 USDC'),
  outcome: z.enum(['YES', 'NO']),
});

export type StakeInput = z.infer<typeof StakeSchema>;

export const ListingSchema = z.object({
  askingPrice: z.number({ message: 'Asking price must be a number' })
    .min(1, 'Minimum asking price is 1 USDC'),
});

export type ListingInput = z.infer<typeof ListingSchema>;

export const TransactionAmountSchema = z.object({
  amount: z.number({ message: 'Amount must be a number' })
    .min(1, 'Minimum amount is 1 USDC'),
});

export type TransactionAmountInput = z.infer<typeof TransactionAmountSchema>;
