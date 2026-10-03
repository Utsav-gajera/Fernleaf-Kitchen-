CREATE TYPE "KitchenOrderStatus" AS ENUM ('PENDING', 'STARTED', 'DONE');

ALTER TABLE "orders"
  ADD COLUMN "kitchenStatus" "KitchenOrderStatus" NOT NULL DEFAULT 'PENDING';