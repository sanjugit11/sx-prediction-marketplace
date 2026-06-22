// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IFeeTreasuryUpgradeable {
    event FeeDeposited(address indexed token, address indexed source, uint256 amount, string feeType);
    event FeeWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    error OnlyAdmin();
    error InvalidAmount();
    error InvalidAddress();
    error TransferFailed();

    function depositFee(address token, uint256 amount, string calldata feeType) external;
    function withdrawFee(address token, address to, uint256 amount) external;
    
    function getTotalRevenue(address token) external view returns (uint256);
    function getDailyRevenue(address token, uint256 day) external view returns (uint256);
    function getWeeklyRevenue(address token, uint256 week) external view returns (uint256);
}
