import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, RefreshCw, CheckCircle2, Coins, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { TransactionAmountSchema } from '../utils/validation';
import type { TransactionAmountInput } from '../utils/validation';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { contracts, web3Service } from '../services/web3';
import { formatCurrency } from '../utils/helpers';
import type { Address } from 'viem';

export const Deposit: React.FC = () => {
  const navigate = useNavigate();
  const { depositStablecoins, setTransactionPending, syncBalances } = useMarketStore();
  const { address } = useAccount();
  const [assetType, setAssetType] = useState('USDC');

  const [txState, setTxState] = useState<'idle' | 'minting' | 'approving' | 'approved' | 'depositing' | 'success'>('idle');
  const [txHash, setTxHash] = useState('');
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [committedPercentage, setCommittedPercentage] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<TransactionAmountInput>({
    resolver: zodResolver(TransactionAmountSchema),
    defaultValues: { amount: 1000 }
  });

  const amountWatch = watch('amount');

  // Load USDC balance on mount / address change
  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const bal = await web3Service.getTokenBalance(address as Address);
      setUsdcBalance(bal);
    } catch {
      setUsdcBalance(0);
    }
  }, [address]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const handleError = (err: unknown, fallback = 'Transaction failed') => {
    const msg = err instanceof Error ? err.message : String(err);
    // Extract the human-readable revert reason if present
    const revertMatch = msg.match(/reason:\s*(.+?)(?:\n|$)/i) ||
                        msg.match(/reverted with reason string '(.+?)'/i) ||
                        msg.match(/ContractFunctionRevertedError[^:]*: (.+)/i);
    setError(revertMatch ? revertMatch[1] : (msg.slice(0, 120) || fallback));
    setTxState('idle');
  };

  /** Mint test USDC to wallet (MockERC20 — testnet only) */
  const mintUsdc = async () => {
    if (!address) return;
    setError(null);
    setTxState('minting');
    setTransactionPending(true);
    try {
      await web3Service.mintTestTokens(10_000, address as Address);
      await refreshBalance();
      await syncBalances(address);
      setTxState('idle');
    } catch (err) {
      handleError(err, 'Minting failed');
    } finally {
      setTransactionPending(false);
    }
  };

  /** Approve USDC spending allowance for SXUA contract */
  const approve = async () => {
    if (!address || !contracts.sxua) return;
    setError(null);
    setTxState('approving');
    setTransactionPending(true);
    try {
      await web3Service.approveToken(contracts.sxua, amountWatch);
      setApprovedAmount(amountWatch);
      setTxState('approved');
    } catch (err) {
      handleError(err, 'Approval failed — check MetaMask and retry');
    } finally {
      setTransactionPending(false);
    }
  };

  const onSubmit = async (data: TransactionAmountInput) => {
    if (!address || !contracts.sxua) return;
    setError(null);
    setTransactionPending(true);

    try {
      // Auto-approve if needed
      if (approvedAmount < data.amount) {
        setTxState('approving');
        await web3Service.approveToken(contracts.sxua, data.amount);
        setApprovedAmount(data.amount);
        setTxState('approved');
      }

      setTxState('depositing');
      const receipt = await web3Service.depositFunds(data.amount, address, committedPercentage);
      await web3Service.getSxuaDashboard(address as Address).catch(() => undefined);
      depositStablecoins(data.amount);
      await refreshBalance();
      await syncBalances(address);
      setTxHash(receipt.transactionHash);
      setTxState('success');
    } catch (err) {
      handleError(err, 'Deposit failed');
    } finally {
      setTransactionPending(false);
    }
  };

  const isInProgress = txState === 'approving' || txState === 'depositing' || txState === 'minting';
  const hasSufficientBalance = usdcBalance !== null && usdcBalance >= (amountWatch || 0);

  return (
    <div className="max-w-md mx-auto py-6 animate-in fade-in duration-200">
      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-indigo-400" />
            Deposit Stablecoins
          </CardTitle>
          <CardDescription>Mint SX Vault shares to earn automated 8% yield on uncommitted capital</CardDescription>
        </CardHeader>
        <CardContent>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 bg-red-950/60 border border-red-500/30 rounded-xl text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {(txState === 'idle' || txState === 'approved') && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* USDC Balance + Mint */}
              <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="text-xs text-slate-400">
                  Wallet USDC Balance:&nbsp;
                  <span className={`font-bold ${hasSufficientBalance ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {usdcBalance !== null ? formatCurrency(usdcBalance) : '…'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={mintUsdc}
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-2 py-1 rounded-lg transition-colors"
                >
                  <Coins className="h-3 w-3" />
                  Mint 10k USDC
                </button>
              </div>

              {!hasSufficientBalance && usdcBalance !== null && (
                <p className="text-[11px] text-amber-400 -mt-1 px-1">
                  ⚠ Insufficient balance — click "Mint 10k USDC" above to get testnet tokens first.
                </p>
              )}

              <Select
                label="Stablecoin Asset"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
              >
                <option value="USDC">USDC (USD Coin - Native)</option>
                <option value="USDT">USDT (Tether USD)</option>
                <option value="SXUSD">SXUSD (SX Stablecoin)</option>
              </Select>

              <Input
                label="Deposit Amount (USD)"
                type="number"
                placeholder="1000"
                error={errors.amount?.message}
                {...register('amount', { valueAsNumber: true })}
              />

              <Input
                label="Committed Percentage"
                type="number"
                min={0}
                max={100}
                value={committedPercentage}
                onChange={(event) => setCommittedPercentage(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
              />

              {/* Split details */}
              {amountWatch > 0 && !isNaN(amountWatch) && (
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vault Allocation:</span>
                    <span className="font-bold text-white">{100 - committedPercentage}% Uncommitted / {committedPercentage}% Committed</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Yield Commencement:</span>
                    <span className="font-bold text-emerald-400">Immediate (8.0% APY)</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2 mt-1">
                    <span className="text-slate-400">Net Deposit Value:</span>
                    <span className="font-extrabold text-white font-mono">{formatCurrency(amountWatch)}</span>
                  </div>
                </div>
              )}

              <Button
                type="button"
                className="w-full mt-2"
                variant="secondary"
                onClick={approve}
                disabled={!hasSufficientBalance}
              >
                {txState === 'approved' ? '✓ Approved' : `Approve ${assetType}`}
              </Button>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={approvedAmount < amountWatch || !hasSufficientBalance}
              >
                Deposit {assetType}
              </Button>
            </form>
          )}

          {isInProgress && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
              <div className="text-center">
                <span className="block text-xs font-bold text-slate-200">
                  {txState === 'minting'   && 'Minting test USDC...'}
                  {txState === 'approving' && 'Approving token allowance...'}
                  {txState === 'depositing' && 'Submitting deposit transaction...'}
                </span>
                <span className="block text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
                  Confirm wallet prompt
                </span>
              </div>
            </div>
          )}

          {txState === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div>
                <span className="block text-base font-bold text-slate-200">Deposit Completed!</span>
                <span className="block text-xs text-slate-450 mt-1">Funds are now isolated in your secure enclave vault and accruing yield.</span>
              </div>
              <div className="w-full bg-slate-900/40 p-3 rounded-lg border border-white/5 text-[10px] font-mono text-slate-400 select-all leading-relaxed">
                <div className="font-bold text-indigo-400 border-b border-white/5 pb-1 mb-1">Receipt Attestation</div>
                <div className="truncate">Tx: {txHash}</div>
                <div>Status: Sealed & Confirmed</div>
              </div>
              <Button onClick={() => navigate('/dashboard')} className="w-full mt-2">
                Back to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
