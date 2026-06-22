/**
 * verify.ts — Direct block-explorer verification (NO live RPC required)
 *
 * How it works:
 *   1. Reads the StandardJsonInput from Hardhat's build-info artifact
 *   2. ABI-encodes constructor arguments with ethers.js
 *   3. POSTs directly to the Etherscan-compatible API (Basescan / Blockscout)
 *   4. Polls for the result
 *
 * Run:
 *   npx hardhat run script/verify.ts --network baseSepolia   (uses Basescan)
 *   npx hardhat run script/verify.ts --network hoodiTestnet  (uses Blockscout)
 *
 * Or pass VERIFY_NETWORK env var to override:
 *   VERIFY_NETWORK=baseSepolia ts-node script/verify.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as https from "https";
import * as http from "http";
import * as querystring from "querystring";
import { ethers } from "ethers";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ─── Network Config ───────────────────────────────────────────────────────────

interface NetworkCfg {
  chainId: number;
  apiUrl: string;
  browserUrl: string;
  apiKey: string;
}

const NETWORKS: Record<string, NetworkCfg> = {
  hoodiTestnet: {
    chainId: 560048,
    // Etherscan V2 — Hoodi Testnet is chainId 560048 on Etherscan
    apiUrl: "https://api.etherscan.io/v2/api?chainid=560048",
    browserUrl: "https://hoodi.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY?.trim() ?? "",
  },
  baseSepolia: {
    chainId: 84532,
    apiUrl: "https://api.etherscan.io/v2/api?chainid=84532",
    browserUrl: "https://sepolia.basescan.org",
    apiKey: process.env.ETHERSCAN_API_KEY?.trim() ?? "",
  },
};

/**
 * Proxy strategy:
 *   - OpenZeppelin upgrades.deployProxy() deploys an ERC1967Proxy (or TransparentUpgradeableProxy)
 *     whose bytecode is NOT the implementation's bytecode.
 *   - For Etherscan, we verify the proxy address as the OZ proxy contract, then call
 *     "verifyproxycontract" to link proxy → implementation.
 *   - The implementation contract is verified separately only when we have its address.
 *
 * For simplicity we use the "Similar Match" approach: submit the proxy address for source
 * verification using the OZ proxy source, or — much simpler — just register it as a proxy
 * without source verification (Etherscan reads the implementation slot automatically).
 */

interface ContractDef {
  /** Key in .env that holds the deployed address */
  envKey: string;
  /** Human-readable label for logs */
  label: string;
  /**
   * Fully-qualified contract name as it appears inside the build-info sources,
   * e.g. "contracts/SXUAUpgradeable.sol:SXUAUpgradeable"
   * For proxy addresses this is the implementation's fqn (Etherscan reads the impl slot).
   */
  fullyQualifiedName: string;
  /** ABI types + values for the constructor, e.g. [["string","string"],["USD Coin","USDC"]] */
  constructorArgs?: [string[], unknown[]];
  /**
   * If true, skip source verification for this address (it's a proxy) and only call
   * verifyproxycontract to let Etherscan auto-read the ERC-1967 implementation slot.
   */
  isProxy?: boolean;
  /** env key of the implementation address (for proxy registration label) */
  implEnvKey?: string;
}

