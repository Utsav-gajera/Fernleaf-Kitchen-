CREATE TYPE "DropStatus" AS ENUM ('KITCHEN_READY', 'DISPATCH_READY', 'OUT_FOR_DELIVERY', 'DELIVERED');

CREATE TABLE "drops" (
  "id" TEXT NOT NULL,
  "groupingKey" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "driverId" TEXT,
  "status" "DropStatus" NOT NULL DEFAULT 'KITCHEN_READY',
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "deliveryTime" TEXT NOT NULL,
  "deliveryAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "drops_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drops_groupingKey_key" ON "drops"("groupingKey");
CREATE INDEX "drops_deliveryAt_status_idx" ON "drops"("deliveryAt", "status");
CREATE INDEX "drops_companyId_deliveryAt_idx" ON "drops"("companyId", "deliveryAt");

CREATE TABLE "drop_orders" (
  "id" TEXT NOT NULL,
  "dropId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "drop_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drop_orders_orderId_key" ON "drop_orders"("orderId");
CREATE UNIQUE INDEX "drop_orders_dropId_orderId_key" ON "drop_orders"("dropId", "orderId");
ALTER TABLE "drops" ADD CONSTRAINT "drops_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drops" ADD CONSTRAINT "drops_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drop_orders" ADD CONSTRAINT "drop_orders_dropId_fkey"
  FOREIGN KEY ("dropId") REFERENCES "drops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drop_orders" ADD CONSTRAINT "drop_orders_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
