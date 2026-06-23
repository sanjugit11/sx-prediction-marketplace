# Formal Verification Report

This report outlines the verified specifications for all core contracts in the protocol.

## Contracts Verified

1. `SXUAUpgradeable`
   - Verified no negative balances.
   - Verified deposit accounting correctness.

2. `PredictionMarketUpgradeable`
   - Verified strict pool math consistency (`totalPool = yesPool + noPool`).
   - Verified correct resolution constraints.

3. `ResolutionManagerUpgradeable`
   - Verified role-based access control.
   - Verified end-time constraints on resolutions.

4. `LeaderboardUpgradeable`
   - Verified bounds checking on rank and accuracy.

5. `ResellingMarketplaceUpgradeable`
   - Verified ownership validation on listings.
   - Verified atomic asset transfers upon purchase.

6. `VerificationRegistryUpgradeable`
   - Verified state immutability once verified.

7. `FeeTreasuryUpgradeable`
   - Verified exact balance transitions during fee collection and distribution.

## Status: All Invariants Proved
