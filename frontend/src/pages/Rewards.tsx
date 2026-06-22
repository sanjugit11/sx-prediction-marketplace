import React, { useEffect, useState } from 'react';
import { Gift, Zap, CheckCircle2, DollarSign, Award, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { useAccount } from '../hooks/useWeb3';
import { fromTokenAmount, web3Service } from '../services/web3';

export const Rewards: React.FC = () => {
  const [unclaimedSX, setUnclaimedSX] = useState(380);
  const [claimedSX, setClaimedSX] = useState(1240);
  const { address } = useAccount();
  
  const [isClaiming, setIsClaiming] = useState(false);
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);

  const mockRewardLogs = [
    { id: 'rew-1', type: 'Staking Boost', date: '2026-06-20', amount: 120, status: 'Claimed' },
    { id: 'rew-2', type: 'Prediction Vol Incentive', date: '2026-06-18', amount: 250, status: 'Claimed' },
    { id: 'rew-3', type: 'Referral Commission', date: '2026-06-14', amount: 80, status: 'Claimed' },
    { id: 'rew-4', type: 'Beta Enclave Attester Reward', date: '2026-06-08', amount: 790, status: 'Claimed' }
  ];

  useEffect(() => {
    if (!address) return;
    web3Service.pendingReward(address as `0x${string}`)
      .then(async (amount) => setUnclaimedSX(await fromTokenAmount(amount)))
      .catch(() => undefined);
  }, [address]);

  const handleClaim = async () => {
    if (unclaimedSX <= 0) return;
    setIsClaiming(true);
    
    await web3Service.claimReward();
    
    setClaimedSX(prev => prev + unclaimedSX);
    setUnclaimedSX(0);
    setIsClaiming(false);
    setShowClaimSuccess(true);
  };

  const statCards = [
    { title: 'Prediction Incentives', value: '250 SX', desc: 'Based on weekly trade volume', icon: Zap, color: 'text-indigo-400' },
    { title: 'Referral Rewards', value: '80 SX', desc: 'Active connections volume share', icon: Users, color: 'text-cyan-400' },
    { title: 'Staking Yield Match', value: '50 SX', desc: 'Staked funds yield matching', icon: DollarSign, color: 'text-emerald-400' },
    { title: 'Total Claimed Rewards', value: `${claimedSX.toLocaleString()} SX`, desc: 'Successfully withdrawn to wallet', icon: Award, color: 'text-purple-400' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Gift className="h-6 w-6 text-indigo-400" />
          Reward Hub
        </h1>
        <p className="text-xs text-slate-400 mt-1">Staking boosts, referral percentages, and weekly epoch prediction volume bonuses.</p>
      </div>

      {/* Claim Success Banner */}
      {showClaimSuccess && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex gap-3 items-center justify-between animate-in slide-in-from-top-2 duration-300">
          <div className="flex gap-3 items-center">
            <CheckCircle2 className="h-5.5 w-5.5 text-emerald-400 shrink-0" />
            <div>
              <span className="block text-xs font-bold text-slate-200">Tokens Claimed!</span>
              <span className="block text-[10px] text-slate-450 mt-0.5">Rewards have been compiled and sent to your wallet key address.</span>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowClaimSuccess(false)}>Dismiss</Button>
        </div>
      )}

      {/* Hero Claim Widget */}
      <Card className="border border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 glow-indigo">
        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1.5 text-center md:text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Claimable Balance</span>
            <span className="text-3xl md:text-4xl font-extrabold text-white font-mono block leading-none">
              {unclaimedSX} SX
            </span>
            <span className="text-[10px] text-indigo-400 font-semibold block">Epoch 4 ending in 2 days</span>
          </div>
          
          <Button 
            size="lg" 
            onClick={handleClaim} 
            disabled={unclaimedSX <= 0}
            isLoading={isClaiming}
            className="w-full md:w-auto px-10 py-4 font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            Claim SX Rewards
          </Button>
        </CardContent>
      </Card>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="border border-white/5 bg-slate-900/10">
              <CardContent className="p-5 flex justify-between items-start">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-550 font-bold uppercase tracking-widest block">{stat.title}</span>
                  <span className="text-lg font-extrabold text-white font-mono block">{stat.value}</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">{stat.desc}</span>
                </div>
                <div className={`p-2 bg-white/5 border border-white/5 rounded-lg ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rewards History Table */}
      <Card className="border border-white/5">
        <CardHeader>
          <CardTitle>Rewards Claim History</CardTitle>
          <CardDescription>Attested rewards transactions settled inside enclave contracts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference ID</TableHead>
                <TableHead>Allocation Type</TableHead>
                <TableHead>Claim Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Settlement State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRewardLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs text-indigo-400 font-semibold">{log.id}</TableCell>
                  <TableCell className="font-semibold text-white">{log.type}</TableCell>
                  <TableCell className="text-slate-450">{log.date}</TableCell>
                  <TableCell className="font-mono font-bold text-slate-200">+{log.amount} SX</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                      {log.status}
                    </span>
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
