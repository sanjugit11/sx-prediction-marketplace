/**
 * verify_sxua.ts — Direct block-explorer verification for SXUAUpgradeable
 * Target Address: 0x92B882eF40d85F08f517A3d080fc932fAffEa2ea
 * Network: Base Sepolia
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as https from "https";
import * as http from "http";
import * as querystring from "querystring";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const TARGET_ADDRESS = "0xbfEA2f87783030b45800C1f2b88F83FC9a556434";
const FULLY_QUALIFIED_NAME = "contracts/SXUAUpgradeable.sol:SXUAUpgradeable";

// Base Sepolia Configuration
const NETWORK = {
  chainId: 84532,
  apiUrl: "https://api.etherscan.io/v2/api?chainid=84532",
  browserUrl: "https://sepolia.basescan.org",
  apiKey: process.env.ETHERSCAN_API_KEY?.trim() ?? "",
};

interface BuildInfo {
  solcVersion: string;
  solcLongVersion: string;
  input: object;
}

function loadBuildInfo(): BuildInfo {
  const dir = path.resolve(__dirname, "../artifacts/build-info");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error("No build-info found. Run `npx hardhat compile` first.");
  }
  const latest = files.sort()[files.length - 1];
  const raw = JSON.parse(fs.readFileSync(path.join(dir, latest), "utf8"));
  return { solcVersion: raw.solcVersion, solcLongVersion: raw.solcLongVersion, input: raw.input };
}

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

async function pollVerification(apiUrl: string, apiKey: string, guid: string): Promise<void> {
  console.log(`    ⏳ Polling for result (guid: ${guid}) ...`);
  const sep = apiUrl.includes("?") ? "&" : "?";
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(5000);
    const checkUrl = `${apiUrl}${sep}module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`;
    const raw = await httpGet(checkUrl);
    let resp: any;
    try {
      resp = JSON.parse(raw);
    } catch {
      console.log(`    ⚠️  Non-JSON response, retrying...`);
      continue;
    }
    console.log(`    Status: ${resp.result}`);
    if (resp.result === "Pass - Verified") return;
    if (resp.result.toLowerCase().includes("already verified")) throw new Error("AlreadyVerified");
    if (resp.result.startsWith("Fail")) throw new Error(`Verification failed: ${resp.result}`);
  }
  throw new Error("Verification timed out after 100s");
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Verifying ${FULLY_QUALIFIED_NAME}`);
  console.log(`   Address : ${TARGET_ADDRESS}`);
  console.log(`   Network : Base Sepolia  (chainId ${NETWORK.chainId})`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const buildInfo = loadBuildInfo();
  console.log(`📦 Build-info loaded — compiler: v${buildInfo.solcLongVersion}\n`);

  const compilerVersion = `v${buildInfo.solcLongVersion}`;
  const params = querystring.stringify({
    apikey: NETWORK.apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: TARGET_ADDRESS,
    sourceCode: JSON.stringify(buildInfo.input),
    codeformat: "solidity-standard-json-input",
    contractname: FULLY_QUALIFIED_NAME,
    compilerversion: compilerVersion,
    constructorArguements: "",
    licenseType: "3", // MIT
  });

  try {
    const raw = await httpPost(NETWORK.apiUrl, params, "application/x-www-form-urlencoded");
    const resp = JSON.parse(raw);

    if (resp.status === "1") {
      await pollVerification(NETWORK.apiUrl, NETWORK.apiKey, resp.result);
      console.log(`\n   ✅ Verified successfully!`);
      console.log(`   Explorer: ${NETWORK.browserUrl}/address/${TARGET_ADDRESS}#code\n`);
    } else {
      const msg = resp.result ?? resp.message ?? "";
      if (msg.toLowerCase().includes("already verified") || msg.toLowerCase().includes("already been verified")) {
        console.log(`\n   ℹ️  Already verified!`);
        console.log(`   Explorer: ${NETWORK.browserUrl}/address/${TARGET_ADDRESS}#code\n`);
      } else {
        throw new Error(msg);
      }
    }
  } catch (err: any) {
    if (err.message === "AlreadyVerified") {
      console.log(`\n   ℹ️  Already verified!`);
      console.log(`   Explorer: ${NETWORK.browserUrl}/address/${TARGET_ADDRESS}#code\n`);
    } else {
      console.error(`\n   ❌ Failed: ${err.message || String(err)}\n`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