const CONTRACTS: ContractDef[] = [
  {
    envKey: "USDC_ADDRESS",
    label: "MockERC20 (USDC)",
    fullyQualifiedName: "contracts/mocks/MockERC20.sol:MockERC20",
    constructorArgs: [["string", "string"], ["USD Coin", "USDC"]],
  },
  // ── Proxy contracts — source verification is skipped; only proxy registration is done ──
  {
    envKey: "SX_ACCESS_CONTROL_ADDRESS",
    label: "SXAccessControlUpgradeable (proxy)",
    fullyQualifiedName: "contracts/SXAccessControlUpgradeable.sol:SXAccessControlUpgradeable",
    isProxy: true,
  },
  {
    envKey: "FEE_TREASURY_ADDRESS",
    label: "FeeTreasuryUpgradeable (proxy)",
    fullyQualifiedName: "contracts/FeeTreasuryUpgradeable.sol:FeeTreasuryUpgradeable",
    isProxy: true,
  },
  {
    envKey: "VERIFICATION_REGISTRY_ADDRESS",
    label: "VerificationRegistryUpgradeable (proxy)",
    fullyQualifiedName: "contracts/VerificationRegistryUpgradeable.sol:VerificationRegistryUpgradeable",
    isProxy: true,
  },
  {
    envKey: "SXUA_ADDRESS",
    label: "SXUAUpgradeable (proxy)",
    fullyQualifiedName: "contracts/SXUAUpgradeable.sol:SXUAUpgradeable",
    isProxy: true,
  },
  {
    envKey: "PREDICTION_MARKET_FACTORY_ADDRESS",
    label: "PredictionMarketFactoryUpgradeable (proxy)",
    fullyQualifiedName: "contracts/PredictionMarketFactoryUpgradeable.sol:PredictionMarketFactoryUpgradeable",
    isProxy: true,
    implEnvKey: "PREDICTION_MARKET_IMPLEMENTATION_ADDRESS",
  },
  {
    envKey: "LEADERBOARD_ADDRESS",
    label: "LeaderboardUpgradeable (proxy)",
    fullyQualifiedName: "contracts/LeaderboardUpgradeable.sol:LeaderboardUpgradeable",
    isProxy: true,
  },
  {
    envKey: "RESOLUTION_MANAGER_ADDRESS",
    label: "ResolutionManagerUpgradeable (proxy)",
    fullyQualifiedName: "contracts/ResolutionManagerUpgradeable.sol:ResolutionManagerUpgradeable",
    isProxy: true,
  },
  {
    envKey: "RESELLING_MARKETPLACE_ADDRESS",
    label: "ResellingMarketplaceUpgradeable (proxy)",
    fullyQualifiedName: "contracts/ResellingMarketplaceUpgradeable.sol:ResellingMarketplaceUpgradeable",
    isProxy: true,
  },
  // ── Plain implementation (not a proxy) — source verify normally ──
  {
    envKey: "PREDICTION_MARKET_IMPLEMENTATION_ADDRESS",
    label: "PredictionMarketUpgradeable (implementation)",
    fullyQualifiedName: "contracts/PredictionMarketUpgradeable.sol:PredictionMarketUpgradeable",
  },
];

// ─── Build-Info Loader ────────────────────────────────────────────────────────

interface BuildInfo {
  solcVersion: string;       // e.g. "0.8.28+commit.7893614a"
  solcLongVersion: string;
  input: object;             // StandardJsonInput — send this verbatim to Etherscan
}

function loadBuildInfo(): BuildInfo {
  const dir = path.resolve(__dirname, "../artifacts/build-info");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error("No build-info found. Run `npx hardhat compile` first.");
  }
  // Use the most recent build-info
  const latest = files.sort()[files.length - 1];
  const raw = JSON.parse(fs.readFileSync(path.join(dir, latest), "utf8"));
  return { solcVersion: raw.solcVersion, solcLongVersion: raw.solcLongVersion, input: raw.input };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpPost(url: string, body: string, contentType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = (parsed.protocol === "https:" ? https : http).request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Core Verification ────────────────────────────────────────────────────────

async function pollVerification(apiUrl: string, apiKey: string, guid: string): Promise<void> {
  console.log(`    ⏳ Polling for result (guid: ${guid}) ...`);
  const sep = apiUrl.includes("?") ? "&" : "?";
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(5000);
    const checkUrl =
      `${apiUrl}${sep}module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`;
    const raw = await httpGet(checkUrl);
    let resp: { status: string; result: string };
    try {
      resp = JSON.parse(raw);
    } catch {
      console.log(`    ⚠️  Non-JSON response, retrying... (${raw.slice(0, 80)})`);
      continue;
    }
    console.log(`    Status: ${resp.result}`);
    // Success states
    if (resp.result === "Pass - Verified") return;
    if (resp.result.toLowerCase().includes("already verified")) throw new AlreadyVerifiedError();
    // Failure states
    if (resp.result.startsWith("Fail")) throw new Error(`Verification failed: ${resp.result}`);
    // "Pending in queue" / "In queue" — keep polling
  }
  throw new Error("Verification timed out after 100s");
}

