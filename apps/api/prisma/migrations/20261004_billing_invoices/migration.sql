CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PAID');

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
  "totalMinor" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_orders" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "totalMinor" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_orders_orderId_key" ON "invoice_orders"("orderId");
CREATE INDEX "invoices_companyId_status_idx" ON "invoices"("companyId", "status");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_orders" ADD CONSTRAINT "invoice_orders_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_orders" ADD CONSTRAINT "invoice_orders_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
