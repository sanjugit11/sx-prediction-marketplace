// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/IPredictionMarketUpgradeable.sol";
import "../SXAccessControlUpgradeable.sol";
import "../FeeTreasuryUpgradeable.sol";

// This is a deliberately unverified and flawed implementation for the Formal Verification Demo.
// It lacks reentrancy guards in claim() and allows anyone to change the resolution outcome.
contract PredictionMarketUnverified is Initializable, IPredictionMarketUpgradeable {
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

    address public resellingMarketplace;
    uint256 public nextPositionId;

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) private _userPositions;

    bool public resolved;
    bool public winningOutcome;

    address public resolutionManager;
    address public factory;

    // FLAW: Anyone can resolve the market!
    modifier onlyResolverOrAdmin() {
        _; // Missing access control checks!
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
        resellingMarketplace = _resellingMarketplace;
    }

    function setResolutionManager(address _resolutionManager) external {
        resolutionManager = _resolutionManager;
    }

    function stakeYes(uint256 amount) external override {
        // Missing ReentrancyGuard, Missing Pausable, Missing time check
        uint256 fee = amount / 100;
        uint256 totalAmount = amount + fee;

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), totalAmount);

        if (fee > 0) {
            IERC20(collateralToken).safeIncreaseAllowance(address(feeTreasury), fee);
            feeTreasury.depositFee(collateralToken, fee, "staking");
        }

        yesPool += amount;
        totalPool += amount;
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

    function stakeNo(uint256 amount) external override {
        // Missing checks
        uint256 fee = amount / 100;
        uint256 totalAmount = amount + fee;

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), totalAmount);

        if (fee > 0) {
            IERC20(collateralToken).safeIncreaseAllowance(address(feeTreasury), fee);
            feeTreasury.depositFee(collateralToken, fee, "staking");
        }

        noPool += amount;
        totalPool += amount;
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
        resolved = true;
        winningOutcome = winner;
        emit MarketResolved(winner);
    }

    function claim(uint256 positionId) external override onlyResolverOrAdmin returns (uint256 payoutAmount, uint256 fee) {
        Position storage pos = positions[positionId];
        // FLAW: Missing checks for claimed, allowing reentrancy/double claim!
        
        if (pos.outcome == winningOutcome) {
            uint256 payoutBeforeFee = (pos.amount * pos.oddsAtEntry) / 1e18;
            fee = payoutBeforeFee / 100;
            payoutAmount = payoutBeforeFee - fee;

            IERC20(collateralToken).safeTransfer(pos.owner, payoutAmount);
            if (fee > 0) {
                IERC20(collateralToken).safeIncreaseAllowance(address(feeTreasury), fee);
                feeTreasury.depositFee(collateralToken, fee, "payout");
            }
        }
        
        // FLAW: State update after external call (Reentrancy vulnerability)
        pos.claimed = true;
    }

    function transferPosition(uint256 positionId, address newOwner) external override onlyResellingMarketplace {
        Position storage pos = positions[positionId];
        address oldOwner = pos.owner;
        pos.owner = newOwner;

        uint256[] storage oldList = _userPositions[oldOwner];
        for (uint256 i = 0; i < oldList.length; i++) {
            if (oldList[i] == positionId) {
                oldList[i] = oldList[oldList.length - 1];
                oldList.pop();
                break;
            }
        }
        _userPositions[newOwner].push(positionId);
    }

    function getOdds(bool outcome) public view override returns (uint256) {
        if (outcome) {
            if (yesPool == 0) return 2 * 1e18;
            return (totalPool * 1e18) / yesPool;
        } else {
            if (noPool == 0) return 2 * 1e18;
            return (totalPool * 1e18) / noPool;
        }
    }

    function getPosition(uint256 positionId) external view override returns (Position memory) {
        return positions[positionId];
    }

    function getPools() external view override returns (uint256, uint256, uint256) {
        return (yesPool, noPool, totalPool);
    }
}
