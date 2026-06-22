// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../contracts/SXAccessControlUpgradeable.sol";
import "../../contracts/FeeTreasuryUpgradeable.sol";
import "../../contracts/VerificationRegistryUpgradeable.sol";
import "../../contracts/SXUAUpgradeable.sol";
import "../../contracts/PredictionMarketUpgradeable.sol";
import "../../contracts/PredictionMarketFactoryUpgradeable.sol";
import "../../contracts/ResolutionManagerUpgradeable.sol";
import "../../contracts/LeaderboardUpgradeable.sol";
import "../../contracts/ResellingMarketplaceUpgradeable.sol";
import "../../contracts/mocks/MockERC20.sol";

contract Handler is Test {
    PredictionMarketUpgradeable public pm;
    MockERC20 public usdc;

    constructor(address _pm, address _usdc) {
        pm = PredictionMarketUpgradeable(_pm);
        usdc = MockERC20(_usdc);
    }

    function stakeYes(uint256 amount) public {
        // Bound amount between min stake (10 USDC) and 100k USDC
        amount = bound(amount, 10 * 1e6, 100_000 * 1e6);
        usdc.mint(address(this), amount * 2);
        usdc.approve(address(pm), amount * 2);
        
        try pm.stakeYes(amount) {} catch {}
    }

    function stakeNo(uint256 amount) public {
        amount = bound(amount, 10 * 1e6, 100_000 * 1e6);
        usdc.mint(address(this), amount * 2);
        usdc.approve(address(pm), amount * 2);
        
        try pm.stakeNo(amount) {} catch {}
    }
}

contract SXMarketplaceInvariantTest is Test {
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
    address pmAddress;
    PredictionMarketUpgradeable pm;
    Handler handler;

    address admin = address(0xAD);
    address creator = address(0x03);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC");

        // Deploy Access Control
        SXAccessControlUpgradeable acImpl = new SXAccessControlUpgradeable();
        ERC1967Proxy acProxy = new ERC1967Proxy(
            address(acImpl),
            abi.encodeWithSelector(SXAccessControlUpgradeable.initialize.selector, admin)
        );
        accessControl = SXAccessControlUpgradeable(address(acProxy));

        // Grant Roles
        vm.startPrank(admin);
        accessControl.grantRole(accessControl.MARKET_CREATOR_ROLE(), creator);
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

        // Deploy SXUA
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        SXUAUpgradeable sxuaImpl = new SXUAUpgradeable();
        ERC1967Proxy sxuaProxy = new ERC1967Proxy(
            address(sxuaImpl),
            abi.encodeWithSelector(SXUAUpgradeable.initialize.selector, address(accessControl), address(feeTreasury), tokens)
        );
        sxua = SXUAUpgradeable(address(sxuaProxy));

        // Deploy implementation
        pmImplementation = new PredictionMarketUpgradeable();
        vm.prank(admin);
        verificationRegistry.markVerified(address(pmImplementation), true);

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

        // Configure references
        vm.prank(admin);
        leaderboard.setResolutionManager(address(resolutionManager));
        vm.prank(admin);
        factory.setProtocolAddresses(address(resolutionManager), address(marketplace));

        // Deploy one test market that we will target with random stakes (minimum stake 10 USDC)
        vm.prank(creator);
        pmAddress = factory.createMarket("Invariant Target Market", block.timestamp + 10 days, 10 * 1e6, address(usdc));
        pm = PredictionMarketUpgradeable(pmAddress);

        // Deploy handler and target it
        handler = new Handler(address(pm), address(usdc));
        targetContract(address(handler));
    }

    /// @dev Invariant: yesPool + noPool must always equal totalPool
    function invariant_poolSolvency() public view {
        (uint256 yesPool, uint256 noPool, uint256 totalPool) = pm.getPools();
        assertEq(yesPool + noPool, totalPool);
    }
}
