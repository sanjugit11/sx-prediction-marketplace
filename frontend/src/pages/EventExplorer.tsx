import React, { useEffect, useState } from 'react';
import { Search, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { shortenAddress } from '../utils/helpers';
import { web3Service } from '../services/web3';

type ExplorerEvent = {
  id: string;
  block: number;
  time: string;
  name: string;
  contract: string;
  tx: string;
  details: string;
};

export const EventExplorer: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventType, setEventType] = useState('All');
  const [backendEvents, setBackendEvents] = useState<ExplorerEvent[] | null>(null);

  const mockEvents: ExplorerEvent[] = [
    { id: 'ev-1', block: 18495120, time: '2026-06-21 13:08:22', name: 'StakedPrediction', contract: 'SXPredictionCore', tx: '0xd4a5f8cc092b77c18ee56a12ee4950005b3f2e1a78d2c4e0a59dfbfbfbfbfbfb', details: 'Staked 100 USDC on YES for Market m-1' },
    { id: 'ev-2', block: 18495115, time: '2026-06-21 12:59:15', name: 'DepositStablecoins', contract: 'SXSecureVault', tx: '0xec29c0ff42a3a41a6688e1a1e9e8f4a9b5a5bb14992a77ec88ec11cf221bcc3f', details: 'Deposited 5,000 USDC; minted 5,000 vault shares' },
    { id: 'ev-3', block: 18495094, time: '2026-06-21 12:44:10', name: 'RegisterAttestation', contract: 'SXEnclaveRegistry', tx: '0x5b3f2e1a22bd01a221bcc3faa11bb8999e8cc029d4a3e8c15bb99acc029dd106', details: 'Registered Enclave attestation for user' },
    { id: 'ev-4', block: 18495055, time: '2026-06-20 18:30:15', name: 'ListPosition', contract: 'SXSecondaryMarket', tx: '0x992a88ec11cf221bcc3fa11bb8999e8cc029d4a3e8c15bb99acc029dd106eeaa9', details: 'Listed stake s-mock-other-1 for asking price 850 USDC' },
    { id: 'ev-5', block: 18495012, time: '2026-06-20 14:15:22', name: 'ResolveMarket', contract: 'SXPredictionCore', tx: '0x3a4fdd105c4fe32171a2bb89ee92b5a5bc3e12df00a123eff4a988ccdd1066fa', details: 'Resolved Market m-4 to outcome: YES' },
    { id: 'ev-6', block: 18494982, time: '2026-06-20 10:11:45', name: 'WithdrawFunds', contract: 'SXSecureVault', tx: '0x88ec11cf221bcc3fa11bb8999e8cc029d4a3e8c15bb99acc029dd106eeaa98c9d4', details: 'Withdrew 1,200 USDC from vault. Paid early fee: 0 USDC' },
    { id: 'ev-7', block: 18494890, time: '2026-06-19 15:42:01', name: 'CreateMarket', contract: 'SXPredictionCore', tx: '0x5c4afe2932c1e0eff4a988ccdd1066faee92b5a5bc3e12df00a123eff4a988ccdd', details: 'Created Market m-5 initial liquidity 500 USDC' }
  ];
  useEffect(() => {
    web3Service.getEvents()
      .then((events) => {
        const rows = Array.isArray(events) ? events : events?.events;
        if (!Array.isArray(rows)) return;
        setBackendEvents(rows.map((event, index) => ({
          id: String(event.id ?? index),
          block: Number(event.blockNumber ?? event.block ?? 0),
          time: String(event.timestamp ?? event.time ?? ''),
          name: String(event.eventName ?? event.name ?? ''),
          contract: String(event.contractName ?? event.contract ?? ''),
          tx: String(event.txHash ?? event.tx ?? ''),
          details: String(event.details ?? ''),
        })));
      })
      .catch(() => setBackendEvents(null));
  }, []);

  const filteredEvents = (backendEvents ?? mockEvents).filter(e => {
    const matchesSearch = e.details.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.tx.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = eventType === 'All' || e.name === eventType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Activity className="h-6 w-6 text-indigo-400" />
          Blockchain Event Explorer
        </h1>
        <p className="text-xs text-slate-400 mt-1">Live query terminal of transaction logs, smart contract invocations, and enclave attestations.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Search */}
        <div className="md:col-span-8 relative">
          <input
            type="text"
            placeholder="Search by transaction hash or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d1222] border border-white/10 rounded-lg pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-505 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
        </div>

        {/* Event Type Filter */}
        <div className="md:col-span-4">
          <Select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="py-2.5"
          >
            <option value="All">All Events</option>
            <option value="RegisterAttestation">RegisterAttestation</option>
            <option value="DepositStablecoins">DepositStablecoins</option>
            <option value="WithdrawFunds">WithdrawFunds</option>
            <option value="CreateMarket">CreateMarket</option>
            <option value="StakedPrediction">StakedPrediction</option>
            <option value="ResolveMarket">ResolveMarket</option>
            <option value="ListPosition">ListPosition</option>
          </Select>
        </div>

      </div>

      {/* Events Table */}
      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle>Event Log Stream</CardTitle>
          <CardDescription>Attested smart contract transaction receipts logged on-chain</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Transaction Hash</TableHead>
                <TableHead>Details / Arguments</TableHead>
                <TableHead className="text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs text-indigo-400 font-semibold">{e.block}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-200">
                      {e.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-350 text-xs font-semibold">{e.contract}</TableCell>
                  <TableCell className="font-mono text-slate-500 text-xs hover:text-indigo-400 cursor-pointer transition-colors" title={e.tx}>
                    {shortenAddress(e.tx)}
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs max-w-xs truncate">{e.details}</TableCell>
                  <TableCell className="text-right text-xs text-slate-500">{e.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Mock */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Page 1 of 1</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 py-0 px-2 disabled:opacity-40" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="h-8 py-0 px-2 disabled:opacity-40" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};
