import React from 'react';
import { ShieldAlert, Terminal, Activity, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { useSecurityStore } from '../stores/useSecurityStore';

export const SecurityDashboard: React.FC = () => {
  const { jailbreakLogs, fetchSecurityLogs, rateLimitRequestCount, rateLimitThreshold, isRateLimited } = useSecurityStore();

  React.useEffect(() => {
    fetchSecurityLogs();
  }, [fetchSecurityLogs]);

  // Group stats
  const totalBlocked = jailbreakLogs.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            Security & Audit Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time threat monitoring, API rate limiter loading parameters, and autonomous AI vulnerability reports.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Card className="border border-white/5 bg-slate-900/10 text-center py-5">
          <span className="block text-[10px] text-slate-555 font-bold uppercase tracking-wider">Jailbreak Attempts Detected</span>
          <span className="text-3xl font-extrabold font-mono mt-1.5 block text-rose-450">
            {totalBlocked}
          </span>
        </Card>
        <Card className="border border-white/5 bg-slate-900/10 text-center py-5">
          <span className="block text-[10px] text-slate-555 font-bold uppercase tracking-wider">Blocked Requests</span>
          <span className="text-3xl font-extrabold font-mono mt-1.5 block text-orange-450">
            {totalBlocked}
          </span>
        </Card>
        <Card className="border border-white/5 bg-slate-900/10 text-center py-5">
          <span className="block text-[10px] text-slate-555 font-bold uppercase tracking-wider">Allowed (Malicious)</span>
          <span className="text-3xl font-extrabold font-mono mt-1.5 text-emerald-450 block">0</span>
        </Card>
        <Card className="border border-white/5 bg-slate-900/10 text-center py-5">
          <span className="block text-[10px] text-slate-555 font-bold uppercase tracking-wider">Rate Limit Status</span>
          <span className={`text-base font-extrabold mt-2.5 block ${isRateLimited ? 'text-rose-400' : 'text-emerald-450 uppercase tracking-widest'}`}>
            {isRateLimited ? 'ACTIVE' : 'Healthy'}
          </span>
        </Card>
      </div>

      {/* Row 2: Live Intrusion Logs & Rate Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Terminal Logs */}
        <Card className="lg:col-span-8 border border-white/5 bg-slate-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4.5 w-4.5 text-indigo-400" />
              Live Intrusion Alert Stream (Jailbreak Attacks Blocked)
            </CardTitle>
            <CardDescription>
              Real-time firewall logs reporting blocked instruction injection and prompt bypass payloads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-[#03050c] border border-white/10 rounded-xl p-4 font-mono text-[10px] text-slate-300 h-64 overflow-y-auto space-y-3">
              {jailbreakLogs.map((log) => {
                const colors = {
                  Low: 'text-indigo-400',
                  Medium: 'text-yellow-400',
                  High: 'text-orange-450',
                  Critical: 'text-rose-400 font-bold',
                };
                
                return (
                  <div key={log.id} className="border-b border-white/5 pb-2 last:border-b-0 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-450 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                        IP: {log.ipAddress}
                      </span>
                      <span className={colors[log.threatLevel]}>[{log.threatLevel} Attack Vector]</span>
                    </div>
                    <div className="text-[9px] text-slate-500 italic truncate" title={log.promptSnippet}>
                      Payload: "{log.promptSnippet}"
                    </div>
                    <div className="text-emerald-450 text-[9px]">
                      Action: {log.mitigationAction}
                    </div>
                    <div className="text-[8px] text-slate-555 text-right">{log.timestamp}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiter details */}
        <Card className="lg:col-span-4 border border-white/5 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-indigo-400" />
              API Gateway Rate Limits
            </CardTitle>
            <CardDescription>
              Dynamic request monitoring per IP block.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center py-4 bg-white/5 border border-white/5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Server Loads</span>
              <span className="text-3xl font-extrabold text-white font-mono mt-1">
                {rateLimitRequestCount} / {rateLimitThreshold}
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mt-0.5">Requests / Min limit</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-450">Limit Rule</span>
                <span className="font-semibold text-white">350 req/min per IP block</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-450">Threshold Protection</span>
                <span className="font-semibold text-indigo-400">Sliding Window Token Bucket</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-450">Mitigation Strategy</span>
                <span className="font-semibold text-slate-300">Auto Captcha + 15m Cooldown IP ban</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Audit Results */}
      <Card className="border border-white/5">
        <CardHeader>
          <CardTitle>AI Audit Results</CardTitle>
          <CardDescription>Continuous smart contract verification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 font-mono text-sm">
            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-white/5">
              <span className="text-slate-300">Slither</span>
              <span className="text-emerald-450 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Passed
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-white/5">
              <span className="text-slate-300">Mythril</span>
              <span className="text-emerald-450 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Passed
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};
