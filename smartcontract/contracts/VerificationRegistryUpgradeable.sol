// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IVerificationRegistryUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";

contract VerificationRegistryUpgradeable is Initializable, PausableUpgradeable, IVerificationRegistryUpgradeable {
    SXAccessControlUpgradeable public accessControl;
    mapping(address => bool) private _verifiedImplementations;

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
        __Pausable_init();
        accessControl = SXAccessControlUpgradeable(accessControlAddress);
    }

    function markVerified(address implementation, bool verified) external override onlyAdmin whenNotPaused {
        if (implementation == address(0)) revert InvalidAddress();
        _verifiedImplementations[implementation] = verified;
        emit ContractVerified(implementation, verified);
    }

    function isVerified(address implementation) external view override returns (bool) {
        return _verifiedImplementations[implementation];
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }
}
