// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IVerificationRegistryUpgradeable {
    event ContractVerified(address indexed implementation, bool verified);

    error OnlyAdmin();
    error InvalidAddress();

    function markVerified(address implementation, bool verified) external;
    function isVerified(address implementation) external view returns (bool);
}
