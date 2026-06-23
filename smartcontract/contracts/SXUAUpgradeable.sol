// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ISXUAUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";
import "./FeeTreasuryUpgradeable.sol";

contract SXUAUpgradeable is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable, ISXUAUpgradeable {
    using SafeERC20 for IERC20;

    SXAccessControlUpgradeable public accessControl;
    FeeTreasuryUpgradeable public feeTreasury;

    uint256 public nextSubAccountId;

    // Supported tokens map
    mapping(address => bool) public isSupportedToken;
    address[] public supportedTokensList;

    // User uncommitted balances: user => token => amount
    mapping(address => mapping(address => uint256)) private _uncommittedBalances;

    // Sub-accounts mapping: id => SubAccount
    mapping(uint256 => SubAccount) public subAccounts;

    // User sub-account IDs: user => list of ids
    mapping(address => uint256[]) private _userSubAccounts;

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) revert OnlyAdmin();
        _;
    }

    error OnlyAdmin();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address accessControlAddress,
        address feeTreasuryAddress,
        address[] calldata initialTokens
    ) external initializer {
        if (accessControlAddress == address(0) || feeTreasuryAddress == address(0)) revert InvalidToken();
        __ReentrancyGuard_init();
        __Pausable_init();

        accessControl = SXAccessControlUpgradeable(accessControlAddress);
        feeTreasury = FeeTreasuryUpgradeable(feeTreasuryAddress);

        for (uint256 i = 0; i < initialTokens.length; i++) {
            if (initialTokens[i] == address(0)) revert InvalidToken();
            isSupportedToken[initialTokens[i]] = true;
            supportedTokensList.push(initialTokens[i]);
        }
        nextSubAccountId = 1;
    }

    function addSupportedToken(address token) external onlyAdmin {
        if (token == address(0)) revert InvalidToken();
        if (!isSupportedToken[token]) {
            isSupportedToken[token] = true;
            supportedTokensList.push(token);
        }
    }

    function removeSupportedToken(address token) external onlyAdmin {
        if (isSupportedToken[token]) {
            isSupportedToken[token] = false;
            // Note: In production, we would clean up the array or keep it for history
        }
    }

    function deposit(address token, uint256 amount, uint256 committedPercentage) external override nonReentrant whenNotPaused {
        if (!isSupportedToken[token]) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (committedPercentage > 100) revert InvalidPercentage();

        uint256 committedAmount = (amount * committedPercentage) / 100;
        uint256 uncommittedAmount = amount - committedAmount;

        // Transfer funds from user to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        if (uncommittedAmount > 0) {
            _uncommittedBalances[msg.sender][token] += uncommittedAmount;
        }

        if (committedAmount > 0) {
            uint256 subAccountId = nextSubAccountId++;
            uint256 createdAt = block.timestamp;
            uint256 maturityDate = createdAt + 5 minutes;

            subAccounts[subAccountId] = SubAccount({
                id: subAccountId,
                token: token,
                owner: msg.sender,
                principal: committedAmount,
                createdAt: createdAt,
                maturityDate: maturityDate,
                accruedYield: 0,
                withdrawn: false
            });

            _userSubAccounts[msg.sender].push(subAccountId);

            emit SubAccountCreated(subAccountId, msg.sender, token, committedAmount, maturityDate);
        }

        emit Deposited(msg.sender, token, amount, committedAmount, uncommittedAmount);
    }

    function withdrawUncommitted(address token, uint256 amount) external override nonReentrant whenNotPaused {
        if (!isSupportedToken[token]) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (_uncommittedBalances[msg.sender][token] < amount) revert InsufficientBalance();

        _uncommittedBalances[msg.sender][token] -= amount;

        // Apply 6% fee
        uint256 fee = (amount * 6) / 100;
        uint256 payout = amount - fee;

        // Send fee to FeeTreasury
        if (fee > 0) {
            IERC20(token).safeIncreaseAllowance(address(feeTreasury), fee);
            feeTreasury.depositFee(token, fee, "withdrawal");
        }

        // Send payout to user
        IERC20(token).safeTransfer(msg.sender, payout);

        emit Withdrawn(msg.sender, token, amount, fee, false, 0);
    }

    function withdrawCommitted(uint256 subAccountId) external override nonReentrant whenNotPaused {
        SubAccount storage subAcc = subAccounts[subAccountId];
        if (subAcc.owner != msg.sender) revert SubAccountNotFound();
        if (subAcc.withdrawn) revert AlreadyWithdrawn();

        subAcc.withdrawn = true;
        address token = subAcc.token;
        uint256 principal = subAcc.principal;
        uint256 payoutAmount;
        uint256 fee;

        if (block.timestamp < subAcc.maturityDate) {
            // Forfeit yield, receive principal minus 6% fee
            fee = (principal * 6) / 100;
            payoutAmount = principal - fee;
        } else {
            // Receive principal + yield minus 6% fee
            uint256 yield = _calculateYield(subAcc);
            subAcc.accruedYield = yield;
            uint256 total = principal + yield;
            fee = (total * 6) / 100;
            payoutAmount = total - fee;
        }

        // Send fee to FeeTreasury
        if (fee > 0) {
            IERC20(token).safeIncreaseAllowance(address(feeTreasury), fee);
            feeTreasury.depositFee(token, fee, "withdrawal");
        }

        // Send payout to user
        IERC20(token).safeTransfer(msg.sender, payoutAmount);

        emit Withdrawn(msg.sender, token, principal, fee, true, subAccountId);
    }

    function _calculateYield(SubAccount memory subAcc) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - subAcc.createdAt;
        uint256 simulatedDaysBasis;
        if (elapsed <= 30) {
            simulatedDaysBasis = (elapsed * 10000) / 21;
        } else if (elapsed < 300) {
            simulatedDaysBasis = 14285 + (elapsed - 30) * 3650;
        } else {
            simulatedDaysBasis = 1000000 + ((elapsed - 300) * 10000) / 30;
        }
        return (subAcc.principal * 12 * simulatedDaysBasis) / 100000000;
    }

    function getUnifiedBalance(address user, address token) external view override returns (uint256) {
        return _uncommittedBalances[user][token] + getCommittedBalances(user, token);
    }

    function getCommittedBalances(address user, address token) public view override returns (uint256) {
        uint256 totalCommitted = 0;
        uint256[] memory ids = _userSubAccounts[user];
        for (uint256 i = 0; i < ids.length; i++) {
            SubAccount memory subAcc = subAccounts[ids[i]];
            if (subAcc.token == token && !subAcc.withdrawn) {
                totalCommitted += subAcc.principal;
            }
        }
        return totalCommitted;
    }

    function getUncommittedBalance(address user, address token) external view override returns (uint256) {
        return _uncommittedBalances[user][token];
    }

    function getAccruedYield(address user, uint256 subAccountId) external view override returns (uint256) {
        SubAccount memory subAcc = subAccounts[subAccountId];
        if (subAcc.owner != user || subAcc.withdrawn) return 0;
        return _calculateYield(subAcc);
    }

    function getUserSubAccounts(address user) external view returns (uint256[] memory) {
        return _userSubAccounts[user];
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }
}
