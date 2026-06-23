SPECIFICATION: PredictionMarketUpgradeable

INVARIANT PoolsNonNegative
yesPool >= 0
noPool >= 0

RULE StakeYesUpdatesPool
beforePool = yesPool
stakeYes(amount)
assert:
yesPool = beforePool + amount

RULE StakeNoUpdatesPool
beforePool = noPool
stakeNo(amount)
assert:
noPool = beforePool + amount

RULE TotalPoolConsistency
assert:
totalPool = yesPool + noPool

RULE MarketCannotResolveTwice
resolved == true
=>
resolveMarket()
must revert

RULE WinnerMustExistAfterResolution
resolved == true
==>
winner != NONE
