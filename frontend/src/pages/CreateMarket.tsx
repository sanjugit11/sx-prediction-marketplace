import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { MarketCreationSchema } from '../utils/validation';
import type { MarketCreationInput } from '../utils/validation';
import { useMarketStore } from '../stores/useMarketStore';
import { useAccount } from '../hooks/useWeb3';
import { formatCurrency } from '../utils/helpers';
import { web3Service } from '../services/web3';

export const CreateMarket: React.FC = () => {
  const navigate = useNavigate();
  const { createMarket, uncommittedBalance } = useMarketStore();
  const { address } = useAccount();

  const [txState, setTxState] = useState<'idle' | 'deploying' | 'success'>('idle');
  const [createdId, setCreatedId] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<MarketCreationInput>({
    resolver: zodResolver(MarketCreationSchema),
    defaultValues: {
      question: '',
      description: '',
      category: 'Crypto',
      resolutionDate: '',
      totalLiquidity: 500,
      oracleAddress: '0x0000000000000000000000000000000000000000'
    }
  });

  const onSubmit = async (data: MarketCreationInput) => {
    if (!address) return;
    if (data.totalLiquidity > uncommittedBalance) return;

    setTxState('deploying');
    
    const endTime = Math.floor(new Date(data.resolutionDate).getTime() / 1000);
    await web3Service.createMarket(data.question, endTime, data.totalLiquidity);
    const refreshedMarkets = await web3Service.getMarkets().catch(() => []);
    const createdMarket = refreshedMarkets.find((market) => market.question === data.question);

    const result = createMarket({
      question: data.question,
      description: data.description,
      category: data.category,
      totalLiquidity: data.totalLiquidity,
      creator: address,
      resolutionDate: data.resolutionDate,
      oracleAddress: data.oracleAddress
    });

    if (result.success) {
      setCreatedId(createdMarket?.address ?? result.marketId);
      setTxState('success');
    } else {
      setTxState('idle');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6 animate-in fade-in duration-200">
      
      <button 
        onClick={() => navigate('/markets')} 
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Markets
      </button>

      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-400" />
            Create Prediction Market
          </CardTitle>
          <CardDescription>Deploy an isolated attestation contract for a real-world event</CardDescription>
        </CardHeader>
        <CardContent>
          {txState === 'idle' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              <Input
                label="Prediction Question"
                placeholder="e.g. Will Ethereum average gas fees fall below 5 Gwei in Q4 2026?"
                error={errors.question?.message}
                {...register('question')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Category"
                  error={errors.category?.message}
                  {...register('category')}
                >
                  <option value="Crypto">Crypto</option>
                  <option value="Politics">Politics</option>
                  <option value="Tech">Tech</option>
                  <option value="Sports">Sports</option>
                  <option value="Science">Science</option>
                </Select>

                <Input
                  label="Resolution Date"
                  type="date"
                  error={errors.resolutionDate?.message}
                  {...register('resolutionDate')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Initial Liquidity Pool (USD)"
                  type="number"
                  placeholder="500"
                  error={errors.totalLiquidity?.message}
                  {...register('totalLiquidity', { valueAsNumber: true })}
                />

                <Input
                  label="Oracle Provider Contract Address"
                  placeholder="0x..."
                  error={errors.oracleAddress?.message}
                  {...register('oracleAddress')}
                />
              </div>

              <Input
                label="Detailed Resolution Criteria"
                placeholder="Describe exactly what triggers a YES outcome vs a NO outcome..."
                error={errors.description?.message}
                {...register('description')}
              />

              {/* Balance Check Info */}
              <div className="p-3 bg-slate-900/50 border border-white/5 rounded-lg text-xs flex justify-between">
                <span className="text-slate-400">Available Uncommitted Balance:</span>
                <span className="font-semibold text-indigo-400">{formatCurrency(uncommittedBalance)}</span>
              </div>

              <Button type="submit" className="w-full mt-2">
                Deploy prediction contract
              </Button>
            </form>
          )}

          {txState === 'deploying' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
              <div className="text-center">
                <span className="block text-xs font-bold text-slate-200">Deploying Market Contract...</span>
                <span className="block text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
                  Compiling bytecode & Attesting Oracle hashes
                </span>
              </div>
            </div>
          )}

          {txState === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div>
                <span className="block text-base font-bold text-slate-200">Prediction Contract Active!</span>
                <span className="block text-xs text-slate-450 mt-1">Initial liquidity pool is locked, and YES/NO prediction shares are open for public stakes.</span>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <Button variant="secondary" onClick={() => navigate('/markets')} className="flex-1">
                  Back to Markets
                </Button>
                <Button onClick={() => navigate(`/markets/${createdId}`)} className="flex-1">
                  View Market
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
};
