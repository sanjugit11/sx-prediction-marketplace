// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IPredictionMarketUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";
import "./FeeTreasuryUpgradeable.sol";

contract PredictionMarketUpgradeable is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable, IPredictionMarketUpgradeable {
    using SafeERC20 for IERC20;

    SXAccessControlUpgradeable public accessControl;
    FeeTreasuryUpgradeable public feeTreasury;

    string public question;
    uint256 public endTime;
    uint256 public minimumStake;
    address public collateralToken;

    uint256 public yesPool;
    uint256 public noPool;
    uint256 public totalPool;

    // Reselling marketplace address authorized to transfer positions
    address public resellingMarketplace;

    uint256 public nextPositionId;

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) private _userPositions;

    bool public resolved;
    bool public winningOutcome; // true for YES, false for NO

    // Whitelisted callers for resolution/actions
    address public resolutionManager;
    address public factory;

    modifier onlyResolverOrAdmin() {
        if (msg.sender != resolutionManager) {
            if (!accessControl.hasRole(accessControl.RESOLVER_ROLE(), msg.sender) &&
                !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) {
                revert OnlyResolverOrAdmin();
            }
        }
        _;
    }

    modifier onlyResellingMarketplace() {
        if (msg.sender != resellingMarketplace) revert OnlyResolverOrAdmin();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string calldata _question,
        uint256 _endTime,
        uint256 _minimumStake,
        address _collateralToken,
        address _accessControlAddress,
        address _feeTreasuryAddress
    ) external override initializer {
        if (_endTime <= block.timestamp) revert MarketClosed();
        if (_collateralToken == address(0) || _accessControlAddress == address(0) || _feeTreasuryAddress == address(0)) revert InvalidAddress();

        __ReentrancyGuard_init();
        __Pausable_init();

        question = _question;
        endTime = _endTime;
        minimumStake = _minimumStake;
        collateralToken = _collateralToken;
        accessControl = SXAccessControlUpgradeable(_accessControlAddress);
        feeTreasury = FeeTreasuryUpgradeable(_feeTreasuryAddress);
        nextPositionId = 1;
        factory = msg.sender;
    }

    function setResellingMarketplace(address _resellingMarketplace) external {
        if (msg.sender != factory && !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) revert OnlyResolverOrAdmin();
        if (_resellingMarketplace == address(0)) revert InvalidAddress();
        resellingMarketplace = _resellingMarketplace;
    }

    function setResolutionManager(address _resolutionManager) external {
        if (msg.sender != factory && !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) revert OnlyResolverOrAdmin();
        if (_resolutionManager == address(0)) revert InvalidAddress();
        resolutionManager = _resolutionManager;
    }

    function stakeYes(uint256 amount) external override nonReentrant whenNotPaused {
        if (block.timestamp >= endTime) revert MarketClosed();
        if (amount < minimumStake) revert InvalidAmount();

        uint256 fee = amount / 100; // 1% fee
        uint256 totalAmount = amount + fee;

        // Transfer total amount from caller
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Send fee to FeeTreasury
        if (fee > 0) {
            IERC20(collateralToken).safeIncreaseAllowance(address(feeTreasury), fee);
            feeTreasury.depositFee(collateralToken, fee, "staking");
        }

        // Update pools
        yesPool += amount;
        totalPool += amount;

        // Get odds after pool update
        uint256 odds = getOdds(true);

        uint256 positionId = nextPositionId++;
        positions[positionId] = Position({
            id: positionId,
            owner: msg.sender,
            outcome: true,
            amount: amount,
            oddsAtEntry: odds,
            createdAt: block.timestamp,
            claimed: false
        });

        _userPositions[msg.sender].push(positionId);

        emit Staked(msg.sender, true, amount, odds, positionId);
    }

    function stakeNo(uint256 amount) external override nonReentrant whenNotPaused {
        if (block.timestamp >= endTime) revert MarketClosed();
        if (amount < minimumStake) revert InvalidAmount();

        uint256 fee = amount / 100; // 1% fee
        uint256 totalAmount = amount + fee;

        // Transfer total amount from caller
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Send fee to FeeTreasury
        if (fee > 0) {
            IERC20(collateralToken).safeIncreaseAllowance(address(feeTreasury), fee);
            feeTreasury.depositFee(collateralToken, fee, "staking");
        }

        // Update pools
        noPool += amount;
        totalPool += amount;

        // Get odds after pool update
        uint256 odds = getOdds(false);

        uint256 positionId = nextPositionId++;
        positions[positionId] = Position({
            id: positionId,
            owner: msg.sender,
            outcome: false,
            amount: amount,
            oddsAtEntry: odds,
            createdAt: block.timestamp,
            claimed: false
        });

        _userPositions[msg.sender].push(positionId);

        emit Staked(msg.sender, false, amount, odds, positionId);
    }

    function resolve(bool winner) external override onlyResolverOrAdmin {
        if (block.timestamp < endTime) revert MarketNotClosed();
        if (resolved) revert MarketAlreadyResolved();

        resolved = true;
        winningOutcome = winner;

        emit MarketResolved(winner);
    }

    function claim(uint256 positionId) external override onlyResolverOrAdmin returns (uint256 payoutAmount, uint256 fee) {
        if (!resolved) revert MarketNotClosed();
        Position storage pos = positions[positionId];
        if (pos.owner == address(0)) revert PositionNotFound();
        if (pos.claimed) revert AlreadyClaimed();

        pos.claimed = true;

        if (pos.outcome == winningOutcome) {
            // Payout Formula: stakeAmount * oddsAtEntry (with 18 decimal odds scaling)
            uint256 payoutBeforeFee = (pos.amount * pos.oddsAtEntry) / 1e18;
            fee = payoutBeforeFee / 100; // 1% payout fee
            payoutAmount = payoutBeforeFee - fee;

            // Transfer payout to owner and fee to treasury
            IERC20(collateralToken).safeTransfer(pos.owner, payoutAmount);
            if (fee > 0) {
                IERC20(collateralToken).safeIncreaseAllowance(address(feeTreasury), fee);
                feeTreasury.depositFee(collateralToken, fee, "payout");
            }
        } else {
            payoutAmount = 0;
            fee = 0;
        }
    }

    function transferPosition(uint256 positionId, address newOwner) external override onlyResellingMarketplace {
        Position storage pos = positions[positionId];
        if (pos.owner == address(0)) revert PositionNotFound();
        if (pos.claimed) revert AlreadyClaimed();
        if (newOwner == address(0)) revert InvalidAddress();

        address oldOwner = pos.owner;
        pos.owner = newOwner;

        // Remove from old owner's list
        uint256[] storage oldList = _userPositions[oldOwner];
        for (uint256 i = 0; i < oldList.length; i++) {
            if (oldList[i] == positionId) {
                oldList[i] = oldList[oldList.length - 1];
                oldList.pop();
                break;
            }
        }

        // Add to new owner's list
        _userPositions[newOwner].push(positionId);
    }

    function getOdds(bool outcome) public view override returns (uint256) {
        if (outcome) {
            if (yesPool == 0) return 2 * 1e18; // Default 2.0x
            return (totalPool * 1e18) / yesPool;
        } else {
            if (noPool == 0) return 2 * 1e18; // Default 2.0x
            return (totalPool * 1e18) / noPool;
        }
    }

    function getPosition(uint256 positionId) external view override returns (Position memory) {
        Position memory pos = positions[positionId];
        if (pos.owner == address(0)) revert PositionNotFound();
        return pos;
    }

    function getPools() external view override returns (uint256, uint256, uint256) {
        return (yesPool, noPool, totalPool);
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return _userPositions[user];
    }

    function pause() external onlyResolverOrAdmin {
        _pause();
    }

    function unpause() external onlyResolverOrAdmin {
        _unpause();
    }
}
