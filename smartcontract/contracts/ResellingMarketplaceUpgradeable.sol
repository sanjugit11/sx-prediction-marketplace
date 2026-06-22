// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IResellingMarketplaceUpgradeable.sol";
import "./SXAccessControlUpgradeable.sol";
import "./FeeTreasuryUpgradeable.sol";
import "./PredictionMarketUpgradeable.sol";

contract ResellingMarketplaceUpgradeable is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable, IResellingMarketplaceUpgradeable {
    using SafeERC20 for IERC20;

    SXAccessControlUpgradeable public accessControl;
    FeeTreasuryUpgradeable public feeTreasury;

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            revert OnlySeller(); // custom role error or similar
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _accessControlAddress, address _feeTreasuryAddress) external initializer {
        if (_accessControlAddress == address(0) || _feeTreasuryAddress == address(0)) revert InvalidAddress();
        __ReentrancyGuard_init();
        __Pausable_init();

        accessControl = SXAccessControlUpgradeable(_accessControlAddress);
        feeTreasury = FeeTreasuryUpgradeable(_feeTreasuryAddress);
        nextListingId = 1;
    }

    function listPosition(address market, uint256 positionId, uint256 price) external override whenNotPaused returns (uint256) {
        if (market == address(0)) revert InvalidAddress();
        if (price == 0) revert InvalidPrice();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(market);
        if (pm.resolved()) revert MarketAlreadyResolved();

        PredictionMarketUpgradeable.Position memory pos = pm.getPosition(positionId);
        if (pos.owner != msg.sender) revert PositionNotOwned();
        if (pos.claimed) revert ListingNotActive(); // Or already claimed

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            id: listingId,
            seller: msg.sender,
            market: market,
            positionId: positionId,
            price: price,
            active: true
        });

        emit PositionListed(listingId, msg.sender, market, positionId, price);

        return listingId;
    }

    function cancelListing(uint256 listingId) external override nonReentrant {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert OnlySeller();

        listing.active = false;

        emit ListingCanceled(listingId);
    }

    function buyPosition(uint256 listingId) external override nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();

        PredictionMarketUpgradeable pm = PredictionMarketUpgradeable(listing.market);
        if (pm.resolved()) revert MarketAlreadyResolved();

        // Get position info and verify it hasn't changed or been claimed
        PredictionMarketUpgradeable.Position memory pos = pm.getPosition(listing.positionId);
        if (pos.owner != listing.seller) revert PositionNotOwned();
        if (pos.claimed) revert ListingNotActive();

        listing.active = false;

        address collateralToken = pm.collateralToken();
        uint256 price = listing.price;

        // Calculate 1% fee baked in
        uint256 fee = price / 100;
        uint256 sellerAmount = price - fee;

        // Pull price from buyer to marketplace
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), price);

        // Send fee to treasury
        if (fee > 0) {
            IERC20(collateralToken).safeIncreaseAllowance(address(feeTreasury), fee);
            feeTreasury.depositFee(collateralToken, fee, "marketplace");
        }

        // Send sellerAmount to seller
        IERC20(collateralToken).safeTransfer(listing.seller, sellerAmount);

        // Transfer position ownership in the market contract
        pm.transferPosition(listing.positionId, msg.sender);

        emit PositionPurchased(listingId, msg.sender, listing.seller, price, fee);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }
}
