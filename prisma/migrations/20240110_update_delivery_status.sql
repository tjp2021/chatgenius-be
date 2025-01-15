-- Update all READ statuses to DELIVERED
UPDATE "messages"
SET "deliveryStatus" = 'DELIVERED'
WHERE "deliveryStatus" = 'READ'; 