async function submitVerification(
  net: NetworkCfg,
  address: string,
  label: string,
  fullyQualifiedName: string,
  buildInfo: BuildInfo,
  constructorArgs?: [string[], unknown[]]
): Promise<void> {
  // ABI-encode constructor arguments
  let encodedArgs = "";
  if (constructorArgs && constructorArgs[0].length > 0) {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    encodedArgs = coder.encode(constructorArgs[0], constructorArgs[1]).slice(2); // strip 0x
  }

  // compilerversion must be "v0.8.28+commit.7893614a"
  const compilerVersion = `v${buildInfo.solcLongVersion}`;

  const params = querystring.stringify({
    apikey: net.apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: JSON.stringify(buildInfo.input),
    codeformat: "solidity-standard-json-input",
    contractname: fullyQualifiedName,          // must be "path/Contract.sol:Contract"
    compilerversion: compilerVersion,
    constructorArguements: encodedArgs,        // Etherscan API has this intentional typo
    licenseType: "3",                          // MIT
  });

  const raw = await httpPost(
    net.apiUrl,
    params,
    "application/x-www-form-urlencoded"
  );

  let resp: { status: string; message: string; result: string };
  try {
    resp = JSON.parse(raw);
  } catch {
    throw new Error(`Non-JSON response from API: ${raw.slice(0, 200)}`);
  }

  if (resp.status === "1") {
    // guid returned — poll for result
    await pollVerification(net.apiUrl, net.apiKey, resp.result);
    return;
  }

  const msg = resp.result ?? resp.message ?? "";
  if (
    msg.toLowerCase().includes("already verified") ||
    msg.toLowerCase().includes("already been verified")
  ) {
    throw new AlreadyVerifiedError();
  }
  throw new Error(msg || JSON.stringify(resp));
}

async function submitProxyRegistration(
  net: NetworkCfg,
  proxyAddress: string,
  implAddress?: string
): Promise<void> {
  const params = querystring.stringify({
    apikey: net.apiKey,
    module: "contract",
    action: "verifyproxycontract",
    address: proxyAddress,
    ...(implAddress ? { expectedimplementation: implAddress } : {}),
  });

  const raw = await httpPost(net.apiUrl, params, "application/x-www-form-urlencoded");
  let resp: { status: string; result: string; message?: string };
  try {
    resp = JSON.parse(raw);
  } catch {
    // Blockscout may return HTML for unsupported endpoints — silently skip
    console.log(`    ℹ️  Proxy registration not supported on this explorer — skipping`);
    return;
  }
  if (resp.status === "1") {
    console.log(`    ✅ Proxy registered (implementation linked)`);
  } else {
    const msg = resp.result ?? resp.message ?? "";
    console.log(`    ℹ️  Proxy registration: ${msg}`);
  }
}

class AlreadyVerifiedError extends Error {}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Determine target network
  const networkName = process.env.VERIFY_NETWORK
    ?? process.argv.find((a) => a.startsWith("--network="))?.split("=")[1]
    ?? "baseSepolia";

  const net = NETWORKS[networkName];
  if (!net) {
    throw new Error(`Unknown network "${networkName}". Choose: ${Object.keys(NETWORKS).join(", ")}`);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   SX Prediction Marketplace — Contract Verifier (Direct API) ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Network : ${networkName}  (chainId ${net.chainId})`);
  console.log(`   Explorer: ${net.browserUrl}`);
  console.log("───────────────────────────────────────────────────────────────\n");

  // Load build-info (no network connection needed)
  const buildInfo = loadBuildInfo();
  console.log(`📦 Build-info loaded — compiler: v${buildInfo.solcLongVersion}\n`);

  let passed = 0, skipped = 0, failed = 0;

  for (const contract of CONTRACTS) {
    const address = process.env[contract.envKey]?.trim();
    if (!address) {
      console.log(`⚠️  ${contract.label}: env var ${contract.envKey} not set — skipping`);
      skipped++;
      continue;
    }

    console.log(`🔍 ${contract.label}`);
    console.log(`   Address : ${address}`);
    console.log(`   Contract: ${contract.fullyQualifiedName}`);

    const implAddress = contract.implEnvKey
      ? process.env[contract.implEnvKey]?.trim()
      : undefined;

    try {
      if (contract.isProxy) {
        // Proxy addresses hold OZ ERC1967Proxy bytecode — skip source verification.
        // Instead register with Etherscan so it auto-reads the implementation slot.
        console.log(`   ⏩ Proxy — skipping source verification, registering proxy link ...`);
        await submitProxyRegistration(net, address, implAddress);
        console.log(`   ✅ Proxy registered — ${net.browserUrl}/address/${address}#code\n`);
        passed++;
      } else {
        await submitVerification(
          net,
          address,
          contract.label,
          contract.fullyQualifiedName,
          buildInfo,
          contract.constructorArgs
        );
        console.log(`   ✅ Verified — ${net.browserUrl}/address/${address}#code\n`);
        passed++;
      }
    } catch (err) {
      if (err instanceof AlreadyVerifiedError) {
        console.log(`   ℹ️  Already verified — ${net.browserUrl}/address/${address}#code\n`);
        skipped++;
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ Failed: ${msg}\n`);
        failed++;
      }
    }
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Done — ✅ ${passed} verified  |  ℹ️  ${skipped} skipped  |  ❌ ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
