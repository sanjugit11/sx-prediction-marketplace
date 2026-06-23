SPECIFICATION: FeeTreasuryUpgradeable

INVARIANT TreasuryBalanceNonNegative
treasuryBalance >= 0

RULE FeeCollectionIncreasesTreasury
beforeBalance = treasuryBalance
collectFee(amount)
assert:
treasuryBalance = beforeBalance + amount

RULE DistributionCannotExceedBalance
distribute(amount)
requires:
amount <= treasuryBalance

RULE TreasuryCannotUnderflow
treasuryBalance >= 0
