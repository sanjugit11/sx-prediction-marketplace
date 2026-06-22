import { defineChain, isAddress, type Address } from 'viem';

const env = import.meta.env;

export type SupportedChainKey = 'hoodi' | 'baseSepolia';

const asAddress = (value?: string): Address | undefined =>
  value && isAddress(value) ? (value as Address) : undefined;

export const SUPPORTED_CHAINS = {
  hoodi: defineChain({
    id: Number(env.HOODI_CHAIN_ID ?? 560048),
    name: 'Hoodi Testnet',
    nativeCurrency: { name: 'Hoodi ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [env.HOODI_RPC_URL ?? env.HOODI_TESTNET_RPC_URL ?? 'https://rpc.hoodi.network'] },
    },
    blockExplorers: {
      default: { name: 'Hoodi Explorer', url: env.HOODI_EXPLORER_URL ?? 'https://hoodi.etherscan.io' },
    },
    testnet: true,
  }),
  baseSepolia: defineChain({
    id: Number(env.BASE_SEPOLIA_CHAIN_ID ?? 84532),
    name: 'Base Sepolia',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org'] },
    },
    blockExplorers: {
      default: { name: 'BaseScan', url: env.BASE_SEPOLIA_EXPLORER_URL ?? 'https://sepolia.basescan.org' },
    },
    testnet: true,
  }),
} as const;

export const CONTRACTS = {
  hoodi: {
    usdc: asAddress(env.USDC_ADDRESS),
    accessControl: asAddress(env.SX_ACCESS_CONTROL_ADDRESS),
    feeTreasury: asAddress(env.FEE_TREASURY_ADDRESS),
    verificationRegistry: asAddress(env.VERIFICATION_REGISTRY_ADDRESS),
    sxua: asAddress(env.SXUA_ADDRESS),
    factory: asAddress(env.PREDICTION_MARKET_FACTORY_ADDRESS),
    leaderboard: asAddress(env.LEADERBOARD_ADDRESS),
    resolutionManager: asAddress(env.RESOLUTION_MANAGER_ADDRESS),
    marketplace: asAddress(env.RESELLING_MARKETPLACE_ADDRESS),
  },
  baseSepolia: {
    usdc: asAddress(env.BASE_SEPOLIA_USDC_ADDRESS ?? env.USDC_ADDRESS),
    accessControl: asAddress(env.BASE_SEPOLIA_SX_ACCESS_CONTROL_ADDRESS),
    feeTreasury: asAddress(env.BASE_SEPOLIA_FEE_TREASURY_ADDRESS),
    verificationRegistry: asAddress(env.BASE_SEPOLIA_VERIFICATION_REGISTRY_ADDRESS),
    sxua: asAddress(env.BASE_SEPOLIA_SXUA_ADDRESS),
    factory: asAddress(env.BASE_SEPOLIA_PREDICTION_MARKET_FACTORY_ADDRESS),
    leaderboard: asAddress(env.BASE_SEPOLIA_LEADERBOARD_ADDRESS),
    resolutionManager: asAddress(env.BASE_SEPOLIA_RESOLUTION_MANAGER_ADDRESS),
    marketplace: asAddress(env.BASE_SEPOLIA_RESELLING_MARKETPLACE_ADDRESS),
  },
} as const;

export const getExplorerTxUrl = (chainKey: SupportedChainKey, hash?: string) => {
  if (!hash) return '';
  return `${SUPPORTED_CHAINS[chainKey].blockExplorers.default.url}/tx/${hash}`;
};

export const getChainKeyById = (chainId: number): SupportedChainKey | null => {
  if (chainId === SUPPORTED_CHAINS.hoodi.id) return 'hoodi';
  if (chainId === SUPPORTED_CHAINS.baseSepolia.id) return 'baseSepolia';
  return null;
};
