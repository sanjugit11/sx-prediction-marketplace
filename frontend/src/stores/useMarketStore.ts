import { create } from 'zustand';
import type { Market, Stake, MarketplaceListing, LeaderboardEntry } from '../types';
import { web3Service, fromTokenAmount, type SxuaSubAccount } from '../services/web3';

interface MarketStore {
  committedBalance: number;
  uncommittedBalance: number;
  yieldEarned: number;
  markets: Market[];
  stakes: Stake[];
  listings: MarketplaceListing[];
  leaderboard: LeaderboardEntry[];
  chainSubAccounts: SxuaSubAccount[];
  isTransactionPending: boolean;
  
  depositStablecoins: (amount: number) => void;
  withdrawFunds: (amount: number) => { success: boolean; requiresPenalty: boolean; penaltyAmount: number };
  stakeOnMarket: (marketId: string, outcome: 'YES' | 'NO', amount: number) => { success: boolean; txHash: string };
  createMarket: (market: Omit<Market, 'id' | 'yesOdds' | 'noOdds' | 'isResolved' | 'outcome' | 'isVerified' | 'verificationHash' | 'createdAt'>) => { success: boolean; marketId: string };
  resolveMarket: (marketId: string, outcome: 'YES' | 'NO' | 'CANCEL') => void;
  claimPayout: (stakeId: string) => { success: boolean; payout: number; txHash: string };
  
  // Marketplace Actions
  listPositionForSale: (stakeId: string, askingPrice: number) => { success: boolean; listingId: string };
  buyListing: (listingId: string, buyerAddress: string) => { success: boolean; txHash: string };
  cancelListing: (listingId: string) => void;
  
  // Simulation ticks
  tickYield: () => void;
  tickOdds: () => void;

  syncBalances: (address: string) => Promise<void>;
  setTransactionPending: (pending: boolean) => void;
}

const STORAGE_KEY = 'sx_market_state';

const saveStateToLocalStorage = (state: any) => {
  try {
    const { committedBalance, uncommittedBalance, yieldEarned, markets, stakes, listings, leaderboard } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      committedBalance,
      uncommittedBalance,
      yieldEarned,
      markets,
      stakes,
      listings,
      leaderboard
    }));
  } catch (e) {
    console.error('Failed to save market state to localStorage', e);
  }
};

const initialMarkets: Market[] = [
  {
    id: 'm-1',
    question: 'Will Bitcoin surpass $120,000 by December 31, 2026?',
    description: 'This market resolves to YES if the price of Bitcoin (BTC) on Binance exceeds $120,000.00 USD at any point before or on December 31, 2026, 11:59 PM UTC. Otherwise, YES resolves to NO.',
    category: 'Crypto',
    yesOdds: 62,
    noOdds: 38,
    totalLiquidity: 450000,
    creator: '0x1c9b...ff82',
    resolutionDate: '2026-12-31',
    isResolved: false,
    outcome: null,
    oracleAddress: '0xoracle_chainlink_btc_usd_01',
    isVerified: true,
    verificationHash: '0x5b3f2e1a...78d2c4e',
    createdAt: '2026-06-01',
  },
  {
    id: 'm-2',
    question: 'Will OpenAI launch GPT-5 model before November 1, 2026?',
    description: 'Resolves to YES if OpenAI officially releases its next-generation frontier LLM, explicitly designated as "GPT-5" or successor major version, for public api access or ChatGPT before November 1, 2026.',
    category: 'Tech',
    yesOdds: 48,
    noOdds: 52,
    totalLiquidity: 320000,
    creator: '0x3a4f...dd10',
    resolutionDate: '2026-11-01',
    isResolved: false,
    outcome: null,
    oracleAddress: '0xoracle_uma_optimistic_gpt5',
    isVerified: true,
    verificationHash: '0xec29c0ff...12ee56c',
    createdAt: '2026-06-05',
  },
  {
    id: 'm-3',
    question: 'Will SpaceX successfully land a Starship on Mars in 2026?',
    description: 'Resolves to YES if SpaceX successfully launches a Starship vehicle which achieves a soft or hard landing on the Martian surface before January 1, 2027. Impact or landing confirmation qualifies.',
    category: 'Science',
    yesOdds: 25,
    noOdds: 75,
    totalLiquidity: 680000,
    creator: '0x992a...bb14',
    resolutionDate: '2026-12-31',
    isResolved: false,
    outcome: null,
    oracleAddress: '0xoracle_nasa_attestation_mars',
    isVerified: false,
    verificationHash: '0x00000000...0000000',
    createdAt: '2026-06-10',
  },
  {
    id: 'm-4',
    question: 'Will the Federal Reserve lower interest rates below 4.0% in 2026?',
    description: 'This market resolves to YES if the Federal Open Market Committee (FOMC) announces a target federal funds rate lower range below 4.00% during any of its meetings in the calendar year 2026.',
    category: 'Politics',
    yesOdds: 70,
    noOdds: 30,
    totalLiquidity: 185000,
    creator: '0x221b...cc3f',
    resolutionDate: '2026-12-15',
    isResolved: false,
    outcome: null,
    oracleAddress: '0xoracle_fed_interest_rate',
    isVerified: true,
    verificationHash: '0x9d4a3e8c...15bb99a',
    createdAt: '2026-06-12',
  },
  {
    id: 'm-5',
    question: 'Will Ethereum gas price average below 6 gwei in Q3 2026?',
    description: 'This market resolves to YES if the average daily gas price of the Ethereum mainnet remains below 6.0 gwei for the entire duration of Q3 2026 (July 1 to Sept 30, inclusive). Data verified via Etherscan API.',
    category: 'Crypto',
    yesOdds: 55,
    noOdds: 45,
    totalLiquidity: 120000,
    creator: '0x5c4a...fe29',
    resolutionDate: '2026-09-30',
    isResolved: false,
    outcome: null,
    oracleAddress: '0xoracle_etherscan_gas_average',
    isVerified: true,
    verificationHash: '0x32ffec98...eeaa98c',
    createdAt: '2026-06-15',
  }
];

