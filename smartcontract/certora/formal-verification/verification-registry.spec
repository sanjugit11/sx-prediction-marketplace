SPECIFICATION: VerificationRegistryUpgradeable

RULE VerifiedContractStored
verifyContract(contract)
assert:
isVerified(contract) == true

RULE VerificationImmutable
isVerified(contract) == true
==>
cannot set false

RULE OnlyAdminCanVerify
verifyContract()
requires:
caller hasRole ADMIN_ROLE
