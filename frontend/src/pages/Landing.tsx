import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Cpu, Coins, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAccount } from '../hooks/useWeb3';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, isRegistered } = useAccount();

  const handleLaunchApp = () => {
    if (!isConnected) {
      navigate('/wallet-connect');
    } else if (!isRegistered) {
      navigate('/register');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#05070f] relative overflow-hidden flex flex-col justify-between">
      
      {/* Background FX */}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Landing Header */}
      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <span className="text-xl">🔮</span>
          </div>
          <div>
            <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">SX SECURE</span>
            <span className="block text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">Prediction Markets</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm"
          onClick={handleLaunchApp}
          className="border-indigo-500/30 hover:border-indigo-500/70 text-indigo-300"
        >
          {isConnected ? 'Enter App' : 'Connect Wallet'}
        </Button>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24 relative z-10 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Next-Gen Enclave Secured Oracle Settlements
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Predict Securely.<br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Earn Automated Yield.
              </span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-xl mx-auto lg:mx-0">
              The first decentralized prediction marketplace secured by hardware-level Intel SGX Secure Enclaves. Deposits stay uncommitted, generating 8% simulated APY, while you trade on real-world events.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Button size="lg" className="w-full sm:w-auto" onClick={handleLaunchApp}>
                Launch Application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto"
                onClick={() => navigate('/architecture')}
              >
                Read Technical Spec
              </Button>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/5 max-w-lg mx-auto lg:mx-0">
              <div>
                <span className="block text-xl md:text-2xl font-bold text-white font-mono">$24.8M</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Volume</span>
              </div>
              <div>
                <span className="block text-xl md:text-2xl font-bold text-indigo-400 font-mono">8.00%</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Vault Yield</span>
              </div>
              <div>
                <span className="block text-xl md:text-2xl font-bold text-emerald-400 font-mono">100%</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">SGX Attestation</span>
              </div>
            </div>
          </div>

          {/* Right Interface Cards Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative glass-panel rounded-2xl p-6 border border-white/10 glow-indigo space-y-6">
              
              {/* Fake Active Market Card */}
              <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between text-xs text-indigo-400 font-semibold">
                  <span>Crypto Price prediction</span>
                  <span>Ends in 12 Days</span>
                </div>
                <h3 className="text-sm font-bold text-white leading-snug">Will Bitcoin trade above $120,000 before December 31, 2026?</h3>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-indigo-600/10 border border-indigo-500/20 p-2.5 rounded-lg text-center">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">YES ODDS</span>
                    <span className="text-base font-extrabold text-indigo-300">62%</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-2.5 rounded-lg text-center">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">NO ODDS</span>
                    <span className="text-base font-extrabold text-slate-300">38%</span>
                  </div>
                </div>
              </div>

              {/* Security features */}
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Intel SGX Sealed Contracts</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Execution of outcome states occurs in sealed memory, protecting oracle feeds from manipulation.</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Cpu className="h-4.5 w-4.5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Unified Yield Isolation</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Funds not committed to active predictions automatically accrue 8% yield, optimizing capital efficiency.</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center shrink-0">
                    <Coins className="h-4.5 w-4.5 text-fuchsia-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Secondary Contract Trading</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Sell prediction positions peer-to-peer on our secondary market prior to event resolutions.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-between border-t border-white/5 relative z-10 text-[11px] text-slate-500">
        <span>© 2026 SX Secure prediction protocol. Built on Hoodi testnet.</span>
        <div className="flex gap-4">
          <a href="#" className="hover:text-indigo-400 transition-colors">Twitter</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">GitHub</a>
          <a href="#" className="hover:text-indigo-400 transition-colors font-mono">v1.2.6-SGX</a>
        </div>
      </footer>

    </div>
  );
};
