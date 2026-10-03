ALTER TABLE "orders" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "cutoff_processing" (
    "id" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cutoff_processing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cutoff_processing_deliveryDate_key" ON "cutoff_processing"("deliveryDate");
