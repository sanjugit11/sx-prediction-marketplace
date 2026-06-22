// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/IAccessControl.sol";

interface ISXAccessControlUpgradeable is IAccessControl {
    // Custom error declarations
    error Unauthorized(address account, bytes32 role);
    error InvalidAddress();
}
