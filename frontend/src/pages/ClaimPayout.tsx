import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, RefreshCw, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { formatCurrency } from '../utils/helpers';
import { fromTokenAmount, web3Service } from '../services/web3';
import type { Stake } from '../types';

export const ClaimPayout: React.FC = () => {
  const { stakes, markets, claimPayout } = useMarketStore();
  const { address } = useAccount();
  
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [lastClaimReceipt, setLastClaimReceipt] = useState<{ amount: number; txHash: string } | null>(null);
  const [chainPositions, setChainPositions] = useState<Stake[] | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    web3Service.getUserPredictionPositions(address as `0x${string}`)
      .then(async (positions) => {
        const claimables = positions.filter((pos) => pos.resolved && !pos.claimed && pos.winner === pos.outcome);
        const mapped = await Promise.all(claimables.map(async (pos) => ({
          id: pos.id.toString(),
          marketId: pos.marketAddress,
          marketQuestion: pos.marketQuestion,
          outcome: pos.outcome,
          amount: await fromTokenAmount(pos.amount),
          entryOdds: Number(pos.oddsAtEntry) / 1e18,
          committedAmount: await fromTokenAmount(pos.amount),
          uncommittedAmount: 0,
          yieldEarned: await fromTokenAmount(pos.potentialPayout),
          timestamp: new Date(Number(pos.createdAt) * 1000).toISOString().replace('T', ' ').substring(0, 19),
          txHash: '',
          status: 'resolved',
        } satisfies Stake)));
        if (!cancelled) setChainPositions(mapped);
      })
      .catch(() => {
        if (!cancelled) setChainPositions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // We filter resolved stakes where the user stood to win
  const claimablePositions = chainPositions ?? stakes.filter(s => {
    if (s.status !== 'resolved') return false;
    if (s.amount <= 0) return false; // Already claimed

    const market = markets.find(m => m.id === s.marketId);
    if (!market || !market.isResolved || !market.outcome) return false;

    // Won or Cancelled (refunding)
    return s.outcome === market.outcome || market.outcome === 'CANCEL';
  });

  const getPayoutAmount = (stake: typeof stakes[0]) => {
    const market = markets.find(m => m.id === stake.marketId);
    if (chainPositions) return stake.yieldEarned;
    if (!market) return 0;
    if (market.outcome === 'CANCEL') return stake.amount; // Refund
    
    // Payout = stake / (odds / 100)
    return stake.amount / (stake.entryOdds / 100);
  };

  const handleClaim = async (stakeId: string) => {
    if (!address) return;
    setClaimingId(stakeId);

    const stake = stakes.find(s => s.id === stakeId);
    const position = claimablePositions.find(s => s.id === stakeId);
    if (!position) {
      setClaimingId(null);
      return;
    }
    if (!stake && !chainPositions) {
      setClaimingId(null);
      return;
    }
    const payout = getPayoutAmount(position);

    const receipt = await web3Service.claimPayout(position.marketId, position.id);

    if (!chainPositions) {
      claimPayout(stakeId);
    } else {
      setChainPositions((items) => items?.filter((item) => item.id !== stakeId) ?? null);
    }
    
    setLastClaimReceipt({
      amount: payout,
      txHash: receipt.transactionHash
    });
    setClaimingId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Award className="h-6 w-6 text-indigo-400" />
          Claim Payouts
        </h1>
        <p className="text-xs text-slate-400 mt-1">Retrieve oracle-verified prediction payouts and lock refund collections.</p>
      </div>

      {/* Claim Notification success banner */}
      {lastClaimReceipt && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex gap-3 items-center justify-between animate-in slide-in-from-top-2 duration-350">
          <div className="flex gap-3 items-center">
            <CheckCircle2 className="h-5.5 w-5.5 text-emerald-400 shrink-0" />
            <div>
              <span className="block text-xs font-bold text-slate-200">Winnings Claimed Successfully!</span>
              <span className="block text-[10px] text-slate-450 mt-0.5">Accrued <strong>{formatCurrency(lastClaimReceipt.amount)}</strong> back to your Uncommitted Vault.</span>
            </div>
          </div>
          <span className="text-[10px] text-indigo-400 font-mono font-bold truncate max-w-xs hidden md:block">
            Tx: {lastClaimReceipt.txHash}
          </span>
        </div>
      )}

      {/* Table */}
      <Card className="border border-white/5">
        <CardHeader>
          <CardTitle>Claimable Prediction Earnings</CardTitle>
          <CardDescription>Winning shares verification contracts queued for distribution payouts</CardDescription>
        </CardHeader>
        <CardContent>
          {claimablePositions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market Detail</TableHead>
                  <TableHead>Staked Choice</TableHead>
                  <TableHead>Staked Amount</TableHead>
                  <TableHead>Payout Value</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimablePositions.map((pos) => {
                  const payout = getPayoutAmount(pos);
                  const isClaiming = claimingId === pos.id;
                  
                  return (
                    <TableRow key={pos.id}>
                      <TableCell className="font-semibold text-white">
                        {pos.marketQuestion}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.outcome === 'YES' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {pos.outcome}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-400">{formatCurrency(pos.amount)}</TableCell>
                      <TableCell className="font-mono text-emerald-400 font-bold">{formatCurrency(payout)}</TableCell>
                      <TableCell className="text-right">
                        {isClaiming ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Claiming...
                          </span>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="success" 
                            onClick={() => handleClaim(pos.id)}
                            className="px-3 py-1.5 text-[10px] uppercase font-bold"
                          >
                            Claim Payout
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16 border border-dashed border-white/5 rounded-xl">
              <Layers className="h-8 w-8 text-slate-500 mx-auto mb-3" />
              <span className="block text-xs font-bold text-slate-300">No claimable payouts found</span>
              <span className="text-[10px] text-slate-500 mt-1">Staked positions will show here once their parent prediction events are settled by oracles.</span>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
