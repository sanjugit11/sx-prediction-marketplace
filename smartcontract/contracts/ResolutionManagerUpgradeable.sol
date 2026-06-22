// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IResolutionManagerUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";
import "./PredictionMarketUpgradeable.sol";
import "./LeaderboardUpgradeable.sol";

contract ResolutionManagerUpgradeable is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable, IResolutionManagerUpgradeable {
    SXAccessControlUpgradeable public accessControl;
    LeaderboardUpgradeable public leaderboard;

    modifier onlyResolverOrAdmin() {
        if (!accessControl.hasRole(accessControl.RESOLVER_ROLE(), msg.sender) &&
            !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            revert OnlyResolverOrAdmin();
        }
        _;
    }

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            revert OnlyResolverOrAdmin();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _accessControlAddress, address _leaderboardAddress) external initializer {
        if (_accessControlAddress == address(0) || _leaderboardAddress == address(0)) revert InvalidAddress();
        __ReentrancyGuard_init();
        __Pausable_init();

        accessControl = SXAccessControlUpgradeable(_accessControlAddress);
        leaderboard = LeaderboardUpgradeable(_leaderboardAddress);
    }

    function resolveMarket(address market, bool winner) external override onlyResolverOrAdmin whenNotPaused {
        if (market == address(0)) revert InvalidAddress();

        PredictionMarketUpgradeable(market).resolve(winner);

        emit MarketResolved(market, winner);
    }

    function claimPayout(address market, uint256 positionId) external override nonReentrant whenNotPaused {
        if (market == address(0)) revert InvalidAddress();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(market);
        
        // Get position details before claiming
        PredictionMarketUpgradeable.Position memory pos = pm.getPosition(positionId);
        
        // Claim the payout (will revert if already claimed or other checks fail)
        (uint256 payoutAmount, uint256 fee) = pm.claim(positionId);

        // Update user stats on the leaderboard
        bool isCorrect = (pos.outcome == pm.winningOutcome());
        leaderboard.updateUserStats(pos.owner, isCorrect, pos.amount);

        emit PayoutClaimed(market, pos.owner, positionId, payoutAmount, fee);
    }

    function pause() external onlyResolverOrAdmin {
        _pause();
    }

    function unpause() external onlyResolverOrAdmin {
        _unpause();
    }
}
