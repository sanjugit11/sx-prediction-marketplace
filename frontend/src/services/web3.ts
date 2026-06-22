import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseUnits,
  stringToHex,
  type Address,
  type Hash,
} from 'viem';
import { CONTRACTS, SUPPORTED_CHAINS, getChainKeyById, getExplorerTxUrl, type SupportedChainKey } from '../config/contracts';

type EthereumProvider = Parameters<typeof custom>[0] & {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export interface TransactionReceipt {
  transactionHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  status: 'success' | 'reverted';
  from?: Address;
  to?: Address | null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const simulatedReceipt = async (to: string): Promise<TransactionReceipt> => {
  await wait(400);
  return {
    transactionHash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}` as Hash,
    blockNumber: 0n,
    gasUsed: 0n,
    status: 'success',
    to: isAddress(to) ? to as Address : null,
  };
};

export interface ContractMarket {
  address: Address;
  question: string;
  endTime: bigint;
  resolved: boolean;
  winner: 'YES' | 'NO' | null;
  yesPool: bigint;
  noPool: bigint;
  totalPool: bigint;
  yesOdds: bigint;
  noOdds: bigint;
  minimumStake: bigint;
}

export interface ContractPosition {
  id: bigint;
  marketAddress: Address;
  marketQuestion: string;
  owner: Address;
  outcome: 'YES' | 'NO';
  amount: bigint;
  oddsAtEntry: bigint;
  createdAt: bigint;
  claimed: boolean;
  resolved: boolean;
  winner: 'YES' | 'NO' | null;
  potentialPayout: bigint;
}

export interface ContractListing {
  id: bigint;
  seller: Address;
  market: Address;
  positionId: bigint;
  price: bigint;
  active: boolean;
  question: string;
  outcome: 'YES' | 'NO';
  originalAmount: bigint;
  originalOdds: bigint;
}

export interface SxuaSubAccount {
  id: bigint;
  token: Address;
  owner: Address;
  principal: bigint;
  createdAt: bigint;
  maturityDate: bigint;
  accruedYield: bigint;
  withdrawn: boolean;
  liveYield: bigint;
}

const requireAddress = (value: Address | undefined, label: string): Address => {
  if (!value) throw new Error(`${label} is missing or invalid in .env`);
  return value;
};

let activeChainKey: SupportedChainKey = 'hoodi';

export const hoodi = SUPPORTED_CHAINS.hoodi;
export const baseSepolia = SUPPORTED_CHAINS.baseSepolia;
export const contracts = CONTRACTS.hoodi;

const createClientFor = (chainKey: SupportedChainKey) => createPublicClient({
  chain: SUPPORTED_CHAINS[chainKey],
  transport: http(SUPPORTED_CHAINS[chainKey].rpcUrls.default.http[0]),
});

export const publicClient = createClientFor('hoodi');

const getContracts = (chainKey = activeChainKey) => CONTRACTS[chainKey];
const getPublicClient = (chainKey = activeChainKey) => chainKey === 'hoodi' ? publicClient : createClientFor(chainKey);

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
]);

const sxuaAbi = parseAbi([
  'function deposit(address token, uint256 amount, uint256 committedPercentage) external',
  'function withdrawUncommitted(address token, uint256 amount) external',
  'function withdrawCommitted(uint256 subAccountId) external',
  'function getUnifiedBalance(address user, address token) external view returns (uint256)',
  'function getCommittedBalances(address user, address token) external view returns (uint256)',
  'function getUncommittedBalance(address user, address token) external view returns (uint256)',
  'function getAccruedYield(address user, uint256 subAccountId) external view returns (uint256)',
  'function getUserSubAccounts(address user) external view returns (uint256[])',
  'function subAccounts(uint256 id) external view returns (uint256 id, address token, address owner, uint256 principal, uint256 createdAt, uint256 maturityDate, uint256 accruedYield, bool withdrawn)',
]);

const factoryAbi = parseAbi([
  'function createMarket(string question, uint256 endTime, uint256 minimumStake, address collateralToken) external returns (address)',
  'function getMarkets() external view returns (address[])',
]);

const marketAbi = parseAbi([
  'function question() external view returns (string)',
  'function endTime() external view returns (uint256)',
  'function minimumStake() external view returns (uint256)',
  'function yesPool() external view returns (uint256)',
  'function noPool() external view returns (uint256)',
  'function totalPool() external view returns (uint256)',
  'function resolved() external view returns (bool)',
  'function winningOutcome() external view returns (bool)',
  'function getOdds(bool outcome) external view returns (uint256)',
  'function getPosition(uint256 positionId) external view returns (uint256 id, address owner, bool outcome, uint256 amount, uint256 oddsAtEntry, uint256 createdAt, bool claimed)',
  'function getUserPositions(address user) external view returns (uint256[])',
  'function stakeYes(uint256 amount) external',
  'function stakeNo(uint256 amount) external',
]);

const resolutionAbi = parseAbi([
  'function resolveMarket(address market, bool winner) external',
  'function claimPayout(address market, uint256 positionId) external',
]);

const leaderboardAbi = parseAbi([
  'function claimReward(address token) external',
  'function claimableRewards(address user, address token) external view returns (uint256)',
  'function getUserStats(address user) external view returns (uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume)',
  'function getAccuracy(address user) external view returns (uint256)',
  'function getAllUsers() external view returns (address[])',
]);

const marketplaceAbi = parseAbi([
  'function nextListingId() external view returns (uint256)',
  'function listPosition(address market, uint256 positionId, uint256 price) external returns (uint256)',
  'function cancelListing(uint256 listingId) external',
  'function buyPosition(uint256 listingId) external',
  'function listings(uint256 id) external view returns (uint256 id, address seller, address market, uint256 positionId, uint256 price, bool active)',
]);

const verificationAbi = parseAbi([
  'function isVerified(address implementation) external view returns (bool)',
]);

const accessControlAbi = parseAbi([
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
  'function RESOLVER_ROLE() external view returns (bytes32)',
]);

const receipt = (hash: Hash) => publicClient.waitForTransactionReceipt({ hash });

const getWalletClient = async () => {
  if (!window.ethereum) throw new Error('No injected wallet found');
  const walletClient = createWalletClient({
    chain: SUPPORTED_CHAINS[activeChainKey],
    transport: custom(window.ethereum),
  });
  return walletClient;
};

const getAccount = async (): Promise<Address> => {
  const walletClient = await getWalletClient();
  const [account] = await walletClient.requestAddresses();
  if (!account) throw new Error('Wallet connection was rejected');
  return account;
};

const ensureChain = async (chainKey: SupportedChainKey = activeChainKey) => {
  activeChainKey = chainKey;
  const chain = SUPPORTED_CHAINS[chainKey];
  const walletClient = await getWalletClient();
  try {
    await walletClient.switchChain({ id: chain.id });
  } catch (error) {
    await window.ethereum?.request?.({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${chain.id.toString(16)}`,
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls.default.http,
        blockExplorerUrls: [chain.blockExplorers.default.url],
      }],
    });
    await walletClient.switchChain({ id: chain.id });
  }
};

