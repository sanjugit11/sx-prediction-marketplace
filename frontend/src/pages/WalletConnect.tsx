import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Globe, ArrowRight, Cpu } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { useConnect, useAccount } from '../hooks/useWeb3';
import type { ChainId } from '../types';

export const WalletConnect: React.FC = () => {
  const navigate = useNavigate();
  const { isRegistered } = useAccount();
  const { connectAsync, isLoading } = useConnect();
  
  const [selectedChain, setSelectedChain] = useState<ChainId>('hoodi');
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const walletOptions = [
    { id: 'metamask', name: 'MetaMask', icon: 'M', desc: 'Connect to MetaMask browser extension.' },
    { id: 'coinbase', name: 'Coinbase Wallet', icon: 'C', desc: 'Secure connection via Coinbase app.' },
    { id: 'walletconnect', name: 'WalletConnect', icon: 'W', desc: 'Connect through your injected wallet provider.' }
  ];

  const handleConnect = async (walletId: string) => {
    setConnectingWallet(walletId);
    
    try {
      await connectAsync();
      
      // Auto-routing depending on registration state
      if (!isRegistered) {
        navigate('/register');
      } else {
        navigate('/dashboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnectingWallet(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070f] relative overflow-hidden flex flex-col justify-center items-center p-6">
      
      {/* Background elements */}
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md relative z-10">
        
        {/* Branding */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <span className="text-xl">🔮</span>
          </div>
          <div>
            <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase">SX SECURE</span>
            <span className="block text-[10px] text-indigo-400 font-semibold uppercase tracking-widest mt-0.5">Prediction Gate</span>
          </div>
        </div>

        <Card className="border border-white/10 glow-indigo">
          <CardHeader className="text-center">
            <CardTitle>Connect Web3 Wallet</CardTitle>
            <CardDescription>Select blockchain network and authorize credentials</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            
            {/* Network Selector */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                Select Settlement Chain
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['hoodi'] as ChainId[]).map((c) => {
                  const label = c === 'hoodi' ? 'Hoodi' : c === 'base-sepolia' ? 'Base Sep' : 'SX Chain';
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedChain(c)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-semibold border transition-all duration-150 ${
                        selectedChain === c 
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wallet Selection Rows */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-indigo-400" />
                Select Provider
              </span>
              <div className="space-y-2">
                {walletOptions.map((opt) => {
                  const isConnecting = connectingWallet === opt.id && isLoading;
                  return (
                    <button
                      key={opt.id}
                      disabled={isLoading}
                      onClick={() => handleConnect(opt.id)}
                      className="w-full bg-[#0d1222]/80 hover:bg-[#11172b] border border-white/5 hover:border-white/10 p-3.5 rounded-xl text-left flex items-center justify-between transition-all duration-150 disabled:opacity-40"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-xs font-extrabold text-indigo-300">{opt.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-white">{opt.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                        </div>
                      </div>
                      {isConnecting ? (
                        <div className="animate-spin h-4.5 w-4.5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Enclave notice */}
            <div className="p-3 bg-slate-900/50 border border-white/5 rounded-lg flex gap-2.5 items-start">
              <Cpu className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 leading-normal">
                Connecting authorizes a cryptographic key signature within the secure enclave. This signature manages prediction payouts without custody of assets.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>

    </div>
  );
};
