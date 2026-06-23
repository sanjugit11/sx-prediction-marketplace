// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/SXAccessControlUpgradeable.sol";
import "../contracts/FeeTreasuryUpgradeable.sol";
import "../contracts/VerificationRegistryUpgradeable.sol";
import "../contracts/SXUAUpgradeable.sol";
import "../contracts/PredictionMarketUpgradeable.sol";
import "../contracts/PredictionMarketFactoryUpgradeable.sol";
import "../contracts/ResolutionManagerUpgradeable.sol";
import "../contracts/LeaderboardUpgradeable.sol";
import "../contracts/ResellingMarketplaceUpgradeable.sol";
import "../contracts/mocks/MockERC20.sol";

contract SXMarketplaceTest is Test {
    SXAccessControlUpgradeable accessControl;
    FeeTreasuryUpgradeable feeTreasury;
    VerificationRegistryUpgradeable verificationRegistry;
    SXUAUpgradeable sxua;
    PredictionMarketUpgradeable pmImplementation;
    PredictionMarketFactoryUpgradeable factory;
    ResolutionManagerUpgradeable resolutionManager;
    LeaderboardUpgradeable leaderboard;
    ResellingMarketplaceUpgradeable marketplace;

    MockERC20 usdc;
    MockERC20 usdt;
    MockERC20 dai;

    address admin = address(0xAD);
    address operator = address(0x01);
    address resolver = address(0x02);
    address creator = address(0x03);
    address indexer = address(0x04);

    address alice = address(0xAA);
    address bob = address(0xBB);
    address charlie = address(0xCC);

    function setUp() public {
        // Deploy Mock Tokens
        usdc = new MockERC20("USD Coin", "USDC");
        usdt = new MockERC20("Tether", "USDT");
        dai = new MockERC20("Dai Stablecoin", "DAI");

        // Deploy Access Control
        SXAccessControlUpgradeable acImpl = new SXAccessControlUpgradeable();
        ERC1967Proxy acProxy = new ERC1967Proxy(
            address(acImpl),
            abi.encodeWithSelector(SXAccessControlUpgradeable.initialize.selector, admin)
        );
        accessControl = SXAccessControlUpgradeable(address(acProxy));

        // Grant Roles from Admin
        vm.startPrank(admin);
        accessControl.grantRole(accessControl.OPERATOR_ROLE(), operator);
        accessControl.grantRole(accessControl.RESOLVER_ROLE(), resolver);
        accessControl.grantRole(accessControl.MARKET_CREATOR_ROLE(), creator);
        accessControl.grantRole(accessControl.INDEXER_ROLE(), indexer);
        vm.stopPrank();

        // Deploy Fee Treasury
        FeeTreasuryUpgradeable ftImpl = new FeeTreasuryUpgradeable();
        ERC1967Proxy ftProxy = new ERC1967Proxy(
            address(ftImpl),
            abi.encodeWithSelector(FeeTreasuryUpgradeable.initialize.selector, address(accessControl))
        );
        feeTreasury = FeeTreasuryUpgradeable(address(ftProxy));

        // Deploy Verification Registry
        VerificationRegistryUpgradeable vrImpl = new VerificationRegistryUpgradeable();
        ERC1967Proxy vrProxy = new ERC1967Proxy(
            address(vrImpl),
            abi.encodeWithSelector(VerificationRegistryUpgradeable.initialize.selector, address(accessControl))
        );
        verificationRegistry = VerificationRegistryUpgradeable(address(vrProxy));

        // Initialize SXUA with USDC, USDT, DAI
        address[] memory tokens = new address[](3);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);
        tokens[2] = address(dai);

        SXUAUpgradeable sxuaImpl = new SXUAUpgradeable();
        ERC1967Proxy sxuaProxy = new ERC1967Proxy(
            address(sxuaImpl),
            abi.encodeWithSelector(SXUAUpgradeable.initialize.selector, address(accessControl), address(feeTreasury), tokens)
        );
        sxua = SXUAUpgradeable(address(sxuaProxy));

        // Deploy Prediction Market Implementation
        pmImplementation = new PredictionMarketUpgradeable();

        // Deploy Factory
        PredictionMarketFactoryUpgradeable factoryImpl = new PredictionMarketFactoryUpgradeable();
        ERC1967Proxy factoryProxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeWithSelector(
                PredictionMarketFactoryUpgradeable.initialize.selector,
                address(accessControl),
                address(verificationRegistry),
                address(pmImplementation),
                address(feeTreasury)
            )
        );
        factory = PredictionMarketFactoryUpgradeable(address(factoryProxy));

        // Deploy Leaderboard
        LeaderboardUpgradeable lbImpl = new LeaderboardUpgradeable();
        ERC1967Proxy lbProxy = new ERC1967Proxy(
            address(lbImpl),
            abi.encodeWithSelector(LeaderboardUpgradeable.initialize.selector, address(accessControl), address(feeTreasury))
        );
        leaderboard = LeaderboardUpgradeable(address(lbProxy));

        // Deploy Resolution Manager
        ResolutionManagerUpgradeable rmImpl = new ResolutionManagerUpgradeable();
        ERC1967Proxy rmProxy = new ERC1967Proxy(
            address(rmImpl),
            abi.encodeWithSelector(ResolutionManagerUpgradeable.initialize.selector, address(accessControl), address(leaderboard))
        );
        resolutionManager = ResolutionManagerUpgradeable(address(rmProxy));

        // Deploy Marketplace
        ResellingMarketplaceUpgradeable mpImpl = new ResellingMarketplaceUpgradeable();
        ERC1967Proxy mpProxy = new ERC1967Proxy(
            address(mpImpl),
            abi.encodeWithSelector(ResellingMarketplaceUpgradeable.initialize.selector, address(accessControl), address(feeTreasury))
        );
        marketplace = ResellingMarketplaceUpgradeable(address(mpProxy));

        // Configure Leaderboard references
        vm.prank(admin);
        leaderboard.setResolutionManager(address(resolutionManager));

        // Configure Factory references
        vm.prank(admin);
        factory.setProtocolAddresses(address(resolutionManager), address(marketplace));

        // Mark Implementation verified in Registry
        vm.prank(admin);
        verificationRegistry.markVerified(address(pmImplementation), true);

        // Fund Users
        usdc.mint(alice, 1_000_000 * 1e6);
        usdc.mint(bob, 1_000_000 * 1e6);
        usdc.mint(charlie, 1_000_000 * 1e6);

        usdt.mint(alice, 1_000_000 * 1e6);
        dai.mint(alice, 1_000_000 * 1e18);
    }

    // ==========================================
    // SXAccessControlUpgradeable tests
    // ==========================================
    function testAccessControlRoles() public {
        bytes32 adminRole = accessControl.DEFAULT_ADMIN_ROLE();
        bytes32 opRole = accessControl.OPERATOR_ROLE();
        bytes32 resRole = accessControl.RESOLVER_ROLE();
        bytes32 creatorRole = accessControl.MARKET_CREATOR_ROLE();
        bytes32 indexerRole = accessControl.INDEXER_ROLE();

        assertTrue(accessControl.hasRole(adminRole, admin));
        assertTrue(accessControl.hasRole(opRole, operator));
        assertTrue(accessControl.hasRole(resRole, resolver));
        assertTrue(accessControl.hasRole(creatorRole, creator));
        assertTrue(accessControl.hasRole(indexerRole, indexer));

        // Check revoking
        vm.prank(admin);
        accessControl.revokeRole(indexerRole, indexer);
        assertFalse(accessControl.hasRole(indexerRole, indexer));
    }

    // ==========================================
    // SXUAUpgradeable (Unified Account) tests
    // ==========================================
    function testDepositSplits() public {
        vm.startPrank(alice);
        usdc.approve(address(sxua), 10_000 * 1e6);

        // 70% committed, 30% uncommitted
        sxua.deposit(address(usdc), 10_000 * 1e6, 70);
        vm.stopPrank();

        assertEq(sxua.getUncommittedBalance(alice, address(usdc)), 3_000 * 1e6);
        assertEq(sxua.getCommittedBalances(alice, address(usdc)), 7_000 * 1e6);
        assertEq(sxua.getUnifiedBalance(alice, address(usdc)), 10_000 * 1e6);
    }

    function testWithdrawUncommitted() public {
        vm.startPrank(alice);
        usdc.approve(address(sxua), 10_000 * 1e6);
        sxua.deposit(address(usdc), 10_000 * 1e6, 0); // 100% uncommitted

        // Withdraw 1,000 USDC. Net should be 940 (6% fee)
        uint256 balBefore = usdc.balanceOf(alice);
        sxua.withdrawUncommitted(address(usdc), 1_000 * 1e6);
        vm.stopPrank();

        uint256 balAfter = usdc.balanceOf(alice);
        assertEq(balAfter - balBefore, 940 * 1e6);
        assertEq(feeTreasury.getTotalRevenue(address(usdc)), 60 * 1e6);
    }

    function testWithdrawCommittedBeforeMaturity() public {
        vm.startPrank(alice);
        usdc.approve(address(sxua), 10_000 * 1e6);
        sxua.deposit(address(usdc), 10_000 * 1e6, 100); // 100% committed
        
        uint256[] memory ids = sxua.getUserSubAccounts(alice);
        uint256 subId = ids[0];

        // Withdraw committed immediately. Should forfeit yield, pay 6% fee on principal
        uint256 balBefore = usdc.balanceOf(alice);
        sxua.withdrawCommitted(subId);
        vm.stopPrank();

        uint256 balAfter = usdc.balanceOf(alice);
        assertEq(balAfter - balBefore, 9_400 * 1e6); // 10,000 principal - 600 fee
        assertEq(feeTreasury.getTotalRevenue(address(usdc)), 600 * 1e6);
    }

    function testWithdrawCommittedAfterMaturity() public {
        vm.startPrank(alice);
        usdc.approve(address(sxua), 10_000 * 1e6);
        sxua.deposit(address(usdc), 10_000 * 1e6, 100);
        
        uint256[] memory ids = sxua.getUserSubAccounts(alice);
        uint256 subId = ids[0];
        vm.stopPrank();

        // Warp time by 450 seconds (simulates 105 days in demo mode)
        vm.warp(block.timestamp + 450 seconds);

        // Daily yield = 0.12%. For 105 days, yield = 10,000 * 0.0012 * 105 = 1,260 USDC.
        // Total = 10,000 principal + 1,260 yield = 11,260 USDC.
        // Net = 11,260 - (11,260 * 6%) = 11,260 - 675.6 = 10,584.4 USDC (10584400000 units for 6 decimals)
        // Wait, yield = 10,000 * 1e6 * 12 * 105 / 10,000 = 1,260 * 1e6.
        // Let's verify the accrued yield view first.
        uint256 yieldVal = sxua.getAccruedYield(alice, subId);
        assertEq(yieldVal, 1_260 * 1e6);

        // Mint extra USDC to sxua to cover the yield payout reserves
        usdc.mint(address(sxua), 2_000 * 1e6);

        vm.prank(alice);
        sxua.withdrawCommitted(subId);

        // Fee = 11,260 * 6 / 100 = 675.6 USDC
        // Payout = 11,260 - 675.6 = 10,584.4 USDC
        assertEq(feeTreasury.getTotalRevenue(address(usdc)), uint256(11_260 * 1e6) * 6 / 100);
    }

    // ==========================================
    // Prediction Market Factory & Marketplace tests
    // ==========================================
    function testMarketCloning() public {
        vm.startPrank(creator);
        address mAddress = factory.createMarket("Will ETH hit $10k in 2026?", block.timestamp + 10 days, 100 * 1e6, address(usdc));
        vm.stopPrank();

        assertTrue(mAddress != address(0));
        assertEq(factory.getMarkets().length, 1);
        assertEq(factory.getMarkets()[0], mAddress);

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(mAddress);
        assertEq(pm.question(), "Will ETH hit $10k in 2026?");
        assertEq(pm.endTime(), block.timestamp + 10 days);
        assertEq(pm.minimumStake(), 100 * 1e6);
        assertEq(pm.collateralToken(), address(usdc));
    }

    function testStakingAndOdds() public {
        vm.startPrank(creator);
        address mAddress = factory.createMarket("Will ETH hit $10k in 2026?", block.timestamp + 10 days, 100 * 1e6, address(usdc));
        vm.stopPrank();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(mAddress);

        // Alice stakes 1,000 USDC YES. She pays 1,010 USDC (10 USDC fee).
        vm.startPrank(alice);
        usdc.approve(address(pm), 1_010 * 1e6);
        pm.stakeYes(1_000 * 1e6);
        vm.stopPrank();

        assertEq(pm.yesPool(), 1_000 * 1e6);
        assertEq(pm.totalPool(), 1_000 * 1e6);
        // yesOdds = 1,000 / 1,000 = 1.0x (1e18)
        assertEq(pm.getOdds(true), 1e18);

        // Bob stakes 3,000 USDC NO. He pays 3,030 USDC (30 USDC fee).
        vm.startPrank(bob);
        usdc.approve(address(pm), 3_030 * 1e6);
        pm.stakeNo(3_000 * 1e6);
        vm.stopPrank();

        assertEq(pm.noPool(), 3_000 * 1e6);
        assertEq(pm.totalPool(), 4_000 * 1e6);
        // yesOdds = 4,000 / 1,000 = 4.0x (4e18)
        assertEq(pm.getOdds(true), 4e18);
        uint256 expectedOdds = uint256(4_000 * 1e18) / 3_000;
        assertEq(pm.getOdds(false), expectedOdds);
    }

    function testResolutionAndPayout() public {
        vm.startPrank(creator);
        address mAddress = factory.createMarket("Will ETH hit $10k in 2026?", block.timestamp + 10 days, 100 * 1e6, address(usdc));
        vm.stopPrank();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(mAddress);

        // Alice stakes 1,000 USDC YES. (Odds at entry: 1.0x)
        // Wait, let's make it so Alice stakes 1,000 YES.
        // Then Bob stakes 1,000 NO. (Pool is now 2,000, YES odds is 2.0x, NO odds is 2.0x).
        // Let's verify:
        vm.startPrank(alice);
        usdc.approve(address(pm), 1_010 * 1e6);
        pm.stakeYes(1_000 * 1e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(pm), 1_010 * 1e6);
        pm.stakeNo(1_000 * 1e6);
        vm.stopPrank();

        // Warp past end time
        vm.warp(block.timestamp + 11 days);

        // Resolve market as YES
        vm.prank(resolver);
        resolutionManager.resolveMarket(mAddress, true);

        // Alice claims payout.
        // Stake = 1,000 USDC. Odds at entry = 1.0x (since she was first, pool YES was 1,000 and total was 1,000, odds = 1.0x).
        // Wait! Let's check: payoutBeforeFee = stake * odds = 1,000 * 1.0x = 1,000 USDC.
        // Fee = 1,000 * 1% = 10 USDC. Alice receives 990 USDC.
        uint256 balBefore = usdc.balanceOf(alice);
        resolutionManager.claimPayout(mAddress, 1); // Alice's position is ID 1
        uint256 balAfter = usdc.balanceOf(alice);

        assertEq(balAfter - balBefore, 990 * 1e6);

        // Check leaderboard stats for Alice.
        // totalPredictions = 1, correct = 1, volume = 1,000.
        (uint256 totalPred, uint256 correctPred, uint256 vol) = leaderboard.userStats(alice);
        assertEq(totalPred, 1);
        assertEq(correctPred, 1);
        assertEq(vol, 1_000 * 1e6);
        assertEq(leaderboard.getAccuracy(alice), 100);
    }

    // ==========================================
    // Reselling Marketplace tests
    // ==========================================
    function testResellingMarketplace() public {
        vm.startPrank(creator);
        address mAddress = factory.createMarket("Will ETH hit $10k in 2026?", block.timestamp + 10 days, 100 * 1e6, address(usdc));
        vm.stopPrank();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(mAddress);

        // Alice stakes 1,000 YES
        vm.startPrank(alice);
        usdc.approve(address(pm), 1_010 * 1e6);
        pm.stakeYes(1_000 * 1e6); // position ID 1

        // Alice lists her position on marketplace for 1,200 USDC
        uint256 listingId = marketplace.listPosition(mAddress, 1, 1_200 * 1e6);
        vm.stopPrank();

        // Bob buys Alice's position
        // Price = 1,200 USDC. 1% fee = 12 USDC. Alice receives 1,188 USDC. Bob pays 1,200 USDC.
        vm.startPrank(bob);
        usdc.approve(address(marketplace), 1_200 * 1e6);
        
        uint256 aliceBalBefore = usdc.balanceOf(alice);
        marketplace.buyPosition(listingId);
        uint256 aliceBalAfter = usdc.balanceOf(alice);
        vm.stopPrank();

        // Check Alice received the sale price minus fee
        assertEq(aliceBalAfter - aliceBalBefore, 1_188 * 1e6);

        // Check position owner in the market contract is now Bob
        PredictionMarketUpgradeable.Position memory pos = pm.getPosition(1);
        assertEq(pos.owner, bob);
    }

    // ==========================================
    // Leaderboard & Fee Rewards tests
    // ==========================================
    function testLeaderboardRewards() public {
        // Let's configure stats for Alice (total = 10, correct = 10, vol = 10,000)
        // Since we need to update user stats, we prank as resolutionManager
        vm.startPrank(address(resolutionManager));
        for (uint256 i = 0; i < 10; i++) {
            leaderboard.updateUserStats(alice, true, 1_000 * 1e6);
        }
        vm.stopPrank();

        assertEq(leaderboard.getAccuracy(alice), 100);

        // Top users array (only Alice)
        address[] memory topUsers = new address[](1);
        topUsers[0] = alice;

        // Operator distributes rewards. Total reward pool = 1,000 USDC.
        // Since Alice is 1st, she gets 20% (200 USDC).
        // The remaining 800 USDC goes back to FeeTreasury.
        usdc.mint(operator, 1_000 * 1e6);
        vm.startPrank(operator);
        usdc.approve(address(leaderboard), 1_000 * 1e6);
        leaderboard.distributeRewards(address(usdc), 1_000 * 1e6, topUsers);
        vm.stopPrank();

        // Check claimable reward for Alice
        assertEq(leaderboard.claimableRewards(alice, address(usdc)), 200 * 1e6);

        // Alice claims reward
        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        leaderboard.claimReward(address(usdc));
        uint256 balAfter = usdc.balanceOf(alice);

        assertEq(balAfter - balBefore, 200 * 1e6);
    }

    // ==========================================
    // Additional Edge Case & Revert Tests
    // ==========================================

    function testFeeTreasuryEdgeCases() public {
        // Only admin can withdraw fee
        usdc.mint(address(feeTreasury), 5_000 * 1e6);
        
        vm.prank(operator);
        vm.expectRevert(); // should fail for operator
        feeTreasury.withdrawFee(address(usdc), operator, 1_000 * 1e6);

        uint256 balBefore = usdc.balanceOf(charlie);
        vm.prank(admin);
        feeTreasury.withdrawFee(address(usdc), charlie, 1_000 * 1e6);
        uint256 balAfter = usdc.balanceOf(charlie);

        assertEq(balAfter - balBefore, 1_000 * 1e6);
        
        // Deposit some fee to test daily/weekly queries
        usdc.mint(address(this), 500 * 1e6);
        usdc.approve(address(feeTreasury), 500 * 1e6);
        feeTreasury.depositFee(address(usdc), 500 * 1e6, "test");

        // Check daily/weekly queries
        uint256 currentDay = block.timestamp / 1 days;
        uint256 currentWeek = block.timestamp / 7 days;
        assertTrue(feeTreasury.getDailyRevenue(address(usdc), currentDay) >= 500 * 1e6);
        assertTrue(feeTreasury.getWeeklyRevenue(address(usdc), currentWeek) >= 500 * 1e6);
    }

    function testVerificationRegistryEdgeCases() public {
        address unverifiedImpl = address(0x999);
        
        // Operator/Admin check on markVerified
        vm.prank(alice);
        vm.expectRevert(); // OnlyAdminOrOperator
        verificationRegistry.markVerified(unverifiedImpl, true);

        // Mark current implementation as unverified
        vm.prank(admin);
        verificationRegistry.markVerified(address(pmImplementation), false);

        // Factory rejects unverified implementation
        vm.prank(creator);
        vm.expectRevert(IPredictionMarketFactoryUpgradeable.ImplementationNotVerified.selector);
        factory.createMarket("Will ETH hit $10k?", block.timestamp + 10 days, 100 * 1e6, address(usdc));

        // Restore verification
        vm.prank(admin);
        verificationRegistry.markVerified(address(pmImplementation), true);
    }

    function testSXUAEdgeCases() public {
        // Deposit unsupported token
        MockERC20 badToken = new MockERC20("Bad Token", "BAD");
        badToken.mint(alice, 1_000 * 1e18);

        vm.startPrank(alice);
        badToken.approve(address(sxua), 100 * 1e18);
        vm.expectRevert(ISXUAUpgradeable.InvalidToken.selector);
        sxua.deposit(address(badToken), 100 * 1e18, 50);

        // Withdraw more than uncommitted balance
        usdc.approve(address(sxua), 1_000 * 1e6);
        sxua.deposit(address(usdc), 1_000 * 1e6, 100); // 100% committed
        
        vm.expectRevert(ISXUAUpgradeable.InsufficientBalance.selector);
        sxua.withdrawUncommitted(address(usdc), 100 * 1e6);
        vm.stopPrank();
    }

    function testPredictionMarketEdgeCases() public {
        vm.startPrank(creator);
        address mAddress = factory.createMarket("Will ETH hit $10k in 2026?", block.timestamp + 10 days, 100 * 1e6, address(usdc));
        vm.stopPrank();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(mAddress);

        // Stake under minimum stake
        vm.startPrank(alice);
        usdc.approve(address(pm), 100 * 1e6);
        vm.expectRevert(IPredictionMarketUpgradeable.InvalidAmount.selector);
        pm.stakeYes(50 * 1e6); // minimum is 100
        vm.stopPrank();

        // Stake on closed market
        vm.warp(block.timestamp + 11 days);
        vm.startPrank(alice);
        usdc.approve(address(pm), 200 * 1e6);
        vm.expectRevert(IPredictionMarketUpgradeable.MarketClosed.selector);
        pm.stakeYes(100 * 1e6);
        vm.stopPrank();

        // Double resolution check
        vm.prank(resolver);
        resolutionManager.resolveMarket(mAddress, true);

        vm.prank(resolver);
        vm.expectRevert(IPredictionMarketUpgradeable.MarketAlreadyResolved.selector);
        pm.resolve(true);
    }

    function testResellingMarketplaceEdgeCases() public {
        vm.startPrank(creator);
        address mAddress = factory.createMarket("Will ETH hit $10k in 2026?", block.timestamp + 10 days, 100 * 1e6, address(usdc));
        vm.stopPrank();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(mAddress);

        vm.startPrank(alice);
        usdc.approve(address(pm), 1_010 * 1e6);
        pm.stakeYes(1_000 * 1e6); // position ID 1
        vm.stopPrank();

        // List position not owned
        vm.startPrank(bob);
        vm.expectRevert(IResellingMarketplaceUpgradeable.PositionNotOwned.selector);
        marketplace.listPosition(mAddress, 1, 500 * 1e6);
        vm.stopPrank();

        // Cancel listing by non-seller
        vm.prank(alice);
        uint256 listingId = marketplace.listPosition(mAddress, 1, 1_200 * 1e6);

        vm.prank(bob);
        vm.expectRevert(IResellingMarketplaceUpgradeable.OnlySeller.selector);
        marketplace.cancelListing(listingId);

        // Buy inactive / canceled listing
        vm.prank(alice);
        marketplace.cancelListing(listingId);

        vm.startPrank(bob);
        usdc.approve(address(marketplace), 1_200 * 1e6);
        vm.expectRevert(IResellingMarketplaceUpgradeable.ListingNotActive.selector);
        marketplace.buyPosition(listingId);
        vm.stopPrank();
    }

    function testLeaderboardValidationErrors() public {
        // Attempt distribution with less than 10 predictions
        vm.startPrank(address(resolutionManager));
        leaderboard.updateUserStats(alice, true, 1_000 * 1e6); // only 1 prediction
        vm.stopPrank();

        address[] memory topUsers = new address[](1);
        topUsers[0] = alice;

        usdc.mint(operator, 100 * 1e6);
        vm.startPrank(operator);
        usdc.approve(address(leaderboard), 100 * 1e6);
        vm.expectRevert(ILeaderboardUpgradeable.InsufficientPredictions.selector);
        leaderboard.distributeRewards(address(usdc), 100 * 1e6, topUsers);
        vm.stopPrank();

        // Attempt distribution with duplicate users
        // Give Bob 10 predictions first
        vm.startPrank(address(resolutionManager));
        for (uint256 i = 0; i < 10; i++) {
            leaderboard.updateUserStats(bob, true, 100 * 1e6);
        }
        vm.stopPrank();

        address[] memory dupUsers = new address[](2);
        dupUsers[0] = bob;
        dupUsers[1] = bob;

        usdc.mint(operator, 100 * 1e6);
        vm.startPrank(operator);
        usdc.approve(address(leaderboard), 100 * 1e6);
        vm.expectRevert(ILeaderboardUpgradeable.DuplicateUser.selector);
        leaderboard.distributeRewards(address(usdc), 100 * 1e6, dupUsers);
        vm.stopPrank();
    }

    function testPausableCoreContracts() public {
        // Pause leaderboard
        vm.prank(operator);
        leaderboard.pause();

        vm.startPrank(address(resolutionManager));
        vm.expectRevert(); // EnforcedPause
        leaderboard.updateUserStats(alice, true, 100 * 1e6);
        vm.stopPrank();

        // Pause Unified Account
        vm.prank(admin);
        sxua.pause();

        vm.startPrank(alice);
        usdc.approve(address(sxua), 100 * 1e6);
        vm.expectRevert(); // EnforcedPause
        sxua.deposit(address(usdc), 100 * 1e6, 0);
        vm.stopPrank();
    }
}

