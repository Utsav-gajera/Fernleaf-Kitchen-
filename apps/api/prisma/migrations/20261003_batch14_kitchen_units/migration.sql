CREATE TYPE "KitchenUnitStatus" AS ENUM ('PENDING', 'STARTED', 'DONE');

ALTER TABLE "orders"
  ADD COLUMN "kitchenStartedAt" TIMESTAMP(3),
  ADD COLUMN "kitchenReadyAt" TIMESTAMP(3);

CREATE TABLE "kitchen_units" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "combinationId" TEXT NOT NULL,
  "stationId" TEXT,
  "stationNameSnapshot" TEXT,
  "dishNameSnapshot" TEXT NOT NULL,
  "skuSnapshot" TEXT NOT NULL,
  "optionsSnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "KitchenUnitStatus" NOT NULL DEFAULT 'PENDING',
  "plannedDispatchAt" TIMESTAMP(3) NOT NULL,
  "plannedKitchenReadyAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kitchen_units_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kitchen_units_combinationId_key" ON "kitchen_units"("combinationId");
CREATE INDEX "kitchen_units_orderId_status_idx" ON "kitchen_units"("orderId", "status");
CREATE INDEX "kitchen_units_plannedKitchenReadyAt_idx" ON "kitchen_units"("plannedKitchenReadyAt");
CREATE INDEX "kitchen_units_stationId_idx" ON "kitchen_units"("stationId");
ALTER TABLE "kitchen_units" ADD CONSTRAINT "kitchen_units_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kitchen_units" ADD CONSTRAINT "kitchen_units_combinationId_fkey"
  FOREIGN KEY ("combinationId") REFERENCES "order_combinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kitchen_units" ADD CONSTRAINT "kitchen_units_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "kitchen_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
