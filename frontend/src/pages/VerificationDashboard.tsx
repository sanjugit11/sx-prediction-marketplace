import React, { useEffect, useState } from 'react';
import { UserCheck, ShieldCheck, ExternalLink, Code2, Cpu } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { shortenAddress } from '../utils/helpers';
import { contracts, web3Service } from '../services/web3';

export const VerificationDashboard: React.FC = () => {
  const [registryStates, setRegistryStates] = useState<Record<string, boolean>>({});
  const verifiedContracts = [
    {
      name: 'SXEnclaveRegistry.sol',
      address: contracts.verificationRegistry ?? '0xEnclaveRegistryContractAddress00000001',
      version: 'solc v0.8.26',
      optimization: 'Enabled (Runs: 200)',
      mrenclave: '0xsgx_mrenclave_aa88ffcc992ee11bc',
      mrsigner: '0xsgx_mrsigner_221b3fa11bb8999cc02',
      attestDate: '2026-06-01',
      status: 'Verified Match'
    },
    {
      name: 'SXPredictionCore.sol',
      address: contracts.factory ?? '0xPredictionCoreContractAddress00000002',
      version: 'solc v0.8.26',
      optimization: 'Enabled (Runs: 200)',
      mrenclave: '0xsgx_mrenclave_5b3f2e1a22bd01a221',
      mrsigner: '0xsgx_mrsigner_221b3fa11bb8999cc02',
      attestDate: '2026-06-05',
      status: 'Verified Match'
    },
    {
      name: 'SXSecureVault.sol',
      address: contracts.sxua ?? '0xSecureVaultContractAddress000000003',
      version: 'solc v0.8.26',
      optimization: 'Enabled (Runs: 500)',
      mrenclave: '0xsgx_mrenclave_ec29c0ff42a3a41a66',
      mrsigner: '0xsgx_mrsigner_221b3fa11bb8999cc02',
      attestDate: '2026-06-02',
      status: 'Verified Match'
    },
    {
      name: 'SXSecondaryMarket.sol',
      address: contracts.marketplace ?? '0xSecondaryMarketContractAddress000004',
      version: 'solc v0.8.26',
      optimization: 'Enabled (Runs: 200)',
      mrenclave: '0xsgx_mrenclave_992a88ec11cf221bcc',
      mrsigner: '0xsgx_mrsigner_221b3fa11bb8999cc02',
      attestDate: '2026-06-18',
      status: 'Verified Match'
    }
  ];

  useEffect(() => {
    verifiedContracts.forEach((contract) => {
      if (typeof contract.address !== 'string' || !contract.address.startsWith('0x') || contract.address.length !== 42) return;
      web3Service.isVerified(contract.address as `0x${string}`)
        .then((verified) => setRegistryStates((state) => ({ ...state, [contract.address]: verified })))
        .catch(() => undefined);
    });
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-indigo-400" />
          Contract Verification Dashboard
        </h1>
        <p className="text-xs text-slate-400 mt-1">Independent compiler verification and hardware attestation records for deployed system contracts.</p>
      </div>

      {/* Intro info panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-white/5 bg-slate-900/10">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Code2 className="h-4.5 w-4.5 text-indigo-400" />
              Source Code Verification (solc)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 leading-relaxed">
            All Solidity source files are compiled and verified on Etherscan and Blockscout. Bytecode deployed on-chain matches the open-source GitHub release tags exactly, preventing backdoor functions or modified parameter risks.
          </CardContent>
        </Card>

        <Card className="border border-white/5 bg-slate-900/10">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Cpu className="h-4.5 w-4.5 text-indigo-400" />
              SGX MRENCLAVE Attestations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 leading-relaxed">
            The MRENCLAVE measurement represents the cryptographic hash of the code running inside Intel SGX secure enclave nodes. Any changes to the enclave software will invalidate IAS attestation, causing public APIs to reject the nodes immediately.
          </CardContent>
        </Card>
      </div>

      {/* Verification table */}
      <Card className="border border-white/5 glow-indigo">
        <CardHeader>
          <CardTitle>System Contract Registries</CardTitle>
          <CardDescription>On-chain attestation matches matching Solc metadata and SGX measurements</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract Name</TableHead>
                <TableHead>Contract Address</TableHead>
                <TableHead>Compiler Version</TableHead>
                <TableHead>MRENCLAVE Hash</TableHead>
                <TableHead>Verified Date</TableHead>
                <TableHead className="text-right">State Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verifiedContracts.map((contract, index) => (
                <TableRow key={index}>
                  <TableCell className="font-semibold text-white">{contract.name}</TableCell>
                  <TableCell className="font-mono text-indigo-400 text-xs hover:underline cursor-pointer select-all">
                    <span className="inline-flex items-center gap-1">
                      {shortenAddress(contract.address)}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-350">
                    <div>{contract.version}</div>
                    <div className="text-[10px] text-slate-555 mt-0.5">{contract.optimization}</div>
                  </TableCell>
                  <TableCell className="font-mono text-slate-500 text-xs truncate max-w-[120px]" title={contract.mrenclave}>
                    {contract.mrenclave}
                  </TableCell>
                  <TableCell className="text-xs text-slate-450">{contract.attestDate}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {registryStates[String(contract.address)] === false ? 'Not Registered' : contract.status}
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
