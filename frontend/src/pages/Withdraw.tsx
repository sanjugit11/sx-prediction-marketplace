import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownLeft, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { TransactionAmountSchema } from '../utils/validation';
import type { TransactionAmountInput } from '../utils/validation';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { fromTokenAmount, web3Service, type SxuaSubAccount } from '../services/web3';
import { formatCurrency } from '../utils/helpers';

export const Withdraw: React.FC = () => {
  const navigate = useNavigate();
  const { uncommittedBalance, committedBalance, withdrawFunds, setTransactionPending, syncBalances } = useMarketStore();
  const { address } = useAccount();

  const [txState, setTxState] = useState<'idle' | 'checking' | 'withdrawing' | 'success'>('idle');
  const [txHash, setTxHash] = useState('');
  const [penaltyReport, setPenaltyReport] = useState({ requiresPenalty: false, penaltyAmount: 0 });
  const [withdrawMode, setWithdrawMode] = useState<'uncommitted' | 'committed'>('uncommitted');
  const [chainBalances, setChainBalances] = useState<{ uncommitted: number; committed: number; subAccounts: SxuaSubAccount[] } | null>(null);
  const [selectedSubAccountId, setSelectedSubAccountId] = useState('');

  const { register, handleSubmit, formState: { errors }, watch } = useForm<TransactionAmountInput>({
    resolver: zodResolver(TransactionAmountSchema),
    defaultValues: { amount: 500 }
  });

  const amountWatch = watch('amount');
  const availableUncommitted = chainBalances?.uncommitted ?? uncommittedBalance;
  const availableCommitted = chainBalances?.committed ?? committedBalance;
  const activeSubAccounts = chainBalances?.subAccounts.filter((sub) => !sub.withdrawn) ?? [];
  const selectedSubAccount = activeSubAccounts.find((sub) => sub.id.toString() === selectedSubAccountId);
  const daysToMaturity = selectedSubAccount
    ? Math.ceil((Number(selectedSubAccount.maturityDate) * 1000 - Date.now()) / 86_400_000)
    : 0;
  const isEarlyCommittedWithdrawal = Boolean(selectedSubAccount && daysToMaturity > 0);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    web3Service.getSxuaDashboard(address as `0x${string}`)
      .then(async (data) => {
        const next = {
          uncommitted: await fromTokenAmount(data.uncommitted),
          committed: await fromTokenAmount(data.committed),
          subAccounts: data.subAccounts,
        };
        if (!cancelled) {
          setChainBalances(next);
          const firstActive = next.subAccounts.find((sub) => !sub.withdrawn);
          if (firstActive) setSelectedSubAccountId(firstActive.id.toString());
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Determine if withdraw requires pulling from committed balances (stakes)
  const isOverdrawingUncommitted = amountWatch > availableUncommitted;
  const isExceedingTotal = amountWatch > (availableUncommitted + availableCommitted);

  const onSubmit = async (data: TransactionAmountInput) => {
    if (!address) return;
    if (withdrawMode === 'uncommitted' && data.amount > availableUncommitted) return;
    if (withdrawMode === 'committed' && !selectedSubAccount) return;

    setTransactionPending(true);
    try {
      setTxState('checking');
      await new Promise((res) => setTimeout(res, 1000));

      setTxState('withdrawing');
      const receipt = withdrawMode === 'committed'
        ? await web3Service.withdrawCommitted(selectedSubAccount!.id)
        : await web3Service.withdrawFunds(data.amount, address);
      
      const res = withdrawMode === 'uncommitted' && !chainBalances
        ? withdrawFunds(data.amount)
        : {
            requiresPenalty: withdrawMode === 'committed' && isEarlyCommittedWithdrawal,
            penaltyAmount: withdrawMode === 'committed' && selectedSubAccount ? await fromTokenAmount((selectedSubAccount.principal * 6n) / 100n) : 0,
          };
      setPenaltyReport({
        requiresPenalty: res.requiresPenalty,
        penaltyAmount: res.penaltyAmount
      });
      
      await syncBalances(address);
      setTxHash(receipt.transactionHash);
      setTxState('success');
    } catch (err) {
      console.error(err);
      setTxState('idle');
    } finally {
      setTransactionPending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 animate-in fade-in duration-200">
      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-indigo-400" />
            Withdraw Funds
          </CardTitle>
          <CardDescription>Redeem vault shares to withdraw stablecoins to your external wallet</CardDescription>
        </CardHeader>
        <CardContent>
          {txState === 'idle' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Select
                label="Withdrawal Source"
                value={withdrawMode}
                onChange={(event) => setWithdrawMode(event.target.value as 'uncommitted' | 'committed')}
              >
                <option value="uncommitted">Uncommitted Balance</option>
                <option value="committed">Committed Sub Account</option>
              </Select>
              
              <div className="p-3 bg-[#0d1222]/80 border border-white/5 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Available (Uncommitted):</span>
                  <span className="font-semibold text-indigo-400">{formatCurrency(availableUncommitted)}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                  <span className="text-slate-400">Committed Sub Accounts:</span>
                  <span className="font-semibold text-cyan-400">{formatCurrency(availableCommitted)}</span>
                </div>
              </div>

              {withdrawMode === 'uncommitted' ? (
                <Input
                  label="Withdraw Amount (USD)"
                  type="number"
                  placeholder="500"
                  error={errors.amount?.message || (amountWatch > availableUncommitted ? 'Amount exceeds uncommitted balance' : undefined)}
                  {...register('amount', { valueAsNumber: true })}
                />
              ) : (
                <Select
                  label="Sub Account"
                  value={selectedSubAccountId}
                  onChange={(event) => setSelectedSubAccountId(event.target.value)}
                >
                  {activeSubAccounts.map((sub) => (
                    <option key={sub.id.toString()} value={sub.id.toString()}>
                      #{sub.id.toString()} Principal {Number(sub.principal / 10n ** 18n).toLocaleString()} USDC
                    </option>
                  ))}
                </Select>
              )}

              {/* Warning box if pulling from committed balance */}
              {withdrawMode === 'uncommitted' && isOverdrawingUncommitted && !isExceedingTotal && (
                <div className="p-3.5 bg-rose-950/20 border border-rose-800/40 rounded-xl flex gap-3 items-start animate-in slide-in-from-top-2 duration-200">
                  <AlertTriangle className="h-5 w-5 text-rose-450 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-rose-250 leading-relaxed">
                    <strong className="block text-xs text-rose-300 font-bold mb-0.5">Early Withdrawal Warning</strong>
                    Your withdrawal request exceeds your uncommitted balance. The on-chain flow only permits committed withdrawals by sub-account, so choose a committed sub-account below instead. Early withdrawals apply a 6% fee.
                  </div>
                </div>
              )}

              {withdrawMode === 'committed' && selectedSubAccount && (
                <div className={`p-3.5 rounded-xl flex gap-3 items-start animate-in slide-in-from-top-2 duration-200 ${
                  isEarlyCommittedWithdrawal ? 'bg-rose-950/20 border border-rose-800/40' : 'bg-emerald-950/20 border border-emerald-800/40'
                }`}>
                  <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${isEarlyCommittedWithdrawal ? 'text-rose-450' : 'text-emerald-400'}`} />
                  <div className={`text-[10px] leading-relaxed ${isEarlyCommittedWithdrawal ? 'text-rose-250' : 'text-emerald-300'}`}>
                    <strong className="block text-xs font-bold mb-0.5">
                      {isEarlyCommittedWithdrawal ? 'Early Committed Withdrawal Warning' : 'Committed Account Mature'}
                    </strong>
                    {isEarlyCommittedWithdrawal
                      ? `This account matures in ${daysToMaturity} day(s). Withdrawing before 100 days forfeits yield and applies the contract withdrawal fee.`
                      : 'This committed account has reached maturity and can withdraw principal plus accrued yield.'}
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full mt-2" 
                variant={withdrawMode === 'committed' && isEarlyCommittedWithdrawal ? 'destructive' : 'primary'}
                disabled={withdrawMode === 'uncommitted'
                  ? amountWatch <= 0 || isNaN(amountWatch) || amountWatch > availableUncommitted
                  : !selectedSubAccount}
              >
                Withdraw USDC
              </Button>
            </form>
          )}

          {(txState === 'checking' || txState === 'withdrawing') && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
              <div className="text-center">
                <span className="block text-xs font-bold text-slate-200">
                  {txState === 'checking' ? 'Verifying vault lock states...' : 'Unlocking enclave liquidity...'}
                </span>
                <span className="block text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
                  Processing transaction
                </span>
              </div>
            </div>
          )}

          {txState === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div>
                <span className="block text-base font-bold text-slate-200">Withdrawal Executed</span>
                <span className="block text-xs text-slate-450 mt-1">Funds have been routed back to your connected web3 address.</span>
              </div>

              {penaltyReport.requiresPenalty && (
                <div className="w-full p-3 bg-rose-950/20 border border-rose-900/30 rounded-lg text-[10px] text-rose-300 flex justify-between">
                  <span>Liquidated early stake penalty:</span>
                  <span className="font-bold font-mono">-{formatCurrency(penaltyReport.penaltyAmount)}</span>
                </div>
              )}

              <div className="w-full bg-slate-900/40 p-3 rounded-lg border border-white/5 text-[10px] font-mono text-slate-400 select-all leading-relaxed">
                <div className="font-bold text-indigo-400 border-b border-white/5 pb-1 mb-1">Receipt Attestation</div>
                <div className="truncate">Tx: {txHash}</div>
                <div>Status: Confirmed</div>
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
