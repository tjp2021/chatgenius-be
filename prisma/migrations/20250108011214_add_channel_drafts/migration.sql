-- CreateTable
CREATE TABLE "channel_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_drafts_userId_idx" ON "channel_drafts"("userId");

-- CreateIndex
CREATE INDEX "channel_drafts_channelId_idx" ON "channel_drafts"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_drafts_userId_channelId_deviceId_key" ON "channel_drafts"("userId", "channelId", "deviceId");

-- AddForeignKey
ALTER TABLE "channel_drafts" ADD CONSTRAINT "channel_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_drafts" ADD CONSTRAINT "channel_drafts_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
