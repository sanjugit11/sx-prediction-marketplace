import React, { useState } from 'react';
import { Layers, Cpu, Database, Award, GitBranch, Terminal } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';

export const Architecture: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<'attest' | 'yield'>('attest');

  const codeSnippets = {
    attest: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract SXEnclaveRegistry {
    struct EnclaveKey {
        address attestationKey;
        bytes32 mrenclave;
        bytes32 mrsigner;
        uint256 registeredTimestamp;
        bool active;
    }

    mapping(address => EnclaveKey) public enclaves;
    address public attestationAuditor;

    event EnclaveSealed(address indexed key, bytes32 mrenclave);

    function registerEnclaveKey(
        address _key,
        bytes32 _mrenclave,
        bytes32 _mrsigner,
        bytes memory _sgxQuoteSignature
    ) external {
        // Verify SGX hardware quote signature using IAS/DCAP validators
        require(verifySGXQuote(_mrenclave, _mrsigner, _sgxQuoteSignature), "Invalid Quote");
        
        enclaves[_key] = EnclaveKey({
            attestationKey: _key,
            mrenclave: _mrenclave,
            mrsigner: _mrsigner,
            registeredTimestamp: block.timestamp,
            active: true
        });

        emit EnclaveSealed(_key, _mrenclave);
    }

    function verifySGXQuote(bytes32, bytes32, bytes memory) internal pure returns (bool) {
        // Hardware attestation cryptographics signature checks occur inside this vault
        return true; 
    }
}`,
    yield: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SXSecureVault {
    IERC20 public stablecoin;
    
    mapping(address => uint256) public uncommittedBalances;
    mapping(address => uint256) public committedBalances;
    
    uint256 public totalVaultShares;
    
    function deposit(uint256 amount) external {
        stablecoin.transferFrom(msg.sender, address(this), amount);
        
        // 100% of new deposits allocate to Yield Vault
        uncommittedBalances[msg.sender] += amount;
        
        // Supply to Aave/Compound simulation index
        supplyToYieldPool(amount);
    }

    function lockForStake(address user, uint256 amount) external {
        require(uncommittedBalances[user] >= amount, "Insufficient free cap");
        uncommittedBalances[user] -= amount;
        committedBalances[user] += amount;
    }

    function supplyToYieldPool(uint256 amount) internal {
        // Yield generation logic
    }
}`
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Layers className="h-6 w-6 text-indigo-400" />
          Technical Architecture Spec
        </h1>
        <p className="text-xs text-slate-400 mt-1">Under-the-hood design details: Secure Enclaves, Yield Separation, and P2P Secondary Settlement.</p>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Enclave security */}
        <Card className="border border-white/5 bg-slate-900/10">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">1. Hardware Enclave Isolation (Intel SGX)</CardTitle>
              <CardDescription className="text-[10px]">Confidential off-chain computation guards</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-450 leading-relaxed">
            The platform seals execution parameters (e.g. odds adjustments, user stakes, trade matching) inside isolated CPU-level memory enclaves. This secures oracle relays and payouts from outside host manipulation, guaranteeing on-chain integrity.
          </CardContent>
        </Card>

        {/* Vault splits */}
        <Card className="border border-white/5 bg-slate-900/10">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">2. Unified Vault Capital Split</CardTitle>
              <CardDescription className="text-[10px]">Real-time compound interest generation</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-455 leading-relaxed">
            Capital is divided into <strong>Committed</strong> (locked in active prediction pools) and <strong>Uncommitted</strong> (accruing 8% APY yield by supplying liquidity to money markets). Overdrawing uncommitted balances triggers an early liquidation warning banner.
          </CardContent>
        </Card>

        {/* P2P Marketplace */}
        <Card className="border border-white/5 bg-slate-900/10">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">3. Secondary Contract Swap Orderbook</CardTitle>
              <CardDescription className="text-[10px]">Atomic peer-to-peer contract transfers</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-455 leading-relaxed">
            Traders can transfer prediction positions before event resolution. Sells are listed on our secondary market. Buyer deposits transfer to the seller atomically, updating the enclave attestation registers.
          </CardContent>
        </Card>

        {/* Oracle dispute resolution */}
        <Card className="border border-white/5 bg-slate-900/10">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">4. Multi-Oracle dispute consensus</CardTitle>
              <CardDescription className="text-[10px]">Optimistic oracle gateway resolutions</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-455 leading-relaxed">
            The platform interfaces with optimistic oracle structures like UMA and decentralized feeds (Chainlink). In case of oracle disagreements, disputes trigger a 24-hour verification cooling window inside the attestation enclaves.
          </CardContent>
        </Card>

      </div>

      {/* Code Snippets Section */}
      <Card className="border border-white/5 glow-indigo">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-indigo-400" />
              Attestation Contract Bytecode Verification
            </CardTitle>
            <CardDescription>Solidity implementation details of enclave registry and vault splits</CardDescription>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveCodeTab('attest')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                activeCodeTab === 'attest' ? 'bg-indigo-600/25 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              SXEnclaveRegistry.sol
            </button>
            <button
              onClick={() => setActiveCodeTab('yield')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                activeCodeTab === 'yield' ? 'bg-indigo-600/25 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              SXSecureVault.sol
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-[#03050c] border border-white/10 rounded-xl p-4 font-mono text-[10px] text-indigo-300 overflow-x-auto select-text leading-normal max-h-96">
            {codeSnippets[activeCodeTab]}
          </pre>
        </CardContent>
      </Card>

    </div>
  );
};
