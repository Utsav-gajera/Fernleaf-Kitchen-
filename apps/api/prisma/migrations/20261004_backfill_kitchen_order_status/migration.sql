UPDATE "orders"
SET "kitchenStatus" = CASE
  WHEN "kitchenReadyAt" IS NOT NULL THEN 'DONE'::"KitchenOrderStatus"
  WHEN "kitchenStartedAt" IS NOT NULL THEN 'STARTED'::"KitchenOrderStatus"
  ELSE 'PENDING'::"KitchenOrderStatus"
END
WHERE "kitchenStartedAt" IS NOT NULL OR "kitchenReadyAt" IS NOT NULL;