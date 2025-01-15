/*
  Warnings:

  - You are about to drop the column `createdAt` on the `channel_drafts` table. All the data in the column will be lost.
  - You are about to drop the column `deviceId` on the `channel_drafts` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `channel_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `channel_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `channel_invitations` table. All the data in the column will be lost.
  - The `status` column on the `channel_invitations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `parentId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `replyCount` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the `attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message_reactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message_read_receipts` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[channelId,userId]` on the table `channel_drafts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[channelId,inviterId,inviteeId]` on the table `channel_invitations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `inviteeId` to the `channel_invitations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `channel_invitations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `channels` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MessageDeliveryStatus" ADD VALUE 'READ';

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_messageId_fkey";

-- DropForeignKey
ALTER TABLE "channel_invitations" DROP CONSTRAINT "channel_invitations_userId_fkey";

-- DropForeignKey
ALTER TABLE "message_reactions" DROP CONSTRAINT "message_reactions_messageId_fkey";

-- DropForeignKey
ALTER TABLE "message_reactions" DROP CONSTRAINT "message_reactions_userId_fkey";

-- DropForeignKey
ALTER TABLE "message_read_receipts" DROP CONSTRAINT "message_read_receipts_messageId_fkey";

-- DropForeignKey
ALTER TABLE "message_read_receipts" DROP CONSTRAINT "message_read_receipts_userId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_parentId_fkey";

-- DropIndex
DROP INDEX "channel_drafts_channelId_idx";

-- DropIndex
DROP INDEX "channel_drafts_userId_channelId_deviceId_key";

-- DropIndex
DROP INDEX "channel_drafts_userId_idx";

-- DropIndex
DROP INDEX "channel_invitations_channelId_idx";

-- DropIndex
DROP INDEX "channel_invitations_channelId_userId_key";

-- DropIndex
DROP INDEX "channel_invitations_userId_idx";

-- DropIndex
DROP INDEX "messages_channelId_idx";

-- DropIndex
DROP INDEX "messages_parentId_idx";

-- DropIndex
DROP INDEX "messages_userId_idx";

-- AlterTable
ALTER TABLE "channel_drafts" DROP COLUMN "createdAt",
DROP COLUMN "deviceId";

-- AlterTable
ALTER TABLE "channel_invitations" DROP COLUMN "expiresAt",
DROP COLUMN "role",
DROP COLUMN "userId",
ADD COLUMN     "inviteeId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "parentId",
DROP COLUMN "replyCount",
ADD COLUMN     "replyToId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "attachments";

-- DropTable
DROP TABLE "message_reactions";

-- DropTable
DROP TABLE "message_read_receipts";

-- DropEnum
DROP TYPE "InvitationStatus";

-- CreateTable
CREATE TABLE "reactions" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("messageId","userId","type")
);

-- CreateTable
CREATE TABLE "read_receipts" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "read_receipts_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_drafts_channelId_userId_key" ON "channel_drafts"("channelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_invitations_channelId_inviterId_inviteeId_key" ON "channel_invitations"("channelId", "inviterId", "inviteeId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "read_receipts" ADD CONSTRAINT "read_receipts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "read_receipts" ADD CONSTRAINT "read_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_invitations" ADD CONSTRAINT "channel_invitations_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
