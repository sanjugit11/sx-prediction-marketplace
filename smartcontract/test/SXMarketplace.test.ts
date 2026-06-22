import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  SXAccessControlUpgradeable,
  FeeTreasuryUpgradeable,
  VerificationRegistryUpgradeable,
  SXUAUpgradeable,
  PredictionMarketUpgradeable,
  PredictionMarketFactoryUpgradeable,
  ResolutionManagerUpgradeable,
  LeaderboardUpgradeable,
  ResellingMarketplaceUpgradeable,
  MockERC20
} from "../typechain-types";

describe("SX Prediction Marketplace - Hardhat Tests", function () {
  let admin: SignerWithAddress;
  let operator: SignerWithAddress;
  let resolver: SignerWithAddress;
  let creator: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let accessControl: SXAccessControlUpgradeable;
  let feeTreasury: FeeTreasuryUpgradeable;
  let verificationRegistry: VerificationRegistryUpgradeable;
  let sxua: SXUAUpgradeable;
  let pmImplementation: PredictionMarketUpgradeable;
  let factory: PredictionMarketFactoryUpgradeable;
  let leaderboard: LeaderboardUpgradeable;
  let resolutionManager: ResolutionManagerUpgradeable;
  let marketplace: ResellingMarketplaceUpgradeable;

  let usdc: MockERC20;

  beforeEach(async function () {
    [admin, operator, resolver, creator, alice, bob] = await ethers.getSigners();

    // Deploy Mock ERC20
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    usdc = (await MockERC20Factory.deploy("USD Coin", "USDC")) as unknown as MockERC20;
    await usdc.waitForDeployment();

    // Deploy Access Control
    const SXAccessControlFactory = await ethers.getContractFactory("SXAccessControlUpgradeable");
    accessControl = (await upgrades.deployProxy(SXAccessControlFactory, [admin.address])) as unknown as SXAccessControlUpgradeable;
    await accessControl.waitForDeployment();

    // Grant roles
    const opRole = await accessControl.OPERATOR_ROLE();
    const resRole = await accessControl.RESOLVER_ROLE();
    const creatorRole = await accessControl.MARKET_CREATOR_ROLE();

    await accessControl.grantRole(opRole, operator.address);
    await accessControl.grantRole(resRole, resolver.address);
    await accessControl.grantRole(creatorRole, creator.address);

    // Deploy Fee Treasury
    const FeeTreasuryFactory = await ethers.getContractFactory("FeeTreasuryUpgradeable");
    feeTreasury = (await upgrades.deployProxy(FeeTreasuryFactory, [await accessControl.getAddress()])) as unknown as FeeTreasuryUpgradeable;
    await feeTreasury.waitForDeployment();

    // Deploy Verification Registry
    const VerificationRegistryFactory = await ethers.getContractFactory("VerificationRegistryUpgradeable");
    verificationRegistry = (await upgrades.deployProxy(VerificationRegistryFactory, [await accessControl.getAddress()])) as unknown as VerificationRegistryUpgradeable;
    await verificationRegistry.waitForDeployment();

    // Deploy SXUA
    const SXUAFactory = await ethers.getContractFactory("SXUAUpgradeable");
    sxua = (await upgrades.deployProxy(SXUAFactory, [
      await accessControl.getAddress(),
      await feeTreasury.getAddress(),
      [await usdc.getAddress()]
    ])) as unknown as SXUAUpgradeable;
    await sxua.waitForDeployment();

    // Deploy Prediction Market Implementation
    const PredictionMarketFactory = await ethers.getContractFactory("PredictionMarketUpgradeable");
    pmImplementation = await PredictionMarketFactory.deploy() as unknown as PredictionMarketUpgradeable;
    await pmImplementation.waitForDeployment();

    // Verify implementation
    await verificationRegistry.markVerified(await pmImplementation.getAddress(), true);

    // Deploy Prediction Market Factory
    const PredictionMarketFactoryUpgradeable = await ethers.getContractFactory("PredictionMarketFactoryUpgradeable");
    factory = (await upgrades.deployProxy(PredictionMarketFactoryUpgradeable, [
      await accessControl.getAddress(),
      await verificationRegistry.getAddress(),
      await pmImplementation.getAddress(),
      await feeTreasury.getAddress()
    ])) as unknown as PredictionMarketFactoryUpgradeable;
    await factory.waitForDeployment();

    // Deploy Leaderboard
    const LeaderboardFactory = await ethers.getContractFactory("LeaderboardUpgradeable");
    leaderboard = (await upgrades.deployProxy(LeaderboardFactory, [
      await accessControl.getAddress(),
      await feeTreasury.getAddress()
    ])) as unknown as LeaderboardUpgradeable;
    await leaderboard.waitForDeployment();

    // Deploy Resolution Manager
    const ResolutionManagerFactory = await ethers.getContractFactory("ResolutionManagerUpgradeable");
    resolutionManager = (await upgrades.deployProxy(ResolutionManagerFactory, [
      await accessControl.getAddress(),
      await leaderboard.getAddress()
    ])) as unknown as ResolutionManagerUpgradeable;
    await resolutionManager.waitForDeployment();

    // Deploy Reselling Marketplace
    const MarketplaceFactory = await ethers.getContractFactory("ResellingMarketplaceUpgradeable");
    marketplace = (await upgrades.deployProxy(MarketplaceFactory, [
      await accessControl.getAddress(),
      await feeTreasury.getAddress()
    ])) as unknown as ResellingMarketplaceUpgradeable;
    await marketplace.waitForDeployment();

    // Configure references
    await leaderboard.setResolutionManager(await resolutionManager.getAddress());
    await factory.setProtocolAddresses(await resolutionManager.getAddress(), await marketplace.getAddress());

    // Mint USDC
    await usdc.mint(alice.address, ethers.parseUnits("10000", 6));
    await usdc.mint(bob.address, ethers.parseUnits("10000", 6));
  });

  it("should deploy upgradeable contracts correctly and verify initial state", async function () {
    expect(await accessControl.hasRole(await accessControl.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    expect(await feeTreasury.accessControl()).to.equal(await accessControl.getAddress());
    expect(await verificationRegistry.isVerified(await pmImplementation.getAddress())).to.be.true;
    expect(await sxua.isSupportedToken(await usdc.getAddress())).to.be.true;
  });

  it("should allow factory cloning and initial configuration", async function () {
    const question = "Will ETH hit $10k in 2026?";
    const endTime = Math.floor(Date.now() / 1000) + 86400 * 10;
    const minStake = ethers.parseUnits("100", 6);

    const tx = await factory.connect(creator).createMarket(question, endTime, minStake, await usdc.getAddress());
    const receipt = await tx.wait();

    const markets = await factory.getMarkets();
    expect(markets.length).to.equal(1);
    expect(markets[0]).to.not.equal(ethers.ZeroAddress);

    const pm = await ethers.getContractAt("PredictionMarketUpgradeable", markets[0]);
    expect(await pm.question()).to.equal(question);
    expect(await pm.minimumStake()).to.equal(minStake);
    expect(await pm.collateralToken()).to.equal(await usdc.getAddress());
    expect(await pm.resellingMarketplace()).to.equal(await marketplace.getAddress());
    expect(await pm.resolutionManager()).to.equal(await resolutionManager.getAddress());
  });

  it("should perform staking and calculate correct odds", async function () {
    const question = "Will ETH hit $10k in 2026?";
    const endTime = Math.floor(Date.now() / 1000) + 86400 * 10;
    const minStake = ethers.parseUnits("100", 6);

    await factory.connect(creator).createMarket(question, endTime, minStake, await usdc.getAddress());
    const markets = await factory.getMarkets();
    const pm = await ethers.getContractAt("PredictionMarketUpgradeable", markets[0]);

    // Alice stakes 100 YES
    const stakeAmount = ethers.parseUnits("100", 6);
    const feeAmount = ethers.parseUnits("1", 6); // 1%
    await usdc.connect(alice).approve(await pm.getAddress(), stakeAmount + feeAmount);
    await pm.connect(alice).stakeYes(stakeAmount);

    expect(await pm.yesPool()).to.equal(stakeAmount);
    expect(await pm.totalPool()).to.equal(stakeAmount);
    expect(await pm.getOdds(true)).to.equal(ethers.parseUnits("1", 18));
  });
});
