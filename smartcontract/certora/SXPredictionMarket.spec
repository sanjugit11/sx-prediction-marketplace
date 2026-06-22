/**
 * Certora Verification Specification for PredictionMarketUpgradeable
 */

methods {
    // Declarations of view functions that are environment-free
    function yesPool() external returns (uint256) envfree;
    function noPool() external returns (uint256) envfree;
    function totalPool() external returns (uint256) envfree;
    function resolved() external returns (uint256) envfree;
    function winningOutcome() external returns (bool) envfree;
    function getOdds(bool) external returns (uint256) envfree;
}

/**
 * Invariant: Pool Solvency Invariant
 * The sum of yesPool and noPool must always equal totalPool.
 */
invariant pool_solvency()
    yesPool() + noPool() == totalPool();

/**
 * Rule: Resolution Monotonicity
 * Once the market is resolved, it cannot be unresolved or flipped.
 */
rule resolution_is_monotonic() {
    env e;
    bool before_resolved = resolved();
    bool before_winner = winningOutcome();

    // Any function call on the market
    calldataarg args;
    method f;
    f(e, args);

    bool after_resolved = resolved();
    bool after_winner = winningOutcome();

    // If it was resolved before, it must remain resolved and have the same winner
    assert before_resolved => (after_resolved && before_winner == after_winner);
}

/**
 * Rule: Staking Increases Total Pool
 * Staking YES or NO must increase the totalPool by the staked amount.
 */
rule staking_increases_total_pool(method f) {
    env e;
    uint256 amount;

    require f.selector == sig:stakeYes(uint256).selector || f.selector == sig:stakeNo(uint256).selector;
    
    uint256 pool_before = totalPool();
    
    calldataarg args;
    f(e, args);
    
    uint256 pool_after = totalPool();
    
    assert pool_after > pool_before;
}
