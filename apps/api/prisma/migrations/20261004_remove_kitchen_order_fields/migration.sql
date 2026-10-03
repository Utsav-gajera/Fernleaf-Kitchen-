ALTER TABLE "orders" DROP COLUMN IF EXISTS "kitchenStatus";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "kitchenStartedAt";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "kitchenReadyAt";
DROP TYPE IF EXISTS "KitchenProgressStatus";
