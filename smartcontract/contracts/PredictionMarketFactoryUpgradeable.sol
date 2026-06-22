// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IPredictionMarketFactoryUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";
import "./VerificationRegistryUpgradeable.sol";
import "./PredictionMarketUpgradeable.sol";

contract PredictionMarketFactoryUpgradeable is Initializable, PausableUpgradeable, IPredictionMarketFactoryUpgradeable {
    SXAccessControlUpgradeable public accessControl;
    VerificationRegistryUpgradeable public verificationRegistry;
    address public masterMarketImplementation;

    address[] public marketsList;
    mapping(bytes32 => address) public marketByQuestion;

    // References to pass to deployed markets
    address public feeTreasury;
    address public resolutionManager;
    address public resellingMarketplace;

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) revert OnlyAdmin();
        _;
    }

    modifier onlyMarketCreatorOrAdmin() {
        if (!accessControl.hasRole(accessControl.MARKET_CREATOR_ROLE(), msg.sender) &&
            !accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            revert OnlyAdmin();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _accessControlAddress,
        address _verificationRegistry,
        address _masterMarketImplementation,
        address _feeTreasury
    ) external initializer {
        if (_accessControlAddress == address(0) || _verificationRegistry == address(0) || _masterMarketImplementation == address(0) || _feeTreasury == address(0)) {
            revert InvalidAddress();
        }

        __Pausable_init();

        accessControl = SXAccessControlUpgradeable(_accessControlAddress);
        verificationRegistry = VerificationRegistryUpgradeable(_verificationRegistry);
        masterMarketImplementation = _masterMarketImplementation;
        feeTreasury = _feeTreasury;
    }

    function setMasterMarketImplementation(address _masterMarketImplementation) external onlyAdmin {
        if (_masterMarketImplementation == address(0)) revert InvalidAddress();
        masterMarketImplementation = _masterMarketImplementation;
    }

    function setProtocolAddresses(address _resolutionManager, address _resellingMarketplace) external onlyAdmin {
        if (_resolutionManager == address(0) || _resellingMarketplace == address(0)) revert InvalidAddress();
        resolutionManager = _resolutionManager;
        resellingMarketplace = _resellingMarketplace;
    }

    function createMarket(
        string calldata question,
        uint256 endTime,
        uint256 minimumStake,
        address collateralToken
    ) external override onlyMarketCreatorOrAdmin whenNotPaused returns (address) {
        if (endTime <= block.timestamp) revert InvalidEndTime();
        if (collateralToken == address(0)) revert InvalidAddress();
        
        // Gating Check: Implementation must be verified in registry
        if (!verificationRegistry.isVerified(masterMarketImplementation)) revert ImplementationNotVerified();

        bytes32 questionHash = keccak256(abi.encodePacked(question));
        if (marketByQuestion[questionHash] != address(0)) revert QuestionAlreadyExists();

        // Deploy clone
        address cloneAddress = Clones.clone(masterMarketImplementation);

        // Initialize clone
        PredictionMarketUpgradeable(cloneAddress).initialize(
            question,
            endTime,
            minimumStake,
            collateralToken,
            address(accessControl),
            feeTreasury
        );

        // Set additional configs on clone if configured
        if (resellingMarketplace != address(0)) {
            PredictionMarketUpgradeable(cloneAddress).setResellingMarketplace(resellingMarketplace);
        }
        if (resolutionManager != address(0)) {
            PredictionMarketUpgradeable(cloneAddress).setResolutionManager(resolutionManager);
        }

        marketByQuestion[questionHash] = cloneAddress;
        marketsList.push(cloneAddress);

        emit MarketCreated(cloneAddress, question, endTime, minimumStake, collateralToken);

        return cloneAddress;
    }

    function getMarkets() external view override returns (address[] memory) {
        return marketsList;
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }
}