const write = async ({
  address,
  abi,
  functionName,
  args,
}: {
  address: Address;
  abi: typeof sxuaAbi | typeof erc20Abi | typeof factoryAbi | typeof marketAbi | typeof resolutionAbi | typeof leaderboardAbi | typeof marketplaceAbi;
  functionName: string;
  args?: readonly unknown[];
}) => {
  await ensureChain(activeChainKey);
  const walletClient = await getWalletClient();
  const account = await getAccount();
  const hash = await walletClient.writeContract({
    account,
    chain: SUPPORTED_CHAINS[activeChainKey],
    address,
    abi,
    functionName,
    args: args ?? [],
  } as any);
  return receipt(hash);
};

const tokenDecimals = async (token = requireAddress(contracts.usdc, 'USDC_ADDRESS')) => {
  try {
    return await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' });
  } catch {
    return 18;
  }
};

export const toTokenAmount = async (amount: number | string, token?: Address) =>
  parseUnits(String(amount), await tokenDecimals(token));

export const fromTokenAmount = async (amount: bigint, token?: Address) =>
  Number(formatUnits(amount, await tokenDecimals(token)));

export const formatToken = (amount: bigint, decimals = 18) => formatUnits(amount, decimals);

export const web3Service = {
  connectWallet: async () => {
    await ensureChain(activeChainKey);
    const account = await getAccount();
    const walletChainId = await window.ethereum?.request?.({ method: 'eth_chainId' }) as string | undefined;
    const chainKey = walletChainId ? getChainKeyById(Number(walletChainId)) : activeChainKey;
    return { address: account, chainId: chainKey === 'baseSepolia' ? 'base-sepolia' as const : 'hoodi' as const };
  },

  switchToHoodi: () => ensureChain('hoodi'),
  switchToBaseSepolia: () => ensureChain('baseSepolia'),
  setActiveChain: (chainKey: SupportedChainKey) => {
    activeChainKey = chainKey;
  },
  getExplorerUrl: (hash?: string, chainKey = activeChainKey) => getExplorerTxUrl(chainKey, hash),
  getCurrentChainKey: () => activeChainKey,

  approveToken: async (spender: Address, amount: number | string, token = requireAddress(getContracts().usdc, 'USDC_ADDRESS')) => {
    const parsed = await toTokenAmount(amount, token);
    return write({ address: token, abi: erc20Abi, functionName: 'approve', args: [spender, parsed] });
  },

  getSxuaDashboard: async (user: Address, token = requireAddress(getContracts().usdc, 'USDC_ADDRESS')) => {
    const client = getPublicClient();
    const sxua = requireAddress(getContracts().sxua, 'SXUA_ADDRESS');
    const [unified, committed, uncommitted, ids] = await Promise.all([
      client.readContract({ address: sxua, abi: sxuaAbi, functionName: 'getUnifiedBalance', args: [user, token] }),
      client.readContract({ address: sxua, abi: sxuaAbi, functionName: 'getCommittedBalances', args: [user, token] }),
      client.readContract({ address: sxua, abi: sxuaAbi, functionName: 'getUncommittedBalance', args: [user, token] }),
      client.readContract({ address: sxua, abi: sxuaAbi, functionName: 'getUserSubAccounts', args: [user] }),
    ]);

    const subAccounts = await Promise.all(ids.map(async (id) => {
      const [subAccount, liveYield] = await Promise.all([
        client.readContract({ address: sxua, abi: sxuaAbi, functionName: 'subAccounts', args: [id] }),
        client.readContract({ address: sxua, abi: sxuaAbi, functionName: 'getAccruedYield', args: [user, id] }),
      ]);
      return {
        id: subAccount[0],
        token: subAccount[1],
        owner: subAccount[2],
        principal: subAccount[3],
        createdAt: subAccount[4],
        maturityDate: subAccount[5],
        accruedYield: subAccount[6],
        withdrawn: subAccount[7],
        liveYield,
      } satisfies SxuaSubAccount;
    }));

    return { unified, committed, uncommitted, subAccounts };
  },

  registerEnclaveAttestation: async (_username: string, _email: string, userAddress: string) => {
    return simulatedReceipt(userAddress);
  },

  depositFunds: async (amount: number, _userAddress?: string, committedPercentage = 0) => {
    const sxua = requireAddress(contracts.sxua, 'SXUA_ADDRESS');
    const token = requireAddress(contracts.usdc, 'USDC_ADDRESS');
    const parsed = await toTokenAmount(amount, token);
    return write({ address: sxua, abi: sxuaAbi, functionName: 'deposit', args: [token, parsed, BigInt(committedPercentage)] });
  },

  withdrawFunds: async (amount: number, _userAddress?: string) => {
    const sxua = requireAddress(contracts.sxua, 'SXUA_ADDRESS');
    const token = requireAddress(contracts.usdc, 'USDC_ADDRESS');
    const parsed = await toTokenAmount(amount, token);
    return write({ address: sxua, abi: sxuaAbi, functionName: 'withdrawUncommitted', args: [token, parsed] });
  },

  withdrawCommitted: async (subAccountId: bigint | number) => {
    const sxua = requireAddress(contracts.sxua, 'SXUA_ADDRESS');
    return write({ address: sxua, abi: sxuaAbi, functionName: 'withdrawCommitted', args: [BigInt(subAccountId)] });
  },

  getMarkets: async (): Promise<ContractMarket[]> => {
    const factory = requireAddress(contracts.factory, 'PREDICTION_MARKET_FACTORY_ADDRESS');
    const markets = await publicClient.readContract({ address: factory, abi: factoryAbi, functionName: 'getMarkets' });
    return Promise.all(markets.map(async (address) => {
      const [question, endTime, resolved, winningOutcome, yesPool, noPool, totalPool, yesOdds, noOdds, minimumStake] = await Promise.all([
        publicClient.readContract({ address, abi: marketAbi, functionName: 'question' }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'endTime' }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'resolved' }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'winningOutcome' }).catch(() => false),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'yesPool' }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'noPool' }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'totalPool' }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'getOdds', args: [true] }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'getOdds', args: [false] }),
        publicClient.readContract({ address, abi: marketAbi, functionName: 'minimumStake' }),
      ]);
      return {
        address,
        question,
        endTime,
        resolved,
        winner: resolved ? (winningOutcome ? 'YES' : 'NO') : null,
        yesPool,
        noPool,
        totalPool,
        yesOdds,
        noOdds,
        minimumStake,
      };
    }));
  },

  getMarket: async (marketAddress: Address): Promise<ContractMarket> => {
    const [question, endTime, resolved, winningOutcome, yesPool, noPool, totalPool, yesOdds, noOdds, minimumStake] = await Promise.all([
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'question' }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'endTime' }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'resolved' }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'winningOutcome' }).catch(() => false),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'yesPool' }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'noPool' }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'totalPool' }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'getOdds', args: [true] }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'getOdds', args: [false] }),
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'minimumStake' }),
    ]);
    return {
      address: marketAddress,
      question,
      endTime,
      resolved,
      winner: resolved ? (winningOutcome ? 'YES' : 'NO') : null,
      yesPool,
      noPool,
      totalPool,
      yesOdds,
      noOdds,
      minimumStake,
    };
  },

  createMarket: async (question: string, endTime: number, minimumStake: number) => {
    const factory = requireAddress(contracts.factory, 'PREDICTION_MARKET_FACTORY_ADDRESS');
    const token = requireAddress(contracts.usdc, 'USDC_ADDRESS');
    const parsedStake = await toTokenAmount(minimumStake, token);
    return write({ address: factory, abi: factoryAbi, functionName: 'createMarket', args: [question, BigInt(endTime), parsedStake, token] });
  },

  placeStake: async (marketAddress: string, outcome: 'YES' | 'NO', amount: number, _userAddress?: string) => {
    if (!isAddress(marketAddress)) return simulatedReceipt(marketAddress);
    const token = requireAddress(contracts.usdc, 'USDC_ADDRESS');
    const parsed = await toTokenAmount(amount, token);
    await web3Service.approveToken(marketAddress, Number(amount) * 1.01, token);
    return write({ address: marketAddress, abi: marketAbi, functionName: outcome === 'YES' ? 'stakeYes' : 'stakeNo', args: [parsed] });
  },

  getUserPositions: async (marketAddress: Address, user: Address) => {
    const ids = await publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'getUserPositions', args: [user] });
    return Promise.all(ids.map((id) =>
      publicClient.readContract({ address: marketAddress, abi: marketAbi, functionName: 'getPosition', args: [id] })
    ));
  },

  getUserPredictionPositions: async (user: Address): Promise<ContractPosition[]> => {
    const markets = await web3Service.getMarkets();
    const nested = await Promise.all(markets.map(async (market) => {
      const ids = await publicClient.readContract({ address: market.address, abi: marketAbi, functionName: 'getUserPositions', args: [user] });
      return Promise.all(ids.map(async (id) => {
        const pos = await publicClient.readContract({ address: market.address, abi: marketAbi, functionName: 'getPosition', args: [id] });
        const outcome = pos[2] ? 'YES' : 'NO';
        const potentialPayout = (pos[3] * pos[4]) / 10n ** 18n;
        return {
          id: pos[0],
          marketAddress: market.address,
          marketQuestion: market.question,
          owner: pos[1],
          outcome,
          amount: pos[3],
          oddsAtEntry: pos[4],
          createdAt: pos[5],
          claimed: pos[6],
          resolved: market.resolved,
          winner: market.winner,
          potentialPayout,
        } satisfies ContractPosition;
      }));
    }));
    return nested.flat();
  },

  resolveMarket: async (marketAddress: string, outcome: 'YES' | 'NO' | 'CANCEL', _adminAddress?: string) => {
    if (outcome === 'CANCEL' || !isAddress(marketAddress)) return simulatedReceipt(marketAddress);
    const resolutionManager = requireAddress(contracts.resolutionManager, 'RESOLUTION_MANAGER_ADDRESS');
    return write({ address: resolutionManager, abi: resolutionAbi, functionName: 'resolveMarket', args: [marketAddress, outcome === 'YES'] });
  },

  claimPayout: async (marketAddress: string, positionId: bigint | number | string) => {
    if (!isAddress(marketAddress)) return simulatedReceipt(marketAddress);
    const resolutionManager = requireAddress(contracts.resolutionManager, 'RESOLUTION_MANAGER_ADDRESS');
    return write({ address: resolutionManager, abi: resolutionAbi, functionName: 'claimPayout', args: [marketAddress, BigInt(positionId)] });
  },

  pendingReward: async (user: Address, token = requireAddress(contracts.usdc, 'USDC_ADDRESS')) => {
    const leaderboard = requireAddress(contracts.leaderboard, 'LEADERBOARD_ADDRESS');
    return publicClient.readContract({ address: leaderboard, abi: leaderboardAbi, functionName: 'claimableRewards', args: [user, token] });
  },

  claimReward: async (token = requireAddress(contracts.usdc, 'USDC_ADDRESS')) => {
    const leaderboard = requireAddress(contracts.leaderboard, 'LEADERBOARD_ADDRESS');
    return write({ address: leaderboard, abi: leaderboardAbi, functionName: 'claimReward', args: [token] });
  },

  getLeaderboard: async () => {
    const leaderboard = requireAddress(contracts.leaderboard, 'LEADERBOARD_ADDRESS');
    const users = await publicClient.readContract({ address: leaderboard, abi: leaderboardAbi, functionName: 'getAllUsers' });
    const rows = await Promise.all(users.map(async (user) => {
      const [stats, accuracy] = await Promise.all([
        publicClient.readContract({ address: leaderboard, abi: leaderboardAbi, functionName: 'getUserStats', args: [user] }),
        publicClient.readContract({ address: leaderboard, abi: leaderboardAbi, functionName: 'getAccuracy', args: [user] }),
      ]);
      return { user, totalPredictions: stats[0], correctPredictions: stats[1], totalVolume: stats[2], accuracy };
    }));
    return rows.sort((a, b) => Number(b.accuracy - a.accuracy)).slice(0, 10);
  },

  listPositionForSale: async (marketAddress: string, positionId: bigint | number | string, askingPrice: number, _userAddress?: string) => {
    if (!isAddress(marketAddress)) return simulatedReceipt(marketAddress);
    const marketplace = requireAddress(contracts.marketplace, 'RESELLING_MARKETPLACE_ADDRESS');
    const token = requireAddress(contracts.usdc, 'USDC_ADDRESS');
    const price = await toTokenAmount(askingPrice, token);
    return write({ address: marketplace, abi: marketplaceAbi, functionName: 'listPosition', args: [marketAddress, BigInt(positionId), price] });
  },

  buyPosition: async (listingId: bigint | number | string, askingPrice: number, _userAddress?: string) => {
    if (typeof listingId === 'string' && !/^\d+$/.test(listingId)) return simulatedReceipt(String(listingId));
    const marketplace = requireAddress(contracts.marketplace, 'RESELLING_MARKETPLACE_ADDRESS');
    await web3Service.approveToken(marketplace, askingPrice);
    return write({ address: marketplace, abi: marketplaceAbi, functionName: 'buyPosition', args: [BigInt(listingId)] });
  },

  cancelListing: async (listingId: bigint | number) => {
    const marketplace = requireAddress(contracts.marketplace, 'RESELLING_MARKETPLACE_ADDRESS');
    return write({ address: marketplace, abi: marketplaceAbi, functionName: 'cancelListing', args: [BigInt(listingId)] });
  },

  getActiveListings: async (): Promise<ContractListing[]> => {
    const marketplace = requireAddress(contracts.marketplace, 'RESELLING_MARKETPLACE_ADDRESS');
    const nextListingId = await publicClient.readContract({ address: marketplace, abi: marketplaceAbi, functionName: 'nextListingId' });
    const ids = Array.from({ length: Math.max(0, Number(nextListingId - 1n)) }, (_, index) => BigInt(index + 1));
    const rows = await Promise.all(ids.map(async (id) => {
      const listing = await publicClient.readContract({ address: marketplace, abi: marketplaceAbi, functionName: 'listings', args: [id] });
      if (!listing[5]) return null;
      const [question, position] = await Promise.all([
        publicClient.readContract({ address: listing[2], abi: marketAbi, functionName: 'question' }),
        publicClient.readContract({ address: listing[2], abi: marketAbi, functionName: 'getPosition', args: [listing[3]] }),
      ]);
      return {
        id: listing[0],
        seller: listing[1],
        market: listing[2],
        positionId: listing[3],
        price: listing[4],
        active: Boolean(listing[5]),
        question,
        outcome: position[2] ? 'YES' : 'NO',
        originalAmount: position[3],
        originalOdds: position[4],
      } satisfies ContractListing;
    }));
    return rows.filter((row): row is ContractListing => Boolean(row));
  },

  getBackendListings: async () => {
    const response = await fetch('/api/listings?status=ACTIVE');
    if (!response.ok) throw new Error('Failed to load listings');
    return response.json();
  },

  isVerified: async (contractAddress: Address) => {
    const registry = requireAddress(contracts.verificationRegistry, 'VERIFICATION_REGISTRY_ADDRESS');
    return publicClient.readContract({ address: registry, abi: verificationAbi, functionName: 'isVerified', args: [contractAddress] });
  },

  getEvents: async () => {
    const response = await fetch('/api/events');
    if (!response.ok) throw new Error('Failed to load events');
    return response.json();
  },

  formatBalance: (value: bigint | number) => {
    if (typeof value === 'number') return value.toFixed(2);
    return formatUnits(value, 18);
  },

  parseUSD: (value: string) => parseUnits(value, 18),
};
