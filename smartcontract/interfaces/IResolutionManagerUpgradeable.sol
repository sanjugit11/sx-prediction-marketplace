// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IResolutionManagerUpgradeable {
    event MarketResolved(address indexed market, bool indexed winner);
    event PayoutClaimed(address indexed market, address indexed user, uint256 indexed positionId, uint256 payoutAmount, uint256 fee);

    error OnlyResolverOrAdmin();
    error InvalidAddress();
    error AlreadyClaimed();

    function resolveMarket(address market, bool winner) external;
    function claimPayout(address market, uint256 positionId) external;
}
