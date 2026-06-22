import React, { useState } from 'react';
import { ShieldAlert, Terminal, RefreshCw, Activity, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { useSecurityStore } from '../stores/useSecurityStore';

export const SecurityDashboard: React.FC = () => {
  const { auditReports, jailbreakLogs, rateLimitRequestCount, rateLimitThreshold, isRateLimited, mitigateVulnerability } = useSecurityStore();
  const [mitigatingId, setMitigatingId] = useState<string | null>(null);

  // Group stats
  const criticalCount = auditReports.filter(r => r.riskLevel === 'Critical' && r.status === 'Open').length;
  const highCount = auditReports.filter(r => r.riskLevel === 'High' && r.status === 'Open').length;
  
  const totalFixed = auditReports.filter(r => r.status === 'Fixed').length;

  const handleMitigate = async (id: string) => {
    setMitigatingId(id);
    // Simulate compilation of patch and hot reload on enclave nodes
    await new Promise((res) => setTimeout(res, 1500));
    mitigateVulnerability(id);
    setMitigatingId(null);
  };

  const getRiskBadge = (level: 'Low' | 'Medium' | 'High' | 'Critical') => {
    const styles = {
      Low: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      High: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      Critical: 'bg-rose-500/10 text-rose-450 border-rose-500/20 animate-pulse',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${styles[level]}`}>
        {level}
      </span>
    );
  };

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
          <span className="block text-[10px] text-slate-550 font-bold uppercase tracking-wider">Critical Open</span>
          <span className={`text-3xl font-extrabold font-mono mt-1.5 block ${criticalCount > 0 ? 'text-rose-400' : 'text-slate-350'}`}>
            {criticalCount}
          </span>
        </Card>
        <Card className="border border-white/5 bg-slate-900/10 text-center py-5">
          <span className="block text-[10px] text-slate-555 font-bold uppercase tracking-wider">High Risks</span>
          <span className={`text-3xl font-extrabold font-mono mt-1.5 block ${highCount > 0 ? 'text-orange-450' : 'text-slate-350'}`}>
            {highCount}
          </span>
        </Card>
        <Card className="border border-white/5 bg-slate-900/10 text-center py-5">
          <span className="block text-[10px] text-slate-555 font-bold uppercase tracking-wider">Total Mitigated</span>
          <span className="text-3xl font-extrabold font-mono mt-1.5 text-emerald-450 block">{totalFixed}</span>
        </Card>
        <Card className="border border-white/5 bg-slate-900/10 text-center py-5">
          <span className="block text-[10px] text-slate-555 font-bold uppercase tracking-wider">Gateway Status</span>
          <span className={`text-base font-extrabold mt-2.5 block ${isRateLimited ? 'text-rose-400' : 'text-emerald-450 uppercase tracking-widest'}`}>
            {isRateLimited ? 'RATE LIMIT ACTIVE' : 'Operational'}
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

      {/* AI Vulnerabilities Report Table */}
      <Card className="border border-white/5">
        <CardHeader>
          <CardTitle>Autonomous AI Auditor - Code Vulnerability Reports</CardTitle>
          <CardDescription>Hot-patchable code issues catalogued across smart contract repositories</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk</TableHead>
                <TableHead>Issue Title</TableHead>
                <TableHead>Affected Component</TableHead>
                <TableHead>Remediation / Patched State</TableHead>
                <TableHead>Identified Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditReports.map((rep) => {
                const isPatching = mitigatingId === rep.id;
                
                return (
                  <TableRow key={rep.id}>
                    <TableCell>{getRiskBadge(rep.riskLevel)}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-200">{rep.title}</div>
                      <div className="text-[10px] text-slate-450 mt-0.5 line-clamp-1 max-w-xs">{rep.description}</div>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-350 text-xs">{rep.componentName}</TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {rep.status === 'Fixed' ? (
                        <span className="text-emerald-450 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Patched: {rep.remediation.substring(0, 45)}...
                        </span>
                      ) : (
                        <span className="text-slate-450 italic">Pending patch deployment</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 font-mono">{rep.date}</TableCell>
                    <TableCell className="text-right">
                      {rep.status === 'Open' ? (
                        isPatching ? (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-400 font-semibold">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Patching...
                          </span>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={() => handleMitigate(rep.id)}
                            className="px-2.5 py-1 text-[10px] uppercase font-bold"
                          >
                            Hot-Patch Enclave
                          </Button>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Mitigated
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
};
