import React, { useEffect, useState } from 'react';
import { Layers, RefreshCw, CheckCircle2, ShoppingCart, Ban } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { formatCurrency, shortenAddress } from '../utils/helpers';
import { fromTokenAmount, web3Service } from '../services/web3';
import type { MarketplaceListing } from '../types';

export const MarketplaceListings: React.FC = () => {
  const { listings, buyListing, cancelListing, uncommittedBalance, setTransactionPending, syncBalances } = useMarketStore();
  const { address } = useAccount();

  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'history'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chainListings, setChainListings] = useState<MarketplaceListing[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    web3Service.getActiveListings()
      .then(async (items) => {
        const mapped = await Promise.all(items.map(async (item) => ({
          id: item.id.toString(),
          stakeId: item.positionId.toString(),
          marketId: item.market,
          marketQuestion: item.question,
          outcome: item.outcome,
          originalAmount: await fromTokenAmount(item.originalAmount),
          originalOdds: Number(item.originalOdds) / 1e18,
          sellerAddress: item.seller,
          askingPrice: await fromTokenAmount(item.price),
          status: 'active',
          createdAt: '',
        } satisfies MarketplaceListing)));
        if (!cancelled) setChainListings(mapped);
      })
      .catch(() => {
        web3Service.getBackendListings()
          .then((items) => {
            if (!Array.isArray(items)) return;
            const mapped = items.map((item: any) => ({
              id: String(item.listingId ?? item.id),
              stakeId: String(item.stake?.positionId ?? item.stakeId ?? ''),
              marketId: String(item.stake?.market?.contractAddress ?? item.marketId ?? ''),
              marketQuestion: String(item.stake?.market?.question ?? item.marketQuestion ?? 'Backend listing'),
              outcome: item.stake?.outcome ? 'YES' : 'NO',
              originalAmount: Number(item.stake?.amount ?? 0),
              originalOdds: Number(item.stake?.oddsAtEntry ?? 0),
              sellerAddress: String(item.seller?.walletAddress ?? item.sellerAddress ?? ''),
              askingPrice: Number(item.price ?? 0),
              status: 'active',
              createdAt: String(item.createdAt ?? ''),
            } satisfies MarketplaceListing));
            if (!cancelled) setChainListings(mapped);
          })
          .catch(() => {
            if (!cancelled) setChainListings(null);
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter listings based on active tab
  const getFilteredListings = () => {
    const source = chainListings ?? listings;
    switch (activeTab) {
      case 'my':
        return source.filter(l => l.sellerAddress === 'user_wallet_address_0x' || l.sellerAddress.toLowerCase() === address?.toLowerCase());
      case 'history':
        return source.filter(l => l.status === 'sold' || l.status === 'cancelled');
      case 'all':
      default:
        return source.filter(l => l.status === 'active');
    }
  };

  const handleBuy = async (listingId: string, price: number) => {
    if (!address) return;
    if (!chainListings && uncommittedBalance < price) {
      alert('Insufficient uncommitted funds to complete purchase.');
      return;
    }

    setProcessingId(listingId);
    setTransactionPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (chainListings) {
        const walletBalance = await web3Service.getTokenBalance(address);
        if (walletBalance < price) {
          setErrorMessage('Insufficient wallet balance. You need USDC in your wallet to complete this purchase.');
          setProcessingId(null);
          setTransactionPending(false);
          return;
        }
      }

      await web3Service.buyPosition(listingId, price, address);

      const res = chainListings ? { success: true } : buyListing(listingId, address);
      
      if (res.success) {
        setSuccessMessage('Contract ownership transfer complete! Checked & sealed inside enclave.');
        setChainListings((items) => items?.filter((item) => item.id !== listingId) ?? null);
      }
      await syncBalances(address);
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || err?.shortMessage || 'Transaction failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setProcessingId(null);
      setTransactionPending(false);
    }
  };

  const handleCancel = async (listingId: string) => {
    if (!address) return;
    setProcessingId(listingId);
    setTransactionPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (!chainListings) {
        await new Promise((res) => setTimeout(res, 800));
        cancelListing(listingId);
      } else {
        await web3Service.cancelListing(BigInt(listingId));
        setChainListings((items) => items?.filter((item) => item.id !== listingId) ?? null);
      }
      setSuccessMessage('Order canceled. Position restored to active portfolio.');
      await syncBalances(address);
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || err?.shortMessage || 'Transaction failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setProcessingId(null);
      setTransactionPending(false);
    }
  };
    
  const filteredListings = getFilteredListings();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Layers className="h-6 w-6 text-indigo-400" />
          Secondary Contract Marketplace
        </h1>
        <p className="text-xs text-slate-400 mt-1">Buy and sell prediction shares peer-to-peer at discounts or premiums before event resolution.</p>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex gap-3 items-center justify-between animate-in slide-in-from-top-2 duration-300">
          <div className="flex gap-3 items-center">
            <CheckCircle2 className="h-5.5 w-5.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-slate-200">{successMessage}</span>
          </div>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSuccessMessage(null)}>Dismiss</Button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-950/20 border border-red-800/40 rounded-xl flex gap-3 items-center justify-between animate-in slide-in-from-top-2 duration-300">
          <div className="flex gap-3 items-center">
            <Ban className="h-5.5 w-5.5 text-red-400 shrink-0" />
            <span className="text-xs font-bold text-slate-200">{errorMessage}</span>
          </div>
          <Button size="sm" variant="ghost" className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50" onClick={() => setErrorMessage(null)}>Dismiss</Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'all' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/35' : 'text-slate-400 hover:text-white'
          }`}
        >
          All Listings
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'my' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/35' : 'text-slate-400 hover:text-white'
          }`}
        >
          My Listings
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'history' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/35' : 'text-slate-400 hover:text-white'
          }`}
        >
          Trade History
        </button>
      </div>

      {/* Grid listing */}
      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle>
            {activeTab === 'all' ? 'Active Listings' : activeTab === 'my' ? 'My Placed Orders' : 'Archived Orders'}
          </CardTitle>
          <CardDescription>
            P2P trade settlement executes atomically in the ledger isolated memory vaults
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredListings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market Contract</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Original Value</TableHead>
                  <TableHead>Seller Address</TableHead>
                  <TableHead>Asking Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((list) => {
                  const isProcessing = processingId === list.id;
                  const isMyListing = list.sellerAddress === 'user_wallet_address_0x' || list.sellerAddress === address;
                  
                  return (
                    <TableRow key={list.id}>
                      <TableCell className="font-semibold text-white max-w-xs truncate">
                        {list.marketQuestion}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          list.outcome === 'YES' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-350'
                        }`}>
                          {list.outcome}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-400">{formatCurrency(list.originalAmount)}</TableCell>
                      <TableCell className="font-mono text-slate-500 text-xs">{shortenAddress(list.sellerAddress)}</TableCell>
                      <TableCell className="font-mono text-indigo-300 font-extrabold">{formatCurrency(list.askingPrice)}</TableCell>
                      <TableCell className="text-right">
                        {isProcessing ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Relaying...
                          </span>
                        ) : list.status === 'active' ? (
                          isMyListing ? (
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => handleCancel(list.id)}
                              className="px-2.5 py-1 text-[10px] uppercase font-bold"
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => handleBuy(list.id, list.askingPrice)}
                              className="px-2.5 py-1 text-[10px] uppercase font-bold"
                            >
                              <ShoppingCart className="h-3 w-3 mr-1" />
                              Buy Position
                            </Button>
                          )
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            list.status === 'sold' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {list.status}
                          </span>
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
              <span className="block text-xs font-bold text-slate-300">No listings found</span>
              <span className="text-[10px] text-slate-500 mt-1">There are no peer-to-peer contract listings fitting your current selection.</span>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
