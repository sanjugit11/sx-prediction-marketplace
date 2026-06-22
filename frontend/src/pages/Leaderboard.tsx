import React, { useState } from 'react';
import { Zap, ShieldCheck, Trophy, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { useMarketStore } from '../stores/useMarketStore';
import { formatCurrency } from '../utils/helpers';

export const Leaderboard: React.FC = () => {
  const { leaderboard } = useMarketStore();
  const [weeklyRewardClaimed, setWeeklyRewardClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaimReward = async () => {
    setIsClaiming(true);
    await new Promise((res) => setTimeout(res, 1200));
    setWeeklyRewardClaimed(true);
    setIsClaiming(false);
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
        {!weeklyRewardClaimed ? (
          <Button 
            size="sm" 
            onClick={handleClaimReward}
            isLoading={isClaiming}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] text-slate-950 font-bold"
          >
            <Sparkles className="h-4.5 w-4.5 mr-1.5 animate-pulse" />
            Claim Weekly Incentive
          </Button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="h-4.5 w-4.5" />
            Weekly Incentive Claimed (+50 SX)
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
          <CardDescription>Epoch 4 ranking parameters. Refreshed hourly.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead>Secure Address</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Total Stakes</TableHead>
                <TableHead>Trading Volume</TableHead>
                <TableHead className="text-right">Rewards Claimed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry) => (
                <TableRow key={entry.rank}>
                  <TableCell className="text-center font-bold">{getRankBadge(entry.rank)}</TableCell>
                  <TableCell className="font-semibold text-slate-200">{entry.username}</TableCell>
                  <TableCell className="font-mono text-slate-500 text-xs">{entry.address}</TableCell>
                  <TableCell>
                    <span className="text-indigo-400 font-extrabold font-mono">{entry.accuracy}%</span>
                    <div className="w-16 bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${entry.accuracy}%` }} />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-slate-350 font-semibold">{entry.totalPredictions}</TableCell>
                  <TableCell className="font-mono text-cyan-300 font-semibold">{formatCurrency(entry.volume)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-400 font-bold">
                    {entry.rewardsClaimed.toLocaleString()} SX
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
};
