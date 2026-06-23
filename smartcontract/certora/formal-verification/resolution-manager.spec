SPECIFICATION: ResolutionManagerUpgradeable

RULE ResolutionAfterEndTime
resolveMarket()
requires:
block.timestamp >= market.endTime

RULE OnlyResolverCanResolve
resolveMarket()
requires:
caller hasRole RESOLVER_ROLE

RULE PayoutOnlyForWinner
claimPayout()
requires:
userPosition.outcome == market.winner

RULE CannotClaimTwice
claimed == true
==>
claimPayout()
must revert

RULE PayoutNonNegative
claimAmount >= 0
