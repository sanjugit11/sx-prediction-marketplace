import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, ChevronRight, Plus, RefreshCw, BarChart2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useMarketStore } from '../stores/useMarketStore';
import { formatCurrency, formatPercentage } from '../utils/helpers';
import type { Market, MarketCategory } from '../types';
import { fromTokenAmount, web3Service } from '../services/web3';

export const MarketList: React.FC = () => {
  const navigate = useNavigate();
  const { markets } = useMarketStore();
  const [chainMarkets, setChainMarkets] = useState<Market[] | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | 'All'>('All');

  const categories: (MarketCategory | 'All')[] = ['All', 'Crypto', 'Politics', 'Tech', 'Sports', 'Science'];
  const displayedMarkets = chainMarkets ?? markets;

  useEffect(() => {
    let cancelled = false;
    web3Service.getMarkets()
      .then(async (items) => {
        const mapped = await Promise.all(items.map(async (market) => {
          const yesPool = await fromTokenAmount(market.yesPool);
          const noPool = await fromTokenAmount(market.noPool);
          const yesMultiple = Number(market.yesOdds) / 1e18;
          const noMultiple = Number(market.noOdds) / 1e18;
          const yesPercent = yesPool + noPool > 0 ? (yesPool / (yesPool + noPool)) * 100 : 50;
          return {
            id: market.address,
            question: market.question,
            description: market.resolved ? `Resolved ${market.winner}` : 'On-chain prediction market',
            category: 'Crypto' as MarketCategory,
            yesOdds: Number.isFinite(yesPercent) ? yesPercent : yesMultiple * 50,
            noOdds: 100 - (Number.isFinite(yesPercent) ? yesPercent : noMultiple * 50),
            totalLiquidity: yesPool + noPool,
            creator: market.address,
            resolutionDate: new Date(Number(market.endTime) * 1000).toISOString().slice(0, 10),
            isResolved: market.resolved,
            outcome: market.winner,
            oracleAddress: market.address,
            isVerified: true,
            verificationHash: market.address,
            createdAt: '',
          } satisfies Market;
        }));
        if (!cancelled) setChainMarkets(mapped);
      })
      .catch(() => {
        if (!cancelled) setChainMarkets(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMarkets = useMemo(() => displayedMarkets.filter(m => {
    const matchesSearch = m.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }), [displayedMarkets, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Prediction Markets</h1>
          <p className="text-xs text-slate-400 mt-1">Staking contracts secured by off-chain SGX computation node consensus.</p>
        </div>
        <Button size="sm" onClick={() => navigate('/create-market')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create New Market
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Category buttons */}
        <div className="flex overflow-x-auto gap-2 pb-2 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 shrink-0 ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white border-transparent shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                  : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search active markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d1222] border border-white/10 rounded-lg pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        </div>
      </div>

      {/* Grid listing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredMarkets.length > 0 ? (
          filteredMarkets.map((market) => (
            <Card 
              key={market.id} 
              onClick={() => navigate(`/markets/${market.id}`)}
              className="border border-white/5 hover:border-white/10 hover-glow cursor-pointer"
            >
              <CardContent className="p-5 space-y-4">
                
                {/* Top Badge Indicators */}
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 uppercase tracking-wide">
                      {market.category}
                    </span>
                    {market.isVerified && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex items-center gap-1 uppercase tracking-wide">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-450 font-mono uppercase tracking-wider">
                    <BarChart2 className="h-3.5 w-3.5 text-indigo-400" />
                    Vol: {formatCurrency(market.totalLiquidity)}
                  </div>
                </div>

                {/* Question */}
                <h3 className="text-sm md:text-base font-extrabold text-white leading-snug line-clamp-2">
                  {market.question}
                </h3>

                {/* Odds sliders layout */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-350">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      YES: {formatPercentage(market.yesOdds)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      NO: {formatPercentage(market.noOdds)}
                      <span className="h-2 w-2 rounded-full bg-slate-600" />
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 flex overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-600 to-violet-500 h-full rounded-l transition-all duration-300"
                      style={{ width: `${market.yesOdds}%` }}
                    />
                    <div 
                      className="bg-slate-700 h-full rounded-r transition-all duration-300"
                      style={{ width: `${market.noOdds}%` }}
                    />
                  </div>
                </div>

                {/* Resolution specs */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-white/5">
                  <span>RESOLVES: {market.resolutionDate}</span>
                  <span className="text-indigo-400 font-bold uppercase flex items-center gap-1 hover:text-indigo-300 transition-colors">
                    Trade Terminal
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>

              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2 text-center py-16 border border-dashed border-white/5 rounded-xl">
            <RefreshCw className="h-8 w-8 text-slate-500 animate-spin-slow mx-auto mb-3" />
            <span className="block text-xs font-bold text-slate-300">No active prediction markets found</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Try clearing search filters or create a new prediction event.</span>
          </div>
        )}
      </div>

    </div>
  );
};
