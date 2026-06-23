import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function writeEnvValues(envFilePath: string, values: Record<string, string>) {
  const serialize = (value: string) => (value.includes(" ") ? JSON.stringify(value) : value);
  const text = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, "utf8") : "";
  const lines = text.split(/\r?\n/);
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const [key] = line.split("=");
    if (key && Object.prototype.hasOwnProperty.call(values, key.trim())) {
      return `${key.trim()}=${serialize(values[key.trim()])}`;
    }
    return line;
  });

  const missingKeys = Object.keys(values).filter((key) => !lines.some((line) => line.trim().startsWith(`${key}=`)));
  const finalLines = updated.concat(missingKeys.map((key) => `${key}=${serialize(values[key])}`));
  fs.writeFileSync(envFilePath, finalLines.join("\n") + (finalLines.length ? "\n" : ""));
}

async function main() {
  console.log("Starting SX Prediction Marketplace deployment...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);

  // Deploy Mock USDC on testnet for demonstration, or use pre-configured address
  let usdcAddress = "";
  if (process.env.USDC_ADDRESS) {
    usdcAddress = process.env.USDC_ADDRESS;
    console.log(`Using configured USDC address: ${usdcAddress}`);
  } else {
    console.log("No USDC_ADDRESS found in environment. Deploying Mock USDC...");
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20Factory.deploy("USD Coin", "USDC");
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    console.log(`Mock USDC deployed to: ${usdcAddress}`);
  }

  // 1. Deploy Access Control Proxy
  console.log("Deploying SXAccessControlUpgradeable...");
  const SXAccessControlFactory = await ethers.getContractFactory("SXAccessControlUpgradeable");
  const accessControl = await upgrades.deployProxy(SXAccessControlFactory, [deployer.address]);
  await accessControl.waitForDeployment();
  const acAddress = await accessControl.getAddress();
  console.log(`SXAccessControlUpgradeable proxy deployed to: ${acAddress}`);

  // 2. Deploy Fee Treasury Proxy
  console.log("Deploying FeeTreasuryUpgradeable...");
  const FeeTreasuryFactory = await ethers.getContractFactory("FeeTreasuryUpgradeable");
  const feeTreasury = await upgrades.deployProxy(FeeTreasuryFactory, [acAddress]);
  await feeTreasury.waitForDeployment();
  const ftAddress = await feeTreasury.getAddress();
  console.log(`FeeTreasuryUpgradeable proxy deployed to: ${ftAddress}`);

  // 3. Deploy Verification Registry Proxy
  // console.log("Deploying VerificationRegistryUpgradeable...");
  // const VerificationRegistryFactory = await ethers.getContractFactory("VerificationRegistryUpgradeable");
  // const verificationRegistry = await upgrades.deployProxy(VerificationRegistryFactory, [acAddress]);
  // await verificationRegistry.waitForDeployment();
  // const vrAddress = await verificationRegistry.getAddress();
  // console.log(`VerificationRegistryUpgradeable proxy deployed to: ${vrAddress}`);

  // 4. Deploy SXUA Proxy (Unified Account)
  console.log("Deploying SXUAUpgradeable...");
  const SXUAFactory = await ethers.getContractFactory("SXUAUpgradeable");
  const sxua = await upgrades.deployProxy(SXUAFactory, [
    acAddress,
    ftAddress,
    [usdcAddress]
  ]);
  await sxua.waitForDeployment();
  const sxuaAddress = await sxua.getAddress();
  console.log(`SXUAUpgradeable proxy deployed to: ${sxuaAddress}`);
 return;
  // 5. Deploy Prediction Market Master Implementation
  console.log("Deploying PredictionMarketUpgradeable (Master Implementation)...");
  const PredictionMarketFactory = await ethers.getContractFactory("PredictionMarketUpgradeable");
  const pmImplementation = await PredictionMarketFactory.deploy();
  await pmImplementation.waitForDeployment();
  const pmImplAddress = await pmImplementation.getAddress();
  console.log(`PredictionMarketUpgradeable implementation deployed to: ${pmImplAddress}`);

  // Mark Implementation verified in Registry
  console.log("Marking PredictionMarket implementation verified in Registry...");
  const markTx = await verificationRegistry.markVerified(pmImplAddress, true);
  await markTx.wait();

  // 6. Deploy Prediction Market Factory Proxy
  console.log("Deploying PredictionMarketFactoryUpgradeable...");
  const PredictionMarketFactoryUpgradeable = await ethers.getContractFactory("PredictionMarketFactoryUpgradeable");
  const factory = await upgrades.deployProxy(PredictionMarketFactoryUpgradeable, [
    acAddress,
    vrAddress,
    pmImplAddress,
    ftAddress
  ]);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`PredictionMarketFactoryUpgradeable proxy deployed to: ${factoryAddress}`);

  // 7. Deploy Leaderboard Proxy
  console.log("Deploying LeaderboardUpgradeable...");
  const LeaderboardFactory = await ethers.getContractFactory("LeaderboardUpgradeable");
  const leaderboard = await upgrades.deployProxy(LeaderboardFactory, [
    acAddress,
    ftAddress
  ]);
  await leaderboard.waitForDeployment();
  const lbAddress = await leaderboard.getAddress();
  console.log(`LeaderboardUpgradeable proxy deployed to: ${lbAddress}`);

  // 8. Deploy Resolution Manager Proxy
  console.log("Deploying ResolutionManagerUpgradeable...");
  const ResolutionManagerFactory = await ethers.getContractFactory("ResolutionManagerUpgradeable");
  const resolutionManager = await upgrades.deployProxy(ResolutionManagerFactory, [
    acAddress,
    lbAddress
  ]);
  await resolutionManager.waitForDeployment();
  const rmAddress = await resolutionManager.getAddress();
  console.log(`ResolutionManagerUpgradeable proxy deployed to: ${rmAddress}`);

  // 9. Deploy Reselling Marketplace Proxy
  console.log("Deploying ResellingMarketplaceUpgradeable...");
  const MarketplaceFactory = await ethers.getContractFactory("ResellingMarketplaceUpgradeable");
  const marketplace = await upgrades.deployProxy(MarketplaceFactory, [
    acAddress,
    ftAddress
  ]);
  await marketplace.waitForDeployment();
  const mpAddress = await marketplace.getAddress();
  console.log(`ResellingMarketplaceUpgradeable proxy deployed to: ${mpAddress}`);

  // Configure cross-references
  console.log("Configuring contract cross-references...");
  
  const setResolutionManagerTx = await leaderboard.setResolutionManager(rmAddress);
  await setResolutionManagerTx.wait();
  
  const setProtocolTx = await factory.setProtocolAddresses(rmAddress, mpAddress);
  await setProtocolTx.wait();

  console.log("\nSetup complete! Deployments summary:");
  console.log("------------------------------------");
  console.log(`Collateral Token (USDC):             ${usdcAddress}`);
  console.log(`SXAccessControlUpgradeable:          ${acAddress}`);
  console.log(`FeeTreasuryUpgradeable:              ${ftAddress}`);
  console.log(`VerificationRegistryUpgradeable:     ${vrAddress}`);
  console.log(`SXUAUpgradeable (Unified Account):   ${sxuaAddress}`);
  console.log(`PredictionMarket Master Impl:        ${pmImplAddress}`);
  console.log(`PredictionMarketFactoryUpgradeable:  ${factoryAddress}`);
  console.log(`LeaderboardUpgradeable:              ${lbAddress}`);
  console.log(`ResolutionManagerUpgradeable:       ${rmAddress}`);
  console.log(`ResellingMarketplaceUpgradeable:     ${mpAddress}`);
  console.log("------------------------------------");
  console.log("SX Prediction Marketplace successfully deployed!");

  const envPath = path.resolve(__dirname, "../..", ".env");
  writeEnvValues(envPath, {
    USDC_ADDRESS: usdcAddress,
    SX_ACCESS_CONTROL_ADDRESS: acAddress,
    FEE_TREASURY_ADDRESS: ftAddress,
    VERIFICATION_REGISTRY_ADDRESS: vrAddress,
    SXUA_ADDRESS: sxuaAddress,
    PREDICTION_MARKET_IMPLEMENTATION_ADDRESS: pmImplAddress,
    PREDICTION_MARKET_FACTORY_ADDRESS: factoryAddress,
    LEADERBOARD_ADDRESS: lbAddress,
    RESOLUTION_MANAGER_ADDRESS: rmAddress,
    RESELLING_MARKETPLACE_ADDRESS: mpAddress,
  });
  console.log(`Saved deployed contract addresses to ${envPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
