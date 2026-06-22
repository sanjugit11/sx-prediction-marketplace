export const SXUA_ABI = [
  'event Deposited(address indexed user, address indexed token, uint256 amount, uint256 committedAmount, uint256 uncommittedAmount)',
  'event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 fee, bool isCommitted, uint256 subAccountId)',
  'event SubAccountCreated(uint256 indexed id, address indexed owner, address indexed token, uint256 principal, uint256 maturityDate)',
  'function deposit(address token, uint256 amount, uint256 committedPercentage) external',
  'function withdrawUncommitted(address token, uint256 amount) external',
  'function withdrawCommitted(uint256 subAccountId) external',
  'function getUnifiedBalance(address user, address token) external view returns (uint256)',
  'function getCommittedBalances(address user, address token) external view returns (uint256)',
  'function getUncommittedBalance(address user, address token) external view returns (uint256)',
  'function getAccruedYield(address user, uint256 subAccountId) external view returns (uint256)',
  'function getUserSubAccounts(address user) external view returns (uint256[] memory)',
  'function subAccounts(uint256 id) external view returns (uint256 id, address token, address owner, uint256 principal, uint256 createdAt, uint256 maturityDate, uint256 accruedYield, bool withdrawn)',
  'function nextSubAccountId() external view returns (uint256)'
];

export const FACTORY_ABI = [
  'event MarketCreated(address indexed marketAddress, string question, uint256 endTime, uint256 minimumStake, address indexed collateralToken)',
  'function createMarket(string calldata question, uint256 endTime, uint256 minimumStake, address collateralToken) external returns (address)',
  'function getMarkets() external view returns (address[] memory)'
];

export const PREDICTION_MARKET_ABI = [
  'event Staked(address indexed user, bool indexed outcome, uint256 amount, uint256 odds, uint256 positionId)',
  'event MarketResolved(bool indexed winner)',
  'function question() external view returns (string)',
  'function endTime() external view returns (uint256)',
  'function minimumStake() external view returns (uint256)',
  'function collateralToken() external view returns (address)',
  'function yesPool() external view returns (uint256)',
  'function noPool() external view returns (uint256)',
  'function totalPool() external view returns (uint256)',
  'function resolved() external view returns (bool)',
  'function winningOutcome() external view returns (bool)',
  'function getOdds(bool outcome) external view returns (uint256)',
  'function getPosition(uint256 positionId) external view returns (uint256 id, address owner, bool outcome, uint256 amount, uint256 oddsAtEntry, uint256 createdAt, bool claimed)',
  'function getUserPositions(address user) external view returns (uint256[] memory)',
  'function stakeYes(uint256 amount) external',
  'function stakeNo(uint256 amount) external',
  'function claim(uint256 positionId) external returns (uint256 payoutAmount, uint256 fee)',
  'function resolve(bool winner) external'
];

export const LEADERBOARD_ABI = [
  'event RewardsDistributed(address indexed token, uint256 totalPool, address[] topUsers)',
  'event RewardClaimed(address indexed user, address indexed token, uint256 amount)',
  'event UserStatsUpdated(address indexed user, uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume)',
  'function updateUserStats(address user, bool correct, uint256 volume) external',
  'function distributeRewards(address token, uint256 totalPool, address[] calldata topUsers) external',
  'function claimReward(address token) external',
  'function getUserStats(address user) external view returns (uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume)',
  'function getAccuracy(address user) external view returns (uint256)',
  'function getAllUsers() external view returns (address[] memory)',
  'function claimableRewards(address user, address token) external view returns (uint256)'
];

export const RESOLUTION_MANAGER_ABI = [
  'event MarketResolved(address indexed market, bool indexed winner)',
  'event PayoutClaimed(address indexed market, address indexed user, uint256 indexed positionId, uint256 payoutAmount, uint256 fee)',
  'function resolveMarket(address market, bool winner) external',
  'function claimPayout(address market, uint256 positionId) external'
];

export const MARKETPLACE_ABI = [
  'event PositionListed(uint256 indexed listingId, address indexed seller, address indexed market, uint256 positionId, uint256 price)',
  'event PositionPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 fee)',
  'event ListingCanceled(uint256 indexed listingId)',
  'function listPosition(address market, uint256 positionId, uint256 price) external returns (uint256)',
  'function cancelListing(uint256 listingId) external',
  'function buyPosition(uint256 listingId) external',
  'function listings(uint256 id) external view returns (uint256 id, address seller, address market, uint256 positionId, uint256 price, bool active)'
];

export const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)'
];
