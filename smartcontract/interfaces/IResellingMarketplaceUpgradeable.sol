// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IResellingMarketplaceUpgradeable {
    struct Listing {
        uint256 id;
        address seller;
        address market;
        uint256 positionId;
        uint256 price;
        bool active;
    }

    event PositionListed(uint256 indexed listingId, address indexed seller, address indexed market, uint256 positionId, uint256 price);
    event PositionPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 fee);
    event ListingCanceled(uint256 indexed listingId);

    error OnlySeller();
    error ListingNotActive();
    error InvalidPrice();
    error InvalidAddress();
    error TransferFailed();
    error PositionNotOwned();
    error MarketAlreadyResolved();

    function listPosition(address market, uint256 positionId, uint256 price) external returns (uint256);
    function cancelListing(uint256 listingId) external;
    function buyPosition(uint256 listingId) external;
}
