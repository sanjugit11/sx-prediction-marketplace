SPECIFICATION: LeaderboardUpgradeable

INVARIANT AccuracyRange
0 <= accuracy <= 100

INVARIANT RewardPoolNonNegative
rewardPool >= 0

RULE CorrectPredictionUpdatesAccuracy
marketResolved()
assert:
accuracy >= old(accuracy)

RULE RankMustBePositive
rank > 0

RULE RewardsCannotExceedPool
distributedRewards <= rewardPool
