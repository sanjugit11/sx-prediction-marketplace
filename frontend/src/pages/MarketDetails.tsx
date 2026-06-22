import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldCheck, ArrowLeft, RefreshCw, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { formatCurrency, formatPercentage } from '../utils/helpers';
import { fromTokenAmount, web3Service } from '../services/web3';
import { isAddress } from 'viem';
import type { Market } from '../types';

export const MarketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { markets, stakeOnMarket, uncommittedBalance } = useMarketStore();
  const { address } = useAccount();

  const [stakeAmount, setStakeAmount] = useState<number>(100);
  const [stakeOutcome, setStakeOutcome] = useState<'YES' | 'NO'>('YES');
  const [txState, setTxState] = useState<'idle' | 'sealing' | 'success'>('idle');
  const [txHash, setTxHash] = useState('');
  const [chainMarket, setChainMarket] = useState<Market | null>(null);
  const [chainUncommittedBalance, setChainUncommittedBalance] = useState<number | null>(null);
  const [oddsMultiples, setOddsMultiples] = useState({ yes: 2, no: 2 });

  useEffect(() => {
    if (!id || !isAddress(id)) return;
    let cancelled = false;
    web3Service.getMarket(id as `0x${string}`)
      .then(async (item) => {
        const yesPool = await fromTokenAmount(item.yesPool);
        const noPool = await fromTokenAmount(item.noPool);
        const yesPercent = yesPool + noPool > 0 ? (yesPool / (yesPool + noPool)) * 100 : 50;
        const yesMultiple = Number(item.yesOdds) / 1e18;
        const noMultiple = Number(item.noOdds) / 1e18;
        if (!cancelled) {
          setOddsMultiples({ yes: yesMultiple, no: noMultiple });
          setChainMarket({
            id: item.address,
            question: item.question,
            description: item.resolved ? `Resolved ${item.winner}` : 'On-chain prediction market',
            category: 'Crypto',
            yesOdds: yesPercent,
            noOdds: 100 - yesPercent,
            totalLiquidity: yesPool + noPool,
            creator: item.address,
            resolutionDate: new Date(Number(item.endTime) * 1000).toISOString().slice(0, 10),
            isResolved: item.resolved,
            outcome: item.winner,
            oracleAddress: item.address,
            isVerified: true,
            verificationHash: item.address,
            createdAt: '',
          });
        }
      })
      .catch(() => {
        if (!cancelled) setChainMarket(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    web3Service.getSxuaDashboard(address as `0x${string}`)
      .then(async (data) => {
        if (!cancelled) setChainUncommittedBalance(await fromTokenAmount(data.uncommitted));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [address]);

  const market = chainMarket ?? markets.find(m => m.id === id);

  if (!market) {
    return (
      <div className="text-center py-16">
        <HelpCircle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-white">Prediction Market Not Found</h2>
        <Button onClick={() => navigate('/markets')} className="mt-4">Back to Markets</Button>
      </div>
    );
  }

  // Odds history mock
  const oddsHistory = [
    { hour: '12:00', yesOdds: market.yesOdds - 4, noOdds: market.noOdds + 4 },
    { hour: '13:00', yesOdds: market.yesOdds - 2, noOdds: market.noOdds + 2 },
    { hour: '14:00', yesOdds: market.yesOdds + 1, noOdds: market.noOdds - 1 },
    { hour: '15:00', yesOdds: market.yesOdds - 1, noOdds: market.noOdds + 1 },
    { hour: '16:00', yesOdds: market.yesOdds, noOdds: market.noOdds }
  ];

  // Winnings math: payout = stake / (odds / 100)
  // e.g. 100 USDC staked on YES at 50% odds yields 200 USDC
  const selectedOdds = stakeOutcome === 'YES' ? market.yesOdds : market.noOdds;
  const estimatedPayout = stakeAmount > 0 ? (stakeAmount / (selectedOdds / 100)) : 0;
  const netProfit = Math.max(0, estimatedPayout - stakeAmount);
  const availableBalance = chainUncommittedBalance ?? uncommittedBalance;

  const handlePlaceStake = async () => {
    if (!address) return;
    if (stakeAmount > availableBalance || stakeAmount <= 0) return;

    setTxState('sealing');
    
    // Simulate secure enclave signing & on-chain relay
    const receipt = await web3Service.placeStake(market.id, stakeOutcome, stakeAmount, address);
    
    const res = stakeOnMarket(market.id, stakeOutcome, stakeAmount);
    setTxHash(receipt.transactionHash || res.txHash);
    if (isAddress(market.id)) {
      const refreshed = await web3Service.getMarket(market.id as `0x${string}`);
      setOddsMultiples({ yes: Number(refreshed.yesOdds) / 1e18, no: Number(refreshed.noOdds) / 1e18 });
    }
    setTxState('success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Back link */}
      <button 
        onClick={() => navigate('/markets')} 
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Markets
      </button>

      {/* Grid details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Specs & Chart */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border border-white/5">
            <CardHeader className="space-y-3">
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 text-[10px] font-bold uppercase tracking-wide">
                  {market.category}
                </span>
                {market.isVerified && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] font-bold flex items-center gap-1 uppercase tracking-wide">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>
              
              <CardTitle className="text-xl md:text-2xl font-extrabold leading-snug">
                {market.question}
              </CardTitle>
              <CardDescription className="text-xs md:text-sm text-slate-400 leading-relaxed pt-2">
                {market.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 border-t border-white/5 space-y-6">
              
              {/* Odds Area chart */}
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-4">Historical Probability (YES)</span>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={oddsHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="hour" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d1222', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                        itemStyle={{ color: '#fff', fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="yesOdds" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorYes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Market Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-4 border-t border-white/5">
                <div>
                  <span className="text-slate-500 block">Total Volume</span>
                  <span className="font-bold text-white font-mono">{formatCurrency(market.totalLiquidity)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">YES Odds</span>
                  <span className="font-bold text-indigo-300 font-mono">{oddsMultiples.yes.toFixed(2)}x</span>
                </div>
                <div>
                  <span className="text-slate-500 block">NO Odds</span>
                  <span className="font-bold text-slate-200 font-mono">{oddsMultiples.no.toFixed(2)}x</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Resolution Date</span>
                  <span className="font-bold text-white">{market.resolutionDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Oracle Address</span>
                  <span className="font-bold text-indigo-300 font-mono select-all truncate block">{market.oracleAddress}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Verification Hash</span>
                  <span className="font-bold text-emerald-400 font-mono select-all truncate block">{market.verificationHash}</span>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Column: Trading terminal */}
        <div className="lg:col-span-4">
          <Card className="border border-white/5 glow-indigo sticky top-20">
            <CardHeader>
              <CardTitle>Trading Terminal</CardTitle>
              <CardDescription>Authorize predictions using isolated enclave memory</CardDescription>
            </CardHeader>
            <CardContent>
              {txState === 'idle' && (
                <div className="space-y-4">
                  {/* Select YES / NO */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setStakeOutcome('YES')}
                      className={`py-3 rounded-lg text-xs font-bold border transition-all duration-150 ${
                        stakeOutcome === 'YES'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Staking on</span>
                      YES ({formatPercentage(market.yesOdds)})
                    </button>
                    <button
                      onClick={() => setStakeOutcome('NO')}
                      className={`py-3 rounded-lg text-xs font-bold border transition-all duration-150 ${
                        stakeOutcome === 'NO'
                          ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-[9px] uppercase text-slate-450 mb-0.5">Staking on</span>
                      NO ({formatPercentage(market.noOdds)})
                    </button>
                  </div>

                  {/* Input amount */}
                  <Input
                    label="Stake Amount (USD)"
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0)}
                    error={stakeAmount > availableBalance ? 'Exceeds uncommitted balance' : undefined}
                  />

                  {/* Math calculations box */}
                  {stakeAmount > 0 && (
                    <div className="p-3 bg-slate-900/50 border border-white/5 rounded-xl text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current Odds:</span>
                        <span className="font-semibold text-white">{selectedOdds}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Estimated Payout:</span>
                        <span className="font-bold text-emerald-400 font-mono">{formatCurrency(estimatedPayout)}</span>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-2 mt-1">
                        <span className="text-slate-400 font-semibold">Net Profit (on Win):</span>
                        <span className="font-extrabold text-white font-mono">{formatCurrency(netProfit)}</span>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    onClick={handlePlaceStake}
                    className="w-full"
                    disabled={stakeAmount <= 0 || stakeAmount > availableBalance}
                  >
                    Confirm Enclave Stake
                  </Button>
                </div>
              )}

              {txState === 'sealing' && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                  <div className="text-center">
                    <span className="block text-xs font-bold text-slate-200">Sealing stake in Enclave...</span>
                    <span className="block text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
                      Publishing transaction
                    </span>
                  </div>
                </div>
              )}

              {txState === 'success' && (
                <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <span className="block text-sm font-bold text-slate-200">Stake Placed Successfully!</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">Your prediction position is sealed. You can track this under My Positions.</span>
                  </div>
                  <div className="w-full bg-slate-900/40 p-2.5 rounded border border-white/5 text-[9px] font-mono text-slate-400 select-all leading-normal truncate">
                    Tx: {txHash}
                  </div>
                  <Button size="sm" onClick={() => setTxState('idle')} className="w-full">
                    Place Another Stake
                  </Button>
                </div>
              )}

            </CardContent>
            <CardFooter className="flex justify-between text-[11px] text-slate-500">
              <span>Uncommitted Cap: {formatCurrency(availableBalance)}</span>
              <span className="text-indigo-400 hover:underline cursor-pointer" onClick={() => navigate('/deposit')}>Deposit</span>
            </CardFooter>
          </Card>
        </div>

      </div>

    </div>
  );
};
