// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPredictionMarketFactoryUpgradeable {
    event MarketCreated(address indexed marketAddress, string question, uint256 endTime, uint256 minimumStake, address indexed collateralToken);

    error ImplementationNotVerified();
    error QuestionAlreadyExists();
    error InvalidEndTime();
    error InvalidAddress();
    error OnlyAdmin();

    function createMarket(
        string calldata question,
        uint256 endTime,
        uint256 minimumStake,
        address collateralToken
    ) external returns (address);

    function getMarkets() external view returns (address[] memory);
}
