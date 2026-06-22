export type ChainId = 'hoodi' | 'base-sepolia' | 'sx-chain';

export interface SubAccount {
  id: string;
  name: string;
  address: string;
  balance: number;
  allocatedToMarkets: number;
  status: 'active' | 'suspended';
}

export interface UserWallet {
  isConnected: boolean;
  address: string | null;
  chainId: ChainId;
  balance: number; // in USDC/USDT/SXUSD
  isRegistered: boolean;
  registeredUsername: string | null;
  registeredEmail: string | null;
  enclaveKey: string | null;
  attestationHash: string | null;
  subAccounts: SubAccount[];
}

export type MarketCategory = 'Crypto' | 'Politics' | 'Tech' | 'Sports' | 'Science';

export interface Market {
  id: string;
  question: string;
  description: string;
  category: MarketCategory;
  yesOdds: number; // percentage, e.g. 55 for 55%
  noOdds: number; // percentage, e.g. 45
  totalLiquidity: number; // USDC
  creator: string;
  resolutionDate: string;
  isResolved: boolean;
  outcome: 'YES' | 'NO' | 'CANCEL' | null;
  oracleAddress: string;
  isVerified: boolean;
  verificationHash: string;
  createdAt: string;
  minimumStake?: number;
}

export interface Stake {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  amount: number; // USD
  entryOdds: number; // percentage
  committedAmount: number;
  uncommittedAmount: number;
  yieldEarned: number;
  timestamp: string;
  txHash: string;
  status: 'active' | 'resolved' | 'listed';
  claimed?: boolean;
}

export interface MarketplaceListing {
  id: string;
  stakeId: string;
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  originalAmount: number;
  originalOdds: number;
  sellerAddress: string;
  askingPrice: number; // USD
  status: 'active' | 'sold' | 'cancelled';
  createdAt: string;
}

export interface SecurityAuditReport {
  id: string;
  title: string;
  componentName: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Fixed' | 'Open' | 'Mitigated';
  description: string;
  remediation: string;
  date: string;
}

export interface JailbreakLog {
  id: string;
  timestamp: string;
  ipAddress: string;
  promptSnippet: string;
  detectedVector: string;
  mitigationAction: string;
  threatLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  address: string;
  accuracy: number; // percentage, e.g. 84.5
  totalPredictions: number;
  volume: number; // USD volume
  rewardsClaimed: number; // SX tokens
}

export interface EventLog {
  id: string;
  blockNumber: number;
  timestamp: string;
  eventName: string;
  contractName: string;
  txHash: string;
  details: string;
}
