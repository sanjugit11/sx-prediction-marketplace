SPECIFICATION: ResellingMarketplaceUpgradeable

RULE OnlyOwnerCanList
listPosition()
requires:
caller == position.owner

RULE ListingPricePositive
listPosition(price)
requires:
price > 0

RULE OwnershipTransferOnPurchase
buyPosition()
assert:
position.owner = buyer

RULE CannotBuyInactiveListing
listing.active == false
==>
buyPosition()
must revert

RULE SellerCannotBuyOwnListing
buyer == seller
==>
buyPosition()
must revert
