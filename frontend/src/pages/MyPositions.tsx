import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Layers, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { formatCurrency } from '../utils/helpers';
import { ListingSchema } from '../utils/validation';
import type { ListingInput } from '../utils/validation';
import { web3Service } from '../services/web3';
import { fromTokenAmount } from '../services/web3';
import type { Stake } from '../types';

export const MyPositions: React.FC = () => {
  const { stakes, listPositionForSale, setTransactionPending, syncBalances } = useMarketStore();
  const { address } = useAccount();

  const [activeStakeIdForSale, setActiveStakeIdForSale] = useState<string | null>(null);
  const [isListing, setIsListing] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [chainPositions, setChainPositions] = useState<Stake[] | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (marketId: string, stakeId: string) => {
    if (!address) return;
    setClaimingId(stakeId);
    setTransactionPending(true);
    try {
      await web3Service.claimPayout(marketId, stakeId);
      if (chainPositions) {
        setChainPositions(prev => prev ? prev.map(item => item.id === stakeId ? { ...item, claimed: true } : item) : null);
      }
      await syncBalances(address);
    } catch (err) {
      console.error(err);
    } finally {
      setClaimingId(null);
      setTransactionPending(false);
    }
  };

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ListingInput>({
    resolver: zodResolver(ListingSchema),
    defaultValues: { askingPrice: 100 }
  });

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    web3Service.getUserPredictionPositions(address as `0x${string}`)
      .then(async (positions) => {
        const mapped = await Promise.all(positions.map(async (pos) => ({
          id: pos.id.toString(),
          marketId: pos.marketAddress,
          marketQuestion: pos.marketQuestion,
          outcome: pos.outcome,
          amount: await fromTokenAmount(pos.amount),
          entryOdds: Number(pos.oddsAtEntry) / 1e18,
          committedAmount: await fromTokenAmount(pos.amount),
          uncommittedAmount: 0,
          yieldEarned: 0,
          timestamp: new Date(Number(pos.createdAt) * 1000).toISOString().replace('T', ' ').substring(0, 19),
          txHash: '',
          status: pos.resolved ? 'resolved' : 'active',
          claimed: pos.claimed,
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

  const displayedStakes = chainPositions ?? stakes;
  const selectedStake = displayedStakes.find(s => s.id === activeStakeIdForSale);

  const onSubmit = async (data: ListingInput) => {
    if (!address || !activeStakeIdForSale) return;
    setIsListing(true);
    
    const stake = displayedStakes.find((item) => item.id === activeStakeIdForSale);
    if (!stake) {
      setIsListing(false);
      return;
    }
    setTransactionPending(true);
    try {
      await web3Service.listPositionForSale(stake.marketId, stake.id, data.askingPrice, address);

      if (!chainPositions) {
        listPositionForSale(activeStakeIdForSale, data.askingPrice);
      }
      
      setIsListing(false);
      setActiveStakeIdForSale(null);
      setShowSuccessDialog(true);
      reset();
      await syncBalances(address);
    } catch (err) {
      console.error(err);
      setIsListing(false);
    } finally {
      setTransactionPending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Coins className="h-6 w-6 text-indigo-400" />
          My Prediction Positions
        </h1>
        <p className="text-xs text-slate-400 mt-1">Manage active staked outcomes or list contract positions on the secondary marketplace.</p>
      </div>

      {/* Positions Table */}
      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle>Active Prediction Contracts</CardTitle>
          <CardDescription>Attested stakes locked in the enclave voting pools</CardDescription>
        </CardHeader>
        <CardContent>
          {displayedStakes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market Detail</TableHead>
                  <TableHead>Staked Choice</TableHead>
                  <TableHead>Principal Stake</TableHead>
                  <TableHead>Entry Odds</TableHead>
                  <TableHead>Vault Yield</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedStakes.map((pos) => {
                  const statusColors = {
                    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    listed: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                    resolved: 'bg-slate-800 text-slate-400 border-slate-700',
                  };

                  return (
                    <TableRow key={pos.id}>
                      <TableCell className="font-semibold text-white max-w-xs truncate">
                        {pos.marketQuestion}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.outcome === 'YES' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-350'
                        }`}>
                          {pos.outcome}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-200">{formatCurrency(pos.amount)}</TableCell>
                      <TableCell className="font-mono text-slate-400">{pos.entryOdds.toFixed(2)}x</TableCell>
                      <TableCell className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                        +{pos.yieldEarned.toFixed(2)} USDC
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[pos.status]}`}>
                          {pos.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {pos.status === 'active' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setActiveStakeIdForSale(pos.id)}
                            className="px-2.5 py-1.5 text-[10px] uppercase font-bold"
                          >
                            <Layers className="h-3 w-3 mr-1" />
                            List for Sale
                          </Button>
                        )}
                        {pos.status === 'listed' && (
                          <span className="text-xs text-slate-500 italic">Marketplace Active</span>
                        )}
                        {pos.status === 'resolved' && !pos.claimed && (
                          claimingId === pos.id ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              Claiming...
                            </span>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="success" 
                              onClick={() => handleClaim(pos.marketId, pos.id)}
                              className="px-2.5 py-1.5 text-[10px] uppercase font-bold"
                            >
                              Claim Payout
                            </Button>
                          )
                        )}
                        {pos.status === 'resolved' && pos.claimed && (
                          <span className="text-xs text-emerald-500 italic">Claimed</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16 border border-dashed border-white/5 rounded-xl">
              <Coins className="h-8 w-8 text-slate-500 mx-auto mb-3" />
              <span className="block text-xs font-bold text-slate-300">No prediction positions held</span>
              <span className="text-[10px] text-slate-500 mt-1">Staking contracts will show here once you enter active prediction pools.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG: SELL POSITION MODAL */}
      <Dialog isOpen={activeStakeIdForSale !== null} onClose={() => setActiveStakeIdForSale(null)}>
        <DialogHeader>
          <DialogTitle>List Contract for Sale</DialogTitle>
          <DialogDescription>
            Enter your asking price to list this prediction share on the secondary marketplace orderbook.
          </DialogDescription>
        </DialogHeader>

        {selectedStake && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="p-3 bg-slate-900/50 border border-white/5 rounded-lg text-xs space-y-1">
              <div className="truncate font-semibold text-white">{selectedStake.marketQuestion}</div>
              <div className="flex gap-4 pt-1.5 text-slate-400">
                <span>Outcome: <strong className="text-indigo-400 font-bold">{selectedStake.outcome}</strong></span>
                <span>Principal: <strong className="text-white font-mono">{formatCurrency(selectedStake.amount)}</strong></span>
                <span>Odds: <strong className="text-slate-200">{selectedStake.entryOdds.toFixed(2)}x</strong></span>
              </div>
            </div>

            <Input
              label="Asking Price (USD)"
              type="number"
              error={errors.askingPrice?.message}
              {...register('askingPrice', { valueAsNumber: true })}
            />

            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setActiveStakeIdForSale(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isListing}>
                Confirm Orderbook Listing
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>

      {/* DIALOG: SUCCESS BANNER */}
      <Dialog isOpen={showSuccessDialog} onClose={() => setShowSuccessDialog(false)}>
        <div className="flex flex-col items-center justify-center text-center p-4 gap-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <div>
            <DialogTitle>Position Listed!</DialogTitle>
            <DialogDescription className="mt-1">
              Your prediction contract is now live on the peer-to-peer secondary market orderbook. You will receive stablecoins once another trader buys your listing.
            </DialogDescription>
          </div>
          <Button onClick={() => setShowSuccessDialog(false)} className="w-full">
            Back to Positions
          </Button>
        </div>
      </Dialog>

    </div>
  );
};
