import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, 
  Coins, 
  Award, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Cpu, 
  Wallet,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { useAccount } from '../hooks/useWeb3';
import { useMarketStore } from '../stores/useMarketStore';
import { formatCurrency } from '../utils/helpers';
import { formatToken } from '../services/web3';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, registeredUsername, subAccounts } = useAccount();
  const { committedBalance, uncommittedBalance, yieldEarned, stakes, chainSubAccounts } = useMarketStore();

  const activeStakes = stakes.filter(s => s.status === 'active' || s.status === 'listed');
  const resolvedStakes = stakes.filter(s => s.status === 'resolved');

  // Chart data showing mock yield accumulation over the past week
  const yieldHistory = [
    { day: 'Mon', yield: 12.10, balance: 3500 },
    { day: 'Tue', yield: 15.45, balance: 3500 },
    { day: 'Wed', yield: 18.90, balance: 4100 },
    { day: 'Thu', yield: 22.80, balance: 4100 },
    { day: 'Fri', yield: 25.12, balance: 3900 },
    { day: 'Sat', yield: 28.75, balance: 3900 },
    { day: 'Sun', yield: yieldEarned, balance: uncommittedBalance }
  ];

  const stats = [
    {
      title: 'Unified Balance',
      value: formatCurrency(uncommittedBalance + committedBalance),
      desc: 'Committed + Uncommitted Vaults',
      icon: Wallet,
      color: 'text-indigo-400',
      glow: 'glow-indigo'
    },
    {
      title: 'Uncommitted Funds',
      value: formatCurrency(uncommittedBalance),
      desc: 'Available for withdrawals',
      icon: Coins,
      color: 'text-emerald-400',
      glow: 'glow-emerald'
    },
    {
      title: 'Committed Enclave Funds',
      value: formatCurrency(committedBalance),
      desc: 'Locked in yielding sub-wallets',
      icon: TrendingUp,
      color: 'text-cyan-400',
      glow: 'glow-cyan'
    },
    {
      title: 'Yield Earned',
      value: `+${yieldEarned.toFixed(4)} USDC`,
      desc: 'Accrued on committed accounts',
      icon: Cpu,
      color: 'text-purple-400',
      glow: 'glow-rose'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner Welcome */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-white/5 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Welcome back, {registeredUsername}!</h1>
          <p className="text-xs text-slate-400 mt-1">Manage prediction portfolios, vaults, secondary marketplace options, and attestation logs.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate('/deposit')}>
            <ArrowUpRight className="h-4 w-4 mr-1.5" />
            Deposit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/withdraw')}>
            <ArrowDownLeft className="h-4 w-4 mr-1.5" />
            Withdraw
          </Button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className={`border border-white/5 relative overflow-hidden ${stat.glow}`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/2 rounded-full -mr-8 -mt-8 pointer-events-none" />
              <CardContent className="p-5 flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{stat.title}</span>
                  <span className="text-xl md:text-2xl font-extrabold text-white font-mono block leading-none">{stat.value}</span>
                  <span className="text-[10px] text-slate-400 block">{stat.desc}</span>
                </div>
                <div className={`p-2.5 rounded-lg bg-white/5 border border-white/5 ${stat.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts & Mini Table Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Yield Curve Area Chart */}
        <Card className="lg:col-span-8 border border-white/5">
          <CardHeader>
            <CardTitle>Vault Yield Performance</CardTitle>
            <CardDescription>Simulated weekly yield accumulation on Uncommitted Deposits (USDC/USDT)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yieldHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1222', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="yield" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorYield)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Stats/Rank widget */}
        <Card className="lg:col-span-4 border border-white/5 flex flex-col justify-between">
          <CardHeader>
            <CardTitle>User Enclave Rank</CardTitle>
            <CardDescription>Performance tracking in current epoch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-4 bg-white/5 border border-white/5 rounded-xl">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Rank</span>
              <span className="text-4xl font-extrabold text-indigo-400 font-mono my-1 block">#14</span>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                <Award className="h-3.5 w-3.5" />
                Top 2% Accuracy
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Active Predictions</span>
                <span className="font-semibold text-white">{activeStakes.length}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-400">Resolved Contracts</span>
                <span className="font-semibold text-white">{resolvedStakes.length}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-400">Yield Earnings APY</span>
                <span className="font-semibold text-indigo-400">8.00%</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-400">Attestation Key Cert</span>
                <span className="text-indigo-300 hover:underline cursor-pointer flex items-center gap-1 font-mono" onClick={() => navigate('/verification')}>
                  SGX-2026
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Accounts Grid */}
      <Card className="border border-white/5">
        <CardHeader>
          <CardTitle>Hardware Sealed Sub-Accounts</CardTitle>
          <CardDescription>Sub-wallets isolated cryptographically inside enclave cells for risk management</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sub Account ID</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Maturity Date</TableHead>
                <TableHead>Yield</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isConnected ? (
                chainSubAccounts.length ? chainSubAccounts.map((sub) => (
                  <TableRow key={sub.id.toString()}>
                    <TableCell className="font-semibold text-white">Sub Account #{sub.id.toString()}</TableCell>
                    <TableCell className="font-mono text-indigo-300 font-semibold">{Number(formatToken(sub.principal)).toFixed(2)} USDC</TableCell>
                    <TableCell className="font-mono text-slate-400 text-xs">{new Date(Number(sub.createdAt) * 1000).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-cyan-300 font-semibold">{new Date(Number(sub.maturityDate) * 1000).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        sub.withdrawn
                          ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {Number(formatToken(sub.liveYield)).toFixed(4)} USDC
                      </span>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-4 font-medium">
                      No active sub-accounts found. Deposit committed funds to generate one.
                    </TableCell>
                  </TableRow>
                )
              ) : subAccounts.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-semibold text-white">{sub.name}</TableCell>
                  <TableCell className="font-mono text-slate-400 text-xs">{sub.address}</TableCell>
                  <TableCell className="font-mono text-indigo-300 font-semibold">{formatCurrency(sub.balance)}</TableCell>
                  <TableCell className="font-mono text-cyan-300 font-semibold">{formatCurrency(sub.allocatedToMarkets)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Isolated
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
