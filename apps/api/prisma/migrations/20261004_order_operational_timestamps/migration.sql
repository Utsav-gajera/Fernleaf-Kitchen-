ALTER TABLE "orders"
ADD COLUMN "plannedDispatchReadyAt" TIMESTAMP(3),
ADD COLUMN "plannedKitchenReadyAt" TIMESTAMP(3),
ADD COLUMN "kitchenStartedAt" TIMESTAMP(3),
ADD COLUMN "kitchenReadyAt" TIMESTAMP(3);
