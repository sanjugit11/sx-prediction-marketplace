import React, { useState, useEffect } from 'react';
import { Zap, ShieldCheck, Trophy, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { web3Service, fromTokenAmount } from '../services/web3';
import { formatCurrency } from '../utils/helpers';

interface ApiLeaderboardEntry {
  wallet: string;
  rank: number;
  accuracy: number | string;
  totalPredictions: number;
  correctPredictions: number;
  volume: number | string;
  rewardAmount: number | string;
}

export const Leaderboard: React.FC = () => {
  const { address } = useAccount();
  const { setTransactionPending, syncBalances } = useMarketStore();

  const [entries, setEntries] = useState<ApiLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<'idle' | 'success' | 'no-reward'>('idle');
  const [pendingReward, setPendingReward] = useState<number>(0);

  // Fetch leaderboard from backend API
  useEffect(() => {
    let cancelled = false;
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data: ApiLeaderboardEntry[] = await response.json();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLeaderboard();
    return () => { cancelled = true; };
  }, []);

  // Check on-chain claimable reward for connected user
  useEffect(() => {
    if (!address) return;
    web3Service.pendingReward(address as `0x${string}`)
      .then(async (reward) => {
        setPendingReward(await fromTokenAmount(reward));
      })
      .catch(() => setPendingReward(0));
  }, [address, claimResult]);

  const handleClaimReward = async () => {
    if (!address) return;
    setIsClaiming(true);
    setTransactionPending(true);
    try {
      if (pendingReward <= 0) {
        setClaimResult('no-reward');
        return;
      }
      const receipt = await web3Service.claimReward();
      if (receipt.status === 'success') {
        setClaimResult('success');
        await syncBalances(address);
      }
    } catch (err) {
      console.error('Claim failed:', err);
    } finally {
      setIsClaiming(false);
      setTransactionPending(false);
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="text-xl">🥇</span>;
      case 2:
        return <span className="text-xl">🥈</span>;
      case 3:
        return <span className="text-xl">🥉</span>;
      default:
        return <span className="font-mono text-slate-500 font-bold">#{rank}</span>;
    }
  };

  const shortAddress = (addr: string) => {
    if (addr.length <= 13) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatVolume = (vol: number | string) => {
    const n = Number(vol);
    if (n === 0) return '$0';
    // volumes stored as raw token amounts (18 decimals) — convert
    if (n > 1e15) {
      return formatCurrency(n / 1e18);
    }
    return formatCurrency(n);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Global Leaderboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">Traders ranked by prediction accuracy and total on-chain contract volume.</p>
        </div>
        
        {/* Weekly incentive claim panel */}
        {claimResult === 'idle' ? (
          <Button 
            size="sm" 
            onClick={handleClaimReward}
            isLoading={isClaiming}
            disabled={!address}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] text-slate-950 font-bold"
          >
            <Sparkles className="h-4.5 w-4.5 mr-1.5 animate-pulse" />
            {pendingReward > 0 ? `Claim ${formatCurrency(pendingReward)} Reward` : 'Claim Reward'}
          </Button>
        ) : claimResult === 'success' ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="h-4.5 w-4.5" />
            Reward Claimed Successfully
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-semibold">
            No claimable reward available
          </div>
        )}
      </div>

      {/* Intro info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border border-white/5 bg-slate-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-lg">
              <Trophy className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Top Trader Reward</span>
              <span className="text-sm font-bold text-white">5,000 SX / Epoch</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/5 bg-slate-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Accuracy Threshold</span>
              <span className="text-sm font-bold text-white">Min 65% for Incentives</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/5 bg-slate-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Attestation Sealed</span>
              <span className="text-sm font-bold text-white">100% Cryptographic Audit</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Table */}
      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle>Top 10 Global Traders</CardTitle>
          <CardDescription>Live ranking based on on-chain prediction data. Refreshed from backend API.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
              <span className="text-sm text-slate-400">Loading leaderboard...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-rose-400">
              Failed to load leaderboard: {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No rankings available yet. Place some predictions to get started!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Total Stakes</TableHead>
                  <TableHead>Correct</TableHead>
                  <TableHead>Trading Volume</TableHead>
                  <TableHead className="text-right">Reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.slice(0, 10).map((entry) => (
                  <TableRow key={entry.wallet}>
                    <TableCell className="text-center font-bold">{getRankBadge(entry.rank)}</TableCell>
                    <TableCell className="font-mono text-slate-300 text-xs">
                      {shortAddress(entry.wallet)}
                      {address && entry.wallet.toLowerCase() === address.toLowerCase() && (
                        <span className="ml-2 text-[10px] text-indigo-400 font-bold uppercase">(You)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-indigo-400 font-extrabold font-mono">{Number(entry.accuracy).toFixed(1)}%</span>
                      <div className="w-16 bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, Number(entry.accuracy))}%` }} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-slate-350 font-semibold">{entry.totalPredictions}</TableCell>
                    <TableCell className="font-mono text-emerald-400 font-semibold">{entry.correctPredictions}</TableCell>
                    <TableCell className="font-mono text-cyan-300 font-semibold">{formatVolume(entry.volume)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-400 font-bold">
                      {Number(entry.rewardAmount) > 0 ? formatCurrency(Number(entry.rewardAmount)) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
