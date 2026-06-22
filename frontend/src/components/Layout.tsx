import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Award, 
  Gift, 
  UserCheck, 
  ShieldAlert, 
  Layers, 
  Activity, 
  Coins, 
  LogOut, 
  Menu, 
  X, 
  Wallet,
  Settings,
  ChevronDown,
  RefreshCw,
  Globe
} from 'lucide-react';
import { useAccount, useDisconnect, useNetwork, useBalance } from '../hooks/useWeb3';
import { useMarketStore } from '../stores/useMarketStore';
import { useSecurityStore } from '../stores/useSecurityStore';
import { shortenAddress, formatCurrency } from '../utils/helpers';
import { Button } from './ui/Button';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address, isConnected, isRegistered, registeredUsername, subAccounts } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { chain, switchChainAsync } = useNetwork();
  useBalance();
  
  const { committedBalance, uncommittedBalance, yieldEarned, tickYield, tickOdds, syncBalances, isTransactionPending } = useMarketStore();
  const { rateLimitRequestCount, rateLimitThreshold, tickRateLimit, streamJailbreakLog } = useSecurityStore();

  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const [subAccountDropdownOpen, setSubAccountDropdownOpen] = useState(false);
  const [selectedSubAccount, setSelectedSubAccount] = useState(subAccounts[0]);

  // Sync real balances from the blockchain when connected
  useEffect(() => {
    if (!isConnected || !address) return;
    
    // Sync immediately on mount/address change
    syncBalances(address);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isTransactionPending) {
        syncBalances(address);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isConnected, address, syncBalances, isTransactionPending]);

  // Periodic tickers for live Web3 simulation
  useEffect(() => {
    const yieldInterval = setInterval(() => {
      tickYield();
    }, 1000);

    const oddsInterval = setInterval(() => {
      tickOdds();
    }, 4000);

    const secInterval = setInterval(() => {
      tickRateLimit();
      if (Math.random() > 0.85) {
        streamJailbreakLog(); // Simulate random attack log ticks
      }
    }, 3000);

    return () => {
      clearInterval(yieldInterval);
      clearInterval(oddsInterval);
      clearInterval(secInterval);
    };
  }, [tickYield, tickOdds, tickRateLimit, streamJailbreakLog]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Markets', path: '/markets', icon: TrendingUp },
    { name: 'My Positions', path: '/positions', icon: Coins },
    { name: 'Claim Payouts', path: '/claim-payout', icon: Award },
    { name: 'Secondary Market', path: '/marketplace', icon: Layers },
    { name: 'Event Explorer', path: '/events', icon: Activity },
    { name: 'Leaderboard', path: '/leaderboard', icon: Award },
    { name: 'Rewards Hub', path: '/rewards', icon: Gift },
    { name: 'Contract Verification', path: '/verification', icon: UserCheck },
    { name: 'Security Dashboard', path: '/security', icon: ShieldAlert },
    { name: 'Architecture Spec', path: '/architecture', icon: Settings },
  ];

  const handleDisconnect = async () => {
    await disconnectAsync();
    navigate('/wallet-connect');
  };

  const handleChainSwitch = async (chainId: 'hoodi' | 'base-sepolia' | 'sx-chain') => {
    await switchChainAsync(chainId);
    setChainDropdownOpen(false);
  };

  // Safe check: If user lands here and is not connected, redirect to Connect Wallet page
  // (unless they are on the landing page)
  useEffect(() => {
    if (!isConnected && location.pathname !== '/' && location.pathname !== '/wallet-connect') {
      navigate('/wallet-connect');
    } else if (isConnected && !isRegistered && location.pathname !== '/' && location.pathname !== '/register' && location.pathname !== '/wallet-connect') {
      navigate('/register');
    }
  }, [isConnected, isRegistered, location.pathname, navigate]);

  const loadPercent = Math.round((rateLimitRequestCount / rateLimitThreshold) * 100);

  return (
    <div className="min-h-screen bg-[#05070f] text-slate-100 flex font-sans">
      
      {/* SIDEBAR - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 glass-panel border-r border-white/5 flex flex-col transition-transform duration-300 xl:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} xl:relative`}>
        {/* Header Branding */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              <span className="text-lg font-bold text-white">🔮</span>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent uppercase">SX SECURE</span>
              <span className="block text-[10px] text-indigo-400 font-semibold uppercase tracking-widest mt-0.5">Prediction</span>
            </div>
          </div>
          <button className="xl:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Enclave Profile Panel */}
        {isConnected && isRegistered && (
          <div className="p-4 mx-4 my-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Enclave Sealed
            </span>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-200">{registeredUsername}</span>
              <span className="text-[10px] text-slate-500 font-mono">{shortenAddress(address)}</span>
            </div>
          </div>
        )}

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-4 py-3 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-950/60 to-violet-950/40 border-l-2 border-indigo-500 text-indigo-300' 
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Metrics Status in Sidebar */}
        <div className="p-4 border-t border-white/5 bg-slate-900/10 space-y-3">
          {/* Sub Account Selector */}
          {isConnected && (
            <div className="relative">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sub Account</span>
              <button 
                onClick={() => setSubAccountDropdownOpen(!subAccountDropdownOpen)}
                className="w-full bg-[#0d1222]/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-left text-slate-200 font-medium flex items-center justify-between hover:bg-[#0d1222]"
              >
                <span>{selectedSubAccount?.name || 'Default'}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>
              {subAccountDropdownOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#0c0e18] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                  {subAccounts.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setSelectedSubAccount(sub);
                        setSubAccountDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-slate-300 hover:text-white border-b border-white/5"
                    >
                      <div className="font-semibold">{sub.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{shortenAddress(sub.address)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rate limiting stats */}
          <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>API Gateway Load</span>
              <span className={loadPercent > 80 ? 'text-rose-400' : 'text-indigo-400'}>{loadPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${loadPercent > 80 ? 'bg-rose-500' : loadPercent > 50 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(100, loadPercent)}%` }}
              />
            </div>
          </div>

          {/* Network details */}
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-indigo-400" />
              {chain.name}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <RefreshCw className="h-3 w-3 text-emerald-400 animate-spin-slow" />
              4 Gwei
            </span>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-xs text-rose-400/80 hover:text-rose-400 hover:bg-rose-950/20"
            onClick={handleDisconnect}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect Wallet
          </Button>
        </div>
      </aside>

      {/* MAIN VIEW CONTROLLER */}
      <div className="flex-1 flex flex-col min-w-0 xl:pl-0">
        
        {/* HEADER BAR */}
        <header className="sticky top-0 z-30 h-16 bg-[#05070f]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button className="xl:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex items-center gap-4">
              {/* Balances Display */}
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unified Balance</span>
                <span className="text-sm font-bold text-white">{formatCurrency(uncommittedBalance + committedBalance)}</span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Uncommitted (APY 8%)</span>
                <span className="text-sm font-bold text-indigo-400">{formatCurrency(uncommittedBalance)}</span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Yield Accrued</span>
                <span className="text-sm font-bold text-emerald-400 flex items-center gap-1 font-mono">
                  +{yieldEarned.toFixed(6)}
                </span>
              </div>
            </div>
          </div>

          {/* Wallet Actions / Network switch */}
          {isConnected ? (
            <div className="flex items-center gap-3">
              {/* Chain Selector */}
              <div className="relative">
                <button
                  onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                  className="bg-slate-900 border border-white/10 hover:bg-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all duration-150"
                >
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  {chain.name}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
                {chainDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-44 bg-[#0d1222] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                    <button onClick={() => handleChainSwitch('hoodi')} className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white border-b border-white/5">
                      Hoodi Testnet
                    </button>
                    <button onClick={() => handleChainSwitch('base-sepolia')} className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white border-b border-white/5">
                      Base Sepolia
                    </button>
                    <button onClick={() => handleChainSwitch('sx-chain')} className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white">
                      SX Chain Mainnet
                    </button>
                  </div>
                )}
              </div>

              {/* Wallet Address Badge */}
              <div className="bg-gradient-to-r from-indigo-950/40 to-violet-950/20 border border-indigo-500/20 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200 font-mono">{shortenAddress(address)}</span>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate('/wallet-connect')}>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </Button>
          )}
        </header>

        {/* SCROLLABLE VIEWPORT CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>

    </div>
  );
};
