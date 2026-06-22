// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISXUAUpgradeable {
    struct SubAccount {
        uint256 id;
        address token;
        address owner;
        uint256 principal;
        uint256 createdAt;
        uint256 maturityDate;
        uint256 accruedYield;
        bool withdrawn;
    }

    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 committedAmount, uint256 uncommittedAmount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 fee, bool isCommitted, uint256 subAccountId);
    event SubAccountCreated(uint256 indexed id, address indexed owner, address indexed token, uint256 principal, uint256 maturityDate);

    error InvalidToken();
    error InvalidAmount();
    error InvalidPercentage();
    error SubAccountNotFound();
    error AlreadyWithdrawn();
    error InsufficientBalance();
    error TransferFailed();

    function deposit(address token, uint256 amount, uint256 committedPercentage) external;
    function withdrawUncommitted(address token, uint256 amount) external;
    function withdrawCommitted(uint256 subAccountId) external;

    function getUnifiedBalance(address user, address token) external view returns (uint256);
    function getCommittedBalances(address user, address token) external view returns (uint256);
    function getUncommittedBalance(address user, address token) external view returns (uint256);
    function getAccruedYield(address user, uint256 subAccountId) external view returns (uint256);
}
