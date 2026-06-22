-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committed_sub_accounts" (
    "id" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "principal" DECIMAL(78,0) NOT NULL,
    "yieldEarned" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "creationTimestamp" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "committed_sub_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "winner" BOOLEAN,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakes" (
    "id" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "marketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" BOOLEAN NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "oddsAtEntry" DECIMAL(28,18) NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "listingId" INTEGER NOT NULL,
    "stakeId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "price" DECIMAL(78,0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "accuracy" DECIMAL(5,2) NOT NULL,
    "totalPredictions" INTEGER NOT NULL,
    "correctPredictions" INTEGER NOT NULL,
    "volume" DECIMAL(78,0) NOT NULL,
    "rewardAmount" DECIMAL(78,0) NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "eventData" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_status" (
    "chainId" INTEGER NOT NULL,
    "lastProcessedBlock" INTEGER NOT NULL,

    CONSTRAINT "sync_status_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "reorg_log" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "oldHash" TEXT NOT NULL,
    "newHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reorg_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexing_errors" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indexing_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT,
    "walletAddress" TEXT,
    "payload" TEXT NOT NULL,
    "detectedType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "markets_contractAddress_key" ON "markets"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "stakes_positionId_key" ON "stakes"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_listingId_key" ON "marketplace_listings"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "events_chainId_transactionHash_logIndex_key" ON "events"("chainId", "transactionHash", "logIndex");

-- AddForeignKey
ALTER TABLE "committed_sub_accounts" ADD CONSTRAINT "committed_sub_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_stakeId_fkey" FOREIGN KEY ("stakeId") REFERENCES "stakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
