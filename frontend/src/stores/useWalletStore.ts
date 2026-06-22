import { create } from 'zustand';
import type { UserWallet, ChainId, SubAccount } from '../types';

interface WalletStore extends UserWallet {
  connect: (address: string, chainId: ChainId) => void;
  disconnect: () => void;
  switchChain: (chainId: ChainId) => void;
  register: (username: string, email: string) => void;
  createSubAccount: (name: string) => void;
  updateBalance: (amount: number) => void;
}

const STORAGE_KEY = 'sx_wallet_state';

const getInitialState = (): UserWallet => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load wallet state from localStorage', e);
  }

  return {
    isConnected: false,
    address: null,
    chainId: 'hoodi',
    balance: 10000, // Initial mock balance of stablecoins
    isRegistered: false,
    registeredUsername: null,
    registeredEmail: null,
    enclaveKey: null,
    attestationHash: null,
    subAccounts: [
      {
        id: 'sub-1',
        name: 'Default Sub-Account',
        address: '0x3c44...7e1a',
        balance: 2500,
        allocatedToMarkets: 0,
        status: 'active',
      },
    ],
  };
};

export const useWalletStore = create<WalletStore>((set) => ({
  ...getInitialState(),

  connect: (address, chainId) => {
    set((state) => {
      const newState = {
        ...state,
        isConnected: true,
        address,
        chainId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  },

  disconnect: () => {
    set((state) => {
      const newState = {
        ...state,
        isConnected: false,
        address: null,
        isRegistered: false,
        registeredUsername: null,
        registeredEmail: null,
        enclaveKey: null,
        attestationHash: null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  },

  switchChain: (chainId) => {
    set((state) => {
      const newState = { ...state, chainId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  },

  register: (username, email) => {
    // Generate simulated enclave keys and attestation hashes
    const enclaveKey = '0xsec_enclave_' + Math.random().toString(36).substring(2, 18);
    const attestationHash = '0xattest_' + Math.random().toString(36).substring(2, 22) + 'd9f2e';

    set((state) => {
      const newState = {
        ...state,
        isRegistered: true,
        registeredUsername: username,
        registeredEmail: email,
        enclaveKey,
        attestationHash,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  },

  createSubAccount: (name) => {
    const randomHex = Math.random().toString(16).substring(2, 6);
    const newSub: SubAccount = {
      id: `sub-${Date.now()}`,
      name,
      address: `0x${randomHex}...${Math.random().toString(16).substring(2, 6)}`,
      balance: 0,
      allocatedToMarkets: 0,
      status: 'active',
    };

    set((state) => {
      const newState = {
        ...state,
        subAccounts: [...state.subAccounts, newSub],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  },

  updateBalance: (amount) => {
    set((state) => {
      const newState = {
        ...state,
        balance: Math.max(0, state.balance + amount),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  },
}));
