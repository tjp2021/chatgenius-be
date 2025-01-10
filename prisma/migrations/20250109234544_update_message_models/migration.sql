/*
  Warnings:

  - The values [READ] on the enum `MessageDeliveryStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `reactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `read_receipts` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MessageDeliveryStatus_new" AS ENUM ('SENDING', 'SENT', 'DELIVERED', 'FAILED');
ALTER TABLE "messages" ALTER COLUMN "deliveryStatus" DROP DEFAULT;
ALTER TABLE "messages" ALTER COLUMN "deliveryStatus" TYPE "MessageDeliveryStatus_new" USING ("deliveryStatus"::text::"MessageDeliveryStatus_new");
ALTER TYPE "MessageDeliveryStatus" RENAME TO "MessageDeliveryStatus_old";
ALTER TYPE "MessageDeliveryStatus_new" RENAME TO "MessageDeliveryStatus";
DROP TYPE "MessageDeliveryStatus_old";
ALTER TABLE "messages" ALTER COLUMN "deliveryStatus" SET DEFAULT 'SENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "reactions" DROP CONSTRAINT "reactions_messageId_fkey";

-- DropForeignKey
ALTER TABLE "reactions" DROP CONSTRAINT "reactions_userId_fkey";

-- DropForeignKey
ALTER TABLE "read_receipts" DROP CONSTRAINT "read_receipts_messageId_fkey";

-- DropForeignKey
ALTER TABLE "read_receipts" DROP CONSTRAINT "read_receipts_userId_fkey";

-- DropTable
DROP TABLE "reactions";

-- DropTable
DROP TABLE "read_receipts";

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_receipts" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");

-- CreateIndex
CREATE INDEX "message_reactions_userId_idx" ON "message_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_userId_emoji_key" ON "message_reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "message_read_receipts_messageId_idx" ON "message_read_receipts"("messageId");

-- CreateIndex
CREATE INDEX "message_read_receipts_userId_idx" ON "message_read_receipts"("userId");

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
