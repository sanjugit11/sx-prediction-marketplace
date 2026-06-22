import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { formatCurrency, shortenAddress } from '../utils/helpers';
import { web3Service } from '../services/web3';
import type { Market } from '../types';

export const AdminResolution: React.FC = () => {
  const { markets, resolveMarket, setTransactionPending, syncBalances } = useMarketStore();
  const { address } = useAccount();
  const [chainMarkets, setChainMarkets] = useState<Market[] | null>(null);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvingOutcome, setResolvingOutcome] = useState<'YES' | 'NO' | 'CANCEL' | null>(null);

  useEffect(() => {
    let cancelled = false;
    web3Service.getMarkets()
      .then(async (items) => {
        const now = Math.floor(Date.now() / 1000);
        const mapped = items
          .filter((m) => Number(m.endTime) < now && !m.resolved)
          .map((m) => ({
            id: m.address,
            question: m.question,
            description: 'Ready for admin resolution',
            category: 'Crypto' as const,
            yesOdds: 50,
            noOdds: 50,
            totalLiquidity: Number(m.totalPool) / 1e18,
            creator: m.address,
            resolutionDate: new Date(Number(m.endTime) * 1000).toISOString().slice(0, 10),
            isResolved: m.resolved,
            outcome: m.winner,
            oracleAddress: m.address,
            isVerified: true,
            verificationHash: m.address,
            createdAt: '',
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

  const unresolvedMarkets = chainMarkets ?? markets.filter(m => !m.isResolved);

  const handleResolve = async (marketId: string, outcome: 'YES' | 'NO' | 'CANCEL') => {
    if (!address) return;
    setResolvingId(marketId);
    setResolvingOutcome(outcome);
    setTransactionPending(true);

    try {
      // Simulate Admin signature relay and enclave computation
      await web3Service.resolveMarket(marketId, outcome, address);

      resolveMarket(marketId, outcome);
      setChainMarkets((items) => items?.filter((m) => m.id !== marketId) ?? null);
      await syncBalances(address);
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingId(null);
      setResolvingOutcome(null);
      setTransactionPending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-400" />
          Admin Resolution Terminal
        </h1>
        <p className="text-xs text-slate-400 mt-1">Oracle consensus manager. Initiate enclave attestation hashes to finalize outcome states.</p>
      </div>

      {/* Warning Box */}
      <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl flex gap-3.5 items-start">
        <AlertTriangle className="h-5.5 w-5.5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-250 leading-relaxed">
          <strong className="block text-amber-300 font-bold mb-0.5">Consensus Authorization Protocol</strong>
          Market resolutions require cryptographic signatures from 2-of-3 registered oracle keys. Executing a resolution below will simulate enclave compilation and sign the attestation packet with your local sandbox key.
        </div>
      </div>

      {/* Markets Table */}
      <Card className="border border-white/5">
        <CardHeader>
          <CardTitle>Unresolved Active Prediction Markets</CardTitle>
          <CardDescription>Select an outcome state to trigger smart contract claims and vault distributions</CardDescription>
        </CardHeader>
        <CardContent>
          {unresolvedMarkets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market ID</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Total Liquidity</TableHead>
                  <TableHead>Oracle contract</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unresolvedMarkets.map((m) => {
                  const isResolving = resolvingId === m.id;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs text-indigo-400 font-semibold">{m.id}</TableCell>
                      <TableCell className="font-semibold text-white max-w-xs truncate">{m.question}</TableCell>
                      <TableCell className="font-mono text-slate-300">{formatCurrency(m.totalLiquidity)}</TableCell>
                      <TableCell className="font-mono text-slate-500 text-xs">{shortenAddress(m.oracleAddress)}</TableCell>
                      <TableCell className="text-right">
                        {isResolving ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Signing {resolvingOutcome}...
                          </span>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            <Button 
                              size="sm" 
                              variant="success" 
                              onClick={() => handleResolve(m.id, 'YES')}
                              className="px-2.5 py-1 text-[10px] uppercase font-bold"
                            >
                              Resolve YES
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => handleResolve(m.id, 'NO')}
                              className="px-2.5 py-1 text-[10px] uppercase font-bold"
                            >
                              Resolve NO
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 border border-dashed border-white/5 rounded-xl">
              <Layers className="h-8 w-8 text-slate-500 mx-auto mb-3" />
              <span className="block text-xs font-bold text-slate-300">All markets settled</span>
              <span className="text-[10px] text-slate-500 mt-1">There are currently no active prediction markets requiring manual admin oracle resolution.</span>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
