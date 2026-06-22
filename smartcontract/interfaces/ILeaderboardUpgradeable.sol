// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILeaderboardUpgradeable {
    struct UserStats {
        uint256 totalPredictions;
        uint256 correctPredictions;
        uint256 totalVolume;
    }

    event RewardsDistributed(address indexed token, uint256 totalPool, address[] topUsers);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event UserStatsUpdated(address indexed user, uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume);

    error OnlyOperatorOrAdmin();
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientPredictions();
    error DuplicateUser();
    error RewardsMismatch();
    error NoRewardToClaim();
    error TransferFailed();

    function updateUserStats(address user, bool correct, uint256 volume) external;
    function distributeRewards(address token, uint256 totalPool, address[] calldata topUsers) external;
    function claimReward(address token) external;

    function getUserStats(address user) external view returns (UserStats memory);
    function getAccuracy(address user) external view returns (uint256);
}
