-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdByStaffId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "addressInstructions" TEXT,
    "packaging" TEXT NOT NULL,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dishId" TEXT,
    "dishNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "dishUnitPriceMinor" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_combinations" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "optionGroupId" TEXT,
    "optionGroupNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "order_combinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_combination_options" (
    "id" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "optionId" TEXT,
    "optionNameSnapshot" TEXT NOT NULL,
    "optionPriceMinor" INTEGER NOT NULL,

    CONSTRAINT "order_combination_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_timeline_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_companyId_idx" ON "orders"("companyId");
CREATE INDEX "orders_employeeId_idx" ON "orders"("employeeId");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_deliveryDate_idx" ON "orders"("deliveryDate");
CREATE INDEX "order_lines_orderId_idx" ON "order_lines"("orderId");
CREATE INDEX "order_lines_dishId_idx" ON "order_lines"("dishId");
CREATE INDEX "order_combinations_orderLineId_idx" ON "order_combinations"("orderLineId");
CREATE INDEX "order_combination_options_combinationId_idx" ON "order_combination_options"("combinationId");
CREATE INDEX "order_combination_options_optionId_idx" ON "order_combination_options"("optionId");
CREATE INDEX "order_timeline_events_orderId_createdAt_idx" ON "order_timeline_events"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_combinations" ADD CONSTRAINT "order_combinations_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_combination_options" ADD CONSTRAINT "order_combination_options_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "order_combinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_combination_options" ADD CONSTRAINT "order_combination_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_timeline_events" ADD CONSTRAINT "order_timeline_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;