const initialStakes: Stake[] = [
  {
    id: 's-1',
    marketId: 'm-1',
    marketQuestion: 'Will Bitcoin surpass $120,000 by December 31, 2026?',
    outcome: 'YES',
    amount: 1000,
    entryOdds: 58,
    committedAmount: 1000,
    uncommittedAmount: 0,
    yieldEarned: 24.50,
    timestamp: '2026-06-10 14:22:01',
    txHash: '0xd4a5...e92f',
    status: 'active',
  },
  {
    id: 's-2',
    marketId: 'm-4',
    marketQuestion: 'Will the Federal Reserve lower interest rates below 4.0% in 2026?',
    outcome: 'YES',
    amount: 500,
    entryOdds: 65,
    committedAmount: 500,
    uncommittedAmount: 0,
    yieldEarned: 8.20,
    timestamp: '2026-06-14 09:11:45',
    txHash: '0x88ec...11cf',
    status: 'active',
  }
];

const initialListings: MarketplaceListing[] = [
  {
    id: 'l-1',
    stakeId: 's-mock-other-1',
    marketId: 'm-2',
    marketQuestion: 'Will OpenAI launch GPT-5 model before November 1, 2026?',
    outcome: 'NO',
    originalAmount: 1200,
    originalOdds: 45,
    sellerAddress: '0xd12a...77ec',
    askingPrice: 850,
    status: 'active',
    createdAt: '2026-06-18 17:30:00',
  },
  {
    id: 'l-2',
    stakeId: 's-mock-other-2',
    marketId: 'm-3',
    marketQuestion: 'Will SpaceX successfully land a Starship on Mars in 2026?',
    outcome: 'YES',
    originalAmount: 2000,
    originalOdds: 20,
    sellerAddress: '0xe88a...9911',
    askingPrice: 500,
    status: 'active',
    createdAt: '2026-06-20 10:15:22',
  }
];

const initialLeaderboard: LeaderboardEntry[] = [
  { rank: 1, username: 'AlphaTrader', address: '0x5c4f...e321', accuracy: 89.2, totalPredictions: 245, volume: 154000, rewardsClaimed: 4500 },
  { rank: 2, username: 'EnclaveWhale', address: '0x71a2...bb89', accuracy: 84.5, totalPredictions: 189, volume: 320000, rewardsClaimed: 3200 },
  { rank: 3, username: 'SatoshiOracle', address: '0x22bd...aa11', accuracy: 81.1, totalPredictions: 150, volume: 92000, rewardsClaimed: 2100 },
  { rank: 4, username: 'YieldFarmer99', address: '0xbc3e...12df', accuracy: 78.4, totalPredictions: 310, volume: 185000, rewardsClaimed: 1950 },
  { rank: 5, username: 'PredictivePulse', address: '0x99e8...cc02', accuracy: 76.9, totalPredictions: 94, volume: 45000, rewardsClaimed: 1100 },
  { rank: 6, username: 'HoodiBull', address: '0x00a1...23ef', accuracy: 74.5, totalPredictions: 112, volume: 72000, rewardsClaimed: 950 },
  { rank: 7, username: 'SafePredictor', address: '0x32c1...e0ef', accuracy: 72.8, totalPredictions: 88, volume: 38000, rewardsClaimed: 800 },
  { rank: 8, username: 'DecentralDino', address: '0xf4a9...88cc', accuracy: 70.2, totalPredictions: 64, volume: 22000, rewardsClaimed: 550 },
  { rank: 9, username: 'EtherEnclave', address: '0xdd10...66fa', accuracy: 68.9, totalPredictions: 125, volume: 59000, rewardsClaimed: 420 },
  { rank: 10, username: 'SXAttestor', address: '0xee92...b5a5', accuracy: 67.5, totalPredictions: 50, volume: 15000, rewardsClaimed: 300 }
];

const getInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        committedBalance: parsed.committedBalance ?? 1500,
        uncommittedBalance: parsed.uncommittedBalance ?? 3500,
        yieldEarned: parsed.yieldEarned ?? 32.70,
        markets: parsed.markets ?? initialMarkets,
        stakes: parsed.stakes ?? initialStakes,
        listings: parsed.listings ?? initialListings,
        leaderboard: parsed.leaderboard ?? initialLeaderboard,
        chainSubAccounts: [],
      };
    }
  } catch (e) {
    console.error('Failed to load market state from localStorage', e);
  }
  return {
    committedBalance: 1500,
    uncommittedBalance: 3500,
    yieldEarned: 32.70,
    markets: initialMarkets,
    stakes: initialStakes,
    listings: initialListings,
    leaderboard: initialLeaderboard,
    chainSubAccounts: [],
  };
};

export const useMarketStore = create<MarketStore>((set, get) => ({
  ...getInitialState(),

  depositStablecoins: (amount) => {
    set((state) => {
      const newState = {
        ...state,
        uncommittedBalance: state.uncommittedBalance + amount,
      };
      saveStateToLocalStorage(newState);
      return newState;
    });
  },

  withdrawFunds: (amount) => {
    const { uncommittedBalance, committedBalance } = get();
    let success = false;
    let requiresPenalty = false;
    let penaltyAmount = 0;

    if (amount <= uncommittedBalance) {
      set((state) => {
        const newState = {
          ...state,
          uncommittedBalance: state.uncommittedBalance - amount,
        };
        saveStateToLocalStorage(newState);
        return newState;
      });
      success = true;
    } else if (amount <= uncommittedBalance + committedBalance) {
      // Overdrawing uncommitted balance triggers early withdrawal warning & penalty (10% of committed portion)
      const committedOverdrawn = amount - uncommittedBalance;
      penaltyAmount = committedOverdrawn * 0.10;
      requiresPenalty = true;
      success = true;

      set((state) => {
        const newState = {
          ...state,
          uncommittedBalance: 0,
          committedBalance: state.committedBalance - committedOverdrawn - penaltyAmount,
          // Accrued penalty can be simulated as burned/governance fee
        };
        saveStateToLocalStorage(newState);
        return newState;
      });
    }

    return { success, requiresPenalty, penaltyAmount };
  },

  stakeOnMarket: (marketId, outcome, amount) => {
    const { uncommittedBalance, markets } = get();
    if (amount > uncommittedBalance) {
      return { success: false, txHash: '' };
    }

    const txHash = '0xtx_' + Math.random().toString(36).substring(2, 22) + 'a1e9';
    const market = markets.find(m => m.id === marketId);
    if (!market) return { success: false, txHash: '' };

    // Dynamically adjust market odds on stakes
    const oldLiquidity = market.totalLiquidity;
    const newLiquidity = oldLiquidity + amount;
    
    let yesWeight = market.yesOdds * oldLiquidity;
    let noWeight = market.noOdds * oldLiquidity;

    if (outcome === 'YES') {
      yesWeight += amount * 100;
    } else {
      noWeight += amount * 100;
    }

    const newYesOdds = Math.round(Math.max(5, Math.min(95, yesWeight / newLiquidity)));
    const newNoOdds = 100 - newYesOdds;

    const newStake: Stake = {
      id: `s-${Date.now()}`,
      marketId,
      marketQuestion: market.question,
      outcome,
      amount,
      entryOdds: outcome === 'YES' ? market.yesOdds : market.noOdds,
      committedAmount: amount,
      uncommittedAmount: 0,
      yieldEarned: 0,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      txHash,
      status: 'active',
    };

    set((state) => {
      const updatedMarkets = state.markets.map(m => 
        m.id === marketId 
          ? { ...m, yesOdds: newYesOdds, noOdds: newNoOdds, totalLiquidity: newLiquidity } 
          : m
      );
      
      const newState = {
        ...state,
        uncommittedBalance: state.uncommittedBalance - amount,
        committedBalance: state.committedBalance + amount,
        markets: updatedMarkets,
        stakes: [...state.stakes, newStake],
      };
      saveStateToLocalStorage(newState);
      return newState;
    });

    return { success: true, txHash };
  },

  createMarket: (marketData) => {
    const { uncommittedBalance } = get();
    const cost = marketData.totalLiquidity; // initial liquidity is committed from uncommittedBalance
    
    if (cost > uncommittedBalance) {
      return { success: false, marketId: '' };
    }

    const marketId = `m-${Date.now()}`;
    const verificationHash = '0xverified_' + Math.random().toString(16).substring(2, 18) + 'de4';
    
    const newMarket: Market = {
      ...marketData,
      id: marketId,
      yesOdds: 50,
      noOdds: 50,
      isResolved: false,
      outcome: null,
      isVerified: true,
      verificationHash,
      createdAt: new Date().toISOString().substring(0, 10),
    };

    set((state) => {
      const newState = {
        ...state,
        uncommittedBalance: state.uncommittedBalance - cost,
        committedBalance: state.committedBalance + cost,
        markets: [newMarket, ...state.markets],
      };
      saveStateToLocalStorage(newState);
      return newState;
    });

    return { success: true, marketId };
  },

  resolveMarket: (marketId, outcome) => {
    set((state) => {
      const updatedMarkets = state.markets.map(m => 
        m.id === marketId ? { ...m, isResolved: true, outcome } : m
      );
      
      // Also update stakes related to this market
      const updatedStakes = state.stakes.map(s => {
        if (s.marketId === marketId) {
          return { ...s, status: 'resolved' as const };
        }
        return s;
      });

      const newState = {
        ...state,
        markets: updatedMarkets,
        stakes: updatedStakes,
      };
      saveStateToLocalStorage(newState);
      return newState;
    });
  },

  claimPayout: (stakeId) => {
    const { stakes, markets } = get();
    const stake = stakes.find(s => s.id === stakeId);
    if (!stake || stake.status !== 'resolved') return { success: false, payout: 0, txHash: '' };

    const market = markets.find(m => m.id === stake.marketId);
    if (!market || !market.isResolved || !market.outcome) return { success: false, payout: 0, txHash: '' };

    let payout = 0;
    const isWinner = stake.outcome === market.outcome;

    if (isWinner) {
      // Winnings logic: (Stake Amount / (Entry Odds / 100))
      // e.g. 100 USDC staked on YES at 50% odds yields 200 USDC
      payout = stake.amount / (stake.entryOdds / 100);
    } else if (market.outcome === 'CANCEL') {
      payout = stake.amount; // Refund
    }

    const txHash = '0xclaim_' + Math.random().toString(36).substring(2, 22) + 'a18';

    set((state) => {
      const updatedStakes = state.stakes.map(s => 
        s.id === stakeId ? { ...s, status: 'resolved' as const, amount: 0, committedAmount: 0 } : s
      );

      const newState = {
        ...state,
        committedBalance: Math.max(0, state.committedBalance - stake.amount),
        uncommittedBalance: state.uncommittedBalance + payout,
        stakes: updatedStakes,
      };
      saveStateToLocalStorage(newState);
      return newState;
    });

    return { success: true, payout, txHash };
  },

  listPositionForSale: (stakeId, askingPrice) => {
    const { stakes } = get();
    const stake = stakes.find(s => s.id === stakeId);
    if (!stake || stake.status !== 'active') return { success: false, listingId: '' };

    const listingId = `l-${Date.now()}`;
    const newListing: MarketplaceListing = {
      id: listingId,
      stakeId,
      marketId: stake.marketId,
      marketQuestion: stake.marketQuestion,
      outcome: stake.outcome,
      originalAmount: stake.amount,
      originalOdds: stake.entryOdds,
      sellerAddress: 'user_wallet_address_0x', // filled in UI
      askingPrice,
      status: 'active',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    set((state) => {
      const updatedStakes = state.stakes.map(s => 
        s.id === stakeId ? { ...s, status: 'listed' as const } : s
      );
      
      const newState = {
        ...state,
        stakes: updatedStakes,
        listings: [newListing, ...state.listings],
      };
      saveStateToLocalStorage(newState);
      return newState;
    });

    return { success: true, listingId };
  },

  buyListing: (listingId, _buyerAddress) => {
    const { listings, uncommittedBalance } = get();
    const listing = listings.find(l => l.id === listingId);
    if (!listing || listing.status !== 'active') return { success: false, txHash: '' };

    if (uncommittedBalance < listing.askingPrice) {
      return { success: false, txHash: '' };
    }

    const txHash = '0xbuy_' + Math.random().toString(36).substring(2, 22) + 'bf7';

    // Transfer stake ownership to buyer. Create new stake for buyer, delete/deactivate seller stake
    const newStake: Stake = {
      id: `s-${Date.now()}`,
      marketId: listing.marketId,
      marketQuestion: listing.marketQuestion,
      outcome: listing.outcome,
      amount: listing.originalAmount,
      entryOdds: listing.originalOdds,
      committedAmount: listing.originalAmount,
      uncommittedAmount: 0,
      yieldEarned: 0,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      txHash,
      status: 'active',
    };

    set((state) => {
      // Find and remove/update the original stake if it belongs to this user,
      // (in simulated multi-user environment, we either add stake for user if they are buying, or subtract if they are selling).
      // Here, the current user is buying, so their uncommittedBalance drops by askingPrice, committedBalance rises by originalAmount.
      const updatedListings = state.listings.map(l => 
        l.id === listingId ? { ...l, status: 'sold' as const } : l
      );

      const newState = {
        ...state,
        uncommittedBalance: state.uncommittedBalance - listing.askingPrice,
        committedBalance: state.committedBalance + listing.originalAmount,
        listings: updatedListings,
        stakes: [...state.stakes, newStake],
      };
      saveStateToLocalStorage(newState);
      return newState;
    });

    return { success: true, txHash };
  },

  cancelListing: (listingId) => {
    const { listings } = get();
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;

    set((state) => {
      const updatedListings = state.listings.map(l => 
        l.id === listingId ? { ...l, status: 'cancelled' as const } : l
      );
      
      const updatedStakes = state.stakes.map(s => 
        s.id === listing.stakeId ? { ...s, status: 'active' as const } : s
      );

      const newState = {
        ...state,
        listings: updatedListings,
        stakes: updatedStakes,
      };
      saveStateToLocalStorage(newState);
      return newState;
    });
  },

  tickYield: () => {
    const { uncommittedBalance } = get();
    if (uncommittedBalance <= 0) return;
    
    // Simulate yield accrual: 8% APY calculated per second
    const yieldPerSecond = (uncommittedBalance * 0.08) / (365 * 24 * 3600);
    
    set((state) => {
      const newState = {
        ...state,
        yieldEarned: state.yieldEarned + yieldPerSecond,
      };
      // We don't save to localStorage on every second tick to prevent disk throttling,
      // but the state remains in memory. It will be flushed on other actions.
      return newState;
    });
  },

  tickOdds: () => {
    // Add micro-fluctuations to odds for live look
    set((state) => {
      const updatedMarkets = state.markets.map(m => {
        if (m.isResolved || Math.random() > 0.3) return m; // 30% chance of fluctuation
        
        const delta = Math.random() > 0.5 ? 1 : -1;
        const newYesOdds = Math.max(5, Math.min(95, m.yesOdds + delta));
        const newNoOdds = 100 - newYesOdds;
        
        return {
          ...m,
          yesOdds: newYesOdds,
          noOdds: newNoOdds,
        };
      });

      return {
        ...state,
        markets: updatedMarkets,
      };
    });
  },

  isTransactionPending: false,

  syncBalances: async (address: string) => {
    try {
      const data = await web3Service.getSxuaDashboard(address as `0x${string}`);
      const yieldTotal = data.subAccounts.reduce((sum, sub) => sum + sub.liveYield, 0n);
      const committed = await fromTokenAmount(data.committed);
      const uncommitted = await fromTokenAmount(data.uncommitted);
      const yieldEarned = await fromTokenAmount(yieldTotal);
      
      set({
        uncommittedBalance: uncommitted,
        committedBalance: committed,
        yieldEarned,
        chainSubAccounts: data.subAccounts,
      });
    } catch (e) {
      console.error('Failed to sync balances with blockchain:', e);
    }
  },

  setTransactionPending: (pending: boolean) => set({ isTransactionPending: pending })
}));
