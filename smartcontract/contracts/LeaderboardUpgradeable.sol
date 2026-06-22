// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ILeaderboardUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";
import "./FeeTreasuryUpgradeable.sol";

contract LeaderboardUpgradeable is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable, ILeaderboardUpgradeable {
    using SafeERC20 for IERC20;

    SXAccessControlUpgradeable public accessControl;
    FeeTreasuryUpgradeable public feeTreasury;

    mapping(address => UserStats) public userStats;
    address[] public allUsers;
    mapping(address => bool) private _isUserRegistered;

    // claimableRewards: user => token => amount
    mapping(address => mapping(address => uint256)) public claimableRewards;

    // Authorized callers for updating stats
    address public resolutionManager;

    modifier onlyOperatorOrAdmin() {
        if (!accessControl.hasRole(accessControl.OPERATOR_ROLE(), msg.sender) &&
            !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            revert OnlyOperatorOrAdmin();
        }
        _;
    }

    modifier onlyAuthorizedUpdater() {
        if (msg.sender != resolutionManager &&
            !accessControl.hasRole(accessControl.OPERATOR_ROLE(), msg.sender) &&
            !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            revert OnlyOperatorOrAdmin();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _accessControlAddress, address _feeTreasuryAddress) external initializer {
        if (_accessControlAddress == address(0) || _feeTreasuryAddress == address(0)) revert InvalidAddress();
        __ReentrancyGuard_init();
        __Pausable_init();

        accessControl = SXAccessControlUpgradeable(_accessControlAddress);
        feeTreasury = FeeTreasuryUpgradeable(_feeTreasuryAddress);
    }

    function setResolutionManager(address _resolutionManager) external onlyOperatorOrAdmin {
        if (_resolutionManager == address(0)) revert InvalidAddress();
        resolutionManager = _resolutionManager;
    }

    function updateUserStats(address user, bool correct, uint256 volume) external override onlyAuthorizedUpdater whenNotPaused {
        if (user == address(0)) revert InvalidAddress();

        if (!_isUserRegistered[user]) {
            _isUserRegistered[user] = true;
            allUsers.push(user);
        }

        UserStats storage stats = userStats[user];
        stats.totalPredictions += 1;
        if (correct) {
            stats.correctPredictions += 1;
        }
        stats.totalVolume += volume;

        emit UserStatsUpdated(user, stats.totalPredictions, stats.correctPredictions, stats.totalVolume);
    }

    function distributeRewards(address token, uint256 totalPool, address[] calldata topUsers) external override onlyOperatorOrAdmin nonReentrant whenNotPaused {
        if (token == address(0)) revert InvalidAddress();
        if (totalPool == 0) revert InvalidAmount();
        if (topUsers.length == 0 || topUsers.length > 10) revert InvalidAmount();

        // Pull the reward pool from the FeeTreasury or msg.sender (for simplicity we transfer from msg.sender or assume it is pre-funded)
        // Let's transfer the totalPool from FeeTreasury to this contract
        // Since we need to pull from FeeTreasury, the admin/operator must have authorized this, or we withdraw it.
        // We will call feeTreasury.withdrawFee(token, address(this), totalPool)
        // Note: For this to work, the Leaderboard contract must have the DEFAULT_ADMIN_ROLE or FeeTreasury must allow the withdraw.
        // To be safe, we can transfer from FeeTreasury using withdrawFee by the admin.
        // Let's assume the pool is already transferred to this contract by the caller (msg.sender) or FeeTreasury.
        // So we transfer from msg.sender to this contract.
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalPool);

        uint256 allocated = 0;
        uint256 len = topUsers.length;

        // Verify duplicates and minimum predictions
        for (uint256 i = 0; i < len; i++) {
            address user = topUsers[i];
            if (user == address(0)) revert InvalidAddress();
            if (userStats[user].totalPredictions < 10) revert InsufficientPredictions();

            for (uint256 j = i + 1; j < len; j++) {
                if (topUsers[j] == user) revert DuplicateUser();
            }

            uint256 rewardAmount = 0;
            if (i == 0) {
                rewardAmount = (totalPool * 20) / 100; // 20%
            } else if (i == 1) {
                rewardAmount = (totalPool * 15) / 100; // 15%
            } else if (i == 2) {
                rewardAmount = (totalPool * 10) / 100; // 10%
            } else {
                rewardAmount = (totalPool * 5) / 100;  // 5%
            }

            claimableRewards[user][token] += rewardAmount;
            allocated += rewardAmount;
        }

        // Send remaining to FeeTreasury (includes the 20% protocol share + any unfilled ranks)
        uint256 remainder = totalPool - allocated;
        if (remainder > 0) {
            IERC20(token).safeIncreaseAllowance(address(feeTreasury), remainder);
            feeTreasury.depositFee(token, remainder, "leaderboard_reserve");
        }

        emit RewardsDistributed(token, totalPool, topUsers);
    }

    function claimReward(address token) external override nonReentrant whenNotPaused {
        if (token == address(0)) revert InvalidAddress();
        uint256 amount = claimableRewards[msg.sender][token];
        if (amount == 0) revert NoRewardToClaim();

        claimableRewards[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, token, amount);
    }

    function getUserStats(address user) external view override returns (UserStats memory) {
        return userStats[user];
    }

    function getAccuracy(address user) public view override returns (uint256) {
        UserStats memory stats = userStats[user];
        if (stats.totalPredictions == 0) return 0;
        return (stats.correctPredictions * 100) / stats.totalPredictions;
    }

    function getAllUsers() external view returns (address[] memory) {
        return allUsers;
    }

    function pause() external onlyOperatorOrAdmin {
        _pause();
    }

    function unpause() external onlyOperatorOrAdmin {
        _unpause();
    }
}
