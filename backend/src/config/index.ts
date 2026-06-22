import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/prediction_marketplace?schema=public'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(8).default('super_secret_jwt_key_prediction_marketplace'),
  
  // RPC URLs
  HOODI_RPC_URL: z.string().url().default('https://rpc-hoodi.com'),
  BASE_SEPOLIA_RPC_URL: z.string().url().default('https://sepolia.base.org'),

  // Contract Addresses (pre-configured, or fallback to zero address for safety)
  USDC_ADDRESS: z.string().default('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'), // Mock/real USDC
  SXUA_ADDRESS: z.string().default('0x0000000000000000000000000000000000000001'),
  FACTORY_ADDRESS: z.string().default('0x0000000000000000000000000000000000000002'),
  LEADERBOARD_ADDRESS: z.string().default('0x0000000000000000000000000000000000000003'),
  RESOLUTION_MANAGER_ADDRESS: z.string().default('0x0000000000000000000000000000000000000004'),
  MARKETPLACE_ADDRESS: z.string().default('0x0000000000000000000000000000000000000005'),
  ACCESS_CONTROL_ADDRESS: z.string().default('0x0000000000000000000000000000000000000006'),

  // Chain IDs
  HOODI_CHAIN_ID: z.coerce.number().default(82008), // Hoodi custom chain ID
  BASE_SEPOLIA_CHAIN_ID: z.coerce.number().default(84532), // Base Sepolia chain ID
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  // Don't crash during test, fallback to defaults
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const config = parsed.success ? parsed.data : envSchema.parse({});
export default config;
