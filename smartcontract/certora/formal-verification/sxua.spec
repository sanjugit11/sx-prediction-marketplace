SPECIFICATION: SXUAUpgradeable

INVARIANT NoNegativeBalance
forall user:
unifiedBalance(user) >= 0

RULE DepositIncreasesBalance
beforeBalance = unifiedBalance(user)
deposit(amount)
assert:
unifiedBalance(user) >= beforeBalance

RULE WithdrawCannotExceedBalance
withdraw(amount)
requires:
amount <= unifiedBalance(user)

RULE CommittedDepositCreatesSubAccount
deposit(amount, committedPercentage)
requires:
committedPercentage > 0
assert:
subAccountCount(user) = old(subAccountCount(user)) + 1

RULE MaturityDateAfterCreation
forall subAccount:
maturityDate > creationDate
