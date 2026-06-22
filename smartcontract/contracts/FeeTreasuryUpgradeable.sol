// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFeeTreasuryUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";

contract FeeTreasuryUpgradeable is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable, IFeeTreasuryUpgradeable {
    using SafeERC20 for IERC20;

    SXAccessControlUpgradeable public accessControl;

    // Revenue Tracking
    mapping(address => uint256) private _totalRevenue;
    mapping(address => mapping(uint256 => uint256)) private _dailyRevenue; // token => day => amount
    mapping(address => mapping(uint256 => uint256)) private _weeklyRevenue; // token => week => amount

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) revert OnlyAdmin();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address accessControlAddress) external initializer {
        if (accessControlAddress == address(0)) revert InvalidAddress();
        __ReentrancyGuard_init();
        __Pausable_init();
        accessControl = SXAccessControlUpgradeable(accessControlAddress);
    }

    function depositFee(address token, uint256 amount, string calldata feeType) external override nonReentrant whenNotPaused {
        if (token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 currentDay = block.timestamp / 1 days;
        uint256 currentWeek = block.timestamp / 7 days;

        _totalRevenue[token] += amount;
        _dailyRevenue[token][currentDay] += amount;
        _weeklyRevenue[token][currentWeek] += amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit FeeDeposited(token, msg.sender, amount, feeType);
    }

    function withdrawFee(address token, address to, uint256 amount) external override onlyAdmin nonReentrant {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > IERC20(token).balanceOf(address(this))) revert InvalidAmount();

        IERC20(token).safeTransfer(to, amount);

        emit FeeWithdrawn(token, to, amount);
    }

    function getTotalRevenue(address token) external view override returns (uint256) {
        return _totalRevenue[token];
    }

    function getDailyRevenue(address token, uint256 day) external view override returns (uint256) {
        return _dailyRevenue[token][day];
    }

    function getWeeklyRevenue(address token, uint256 week) external view override returns (uint256) {
        return _weeklyRevenue[token][week];
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }
}
