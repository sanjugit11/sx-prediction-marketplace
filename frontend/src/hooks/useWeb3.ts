import { useWalletStore } from '../stores/useWalletStore';
import type { ChainId } from '../types';
import { useState } from 'react';
import { web3Service } from '../services/web3';

export const useAccount = () => {
  const {
    address,
    isConnected,
    isRegistered,
    registeredUsername,
    registeredEmail,
    enclaveKey,
    attestationHash,
    subAccounts
  } = useWalletStore();

  return {
    address,
    isConnected,
    isRegistered,
    registeredUsername,
    registeredEmail,
    enclaveKey,
    attestationHash,
    subAccounts,
  };
};

export const useConnect = () => {
  const connect = useWalletStore((s) => s.connect);
  const [isLoading, setIsLoading] = useState(false);

  const connectAsync = async (params?: { address: string; chainId: ChainId }) => {
    setIsLoading(true);
    try {
      const wallet = params ?? await web3Service.connectWallet();
      connect(wallet.address, wallet.chainId);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    connectAsync,
    isLoading,
  };
};

export const useDisconnect = () => {
  const disconnect = useWalletStore((s) => s.disconnect);
  const [isLoading, setIsLoading] = useState(false);

  const disconnectAsync = async () => {
    setIsLoading(true);
    await new Promise((res) => setTimeout(res, 400));
    disconnect();
    setIsLoading(false);
  };

  return {
    disconnectAsync,
    isLoading,
  };
};

export const useNetwork = () => {
  const chainId = useWalletStore((s) => s.chainId);
  const switchChain = useWalletStore((s) => s.switchChain);
  const [isLoading, setIsLoading] = useState(false);

  const switchChainAsync = async (newChainId: ChainId) => {
    setIsLoading(true);
    try {
      if (newChainId === 'hoodi') {
        await web3Service.switchToHoodi();
      }
      switchChain(newChainId);
    } finally {
      setIsLoading(false);
    }
  };

  const getChainName = (id: ChainId) => {
    switch (id) {
      case 'hoodi':
        return 'Hoodi Testnet';
      case 'base-sepolia':
        return 'Base Sepolia';
      case 'sx-chain':
        return 'SX Chain Mainnet';
      default:
        return 'Unknown Chain';
    }
  };

  return {
    chain: {
      id: chainId,
      name: getChainName(chainId),
    },
    switchChainAsync,
    isLoading,
  };
};

export const useBalance = () => {
  const balance = useWalletStore((s) => s.balance);
  return {
    balance,
    formatted: `${balance.toLocaleString()} USDC`,
  };
};
