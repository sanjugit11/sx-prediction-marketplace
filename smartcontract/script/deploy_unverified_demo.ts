import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  console.log("\n==============================================");
  console.log("⚠️ Starting Unverified Contract Deployment Demo");
  console.log("==============================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);

  const factoryAddress = process.env.PREDICTION_MARKET_FACTORY_ADDRESS;
  const collateralToken = process.env.USDC_ADDRESS;

  if (!factoryAddress || !collateralToken) {
    throw new Error("Missing factory or USDC address in .env. Please run main deploy script first.");
  }

  // 1. Deploy the unverified implementation
  console.log("\n[1] Deploying the *unverified* prediction market implementation...");
  const UnverifiedFactory = await ethers.getContractFactory("PredictionMarketUnverified");
  const unverifiedImpl = await UnverifiedFactory.deploy();
  await unverifiedImpl.waitForDeployment();
  const unverifiedImplAddress = await unverifiedImpl.getAddress();
  console.log(`    Deployed Unverified Implementation to: ${unverifiedImplAddress}`);

  // 2. Set the unverified implementation on the Factory
  // Note: Since this implementation wasn't run through the Verification Registry,
  // the registry does not know about it.
  console.log("\n[2] Setting the Factory to use the new UNVERIFIED implementation...");
  const factory = await ethers.getContractAt("PredictionMarketFactoryUpgradeable", factoryAddress);
  const tx = await factory.setMasterMarketImplementation(unverifiedImplAddress);
  await tx.wait();
  console.log(`    Factory master implementation updated to: ${unverifiedImplAddress}`);

  // 3. Attempt to create a market
  console.log("\n[3] Attempting to create a new market using the unverified code...");
  console.log(`    This tests the Gating Check that prevents unverified code execution.`);
  
  try {
    const createTx = await factory.createMarket(
      "Will this unverified market deploy?",
      Math.floor(Date.now() / 1000) + 86400, // 1 day from now
      ethers.parseUnits("10", 18),
      collateralToken
    );
    await createTx.wait();
    console.log("❌ ERROR: Market was deployed successfully! Gating check failed.");
  } catch (error: any) {
    // The smart contract reverts with ImplementationNotVerified()
    if (error.message.includes("ImplementationNotVerified") || error.message.includes("reverted")) {
      console.log("\n🚨 TRANSACTION REVERTED: ImplementationNotVerified()");
      console.log("🛑 Custom Error: \"Contract not formally verified\"");
      console.log("    -> The SGX/Hardware attestation or Solc compiler hash did not match the Verification Registry.");
      console.log("    -> Deployment blocked to protect user funds.");
    } else {
      console.error(error);
    }
  }

  console.log("\n==============================================");
  console.log("🏁 Demo Complete");
  console.log("==============================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
