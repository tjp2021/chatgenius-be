-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'SENT';
