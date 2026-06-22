// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPredictionMarketUpgradeable {
    struct Position {
        uint256 id;
        address owner;
        bool outcome; // true for YES, false for NO
        uint256 amount;
        uint256 oddsAtEntry; // scaled by 1e18
        uint256 createdAt;
        bool claimed;
    }

    event Staked(address indexed user, bool indexed outcome, uint256 amount, uint256 odds, uint256 positionId);
    event MarketResolved(bool indexed winner);

    error InvalidAmount();
    error MarketClosed();
    error MarketNotClosed();
    error MarketAlreadyResolved();
    error AlreadyClaimed();
    error PositionNotFound();
    error OnlyResolverOrAdmin();
    error InvalidAddress();
    error InvalidOdds();
    error ZeroPool();

    function initialize(
        string calldata question,
        uint256 endTime,
        uint256 minimumStake,
        address collateralToken,
        address accessControlAddress,
        address feeTreasuryAddress
    ) external;

    function stakeYes(uint256 amount) external;
    function stakeNo(uint256 amount) external;
    
    function resolve(bool winner) external;
    function claim(uint256 positionId) external returns (uint256 payoutAmount, uint256 fee);

    function getOdds(bool outcome) external view returns (uint256);
    function getPosition(uint256 positionId) external view returns (Position memory);
    function getPools() external view returns (uint256 yesPool, uint256 noPool, uint256 totalPool);
    
    // Position transferring for reselling marketplace
    function transferPosition(uint256 positionId, address newOwner) external;
}
