UPDATE "orders" AS o
SET "status" = CASE d."status"::text
  WHEN 'KITCHEN_READY' THEN 'KITCHEN_READY'::"OrderStatus"
  WHEN 'DISPATCH_READY' THEN 'DISPATCH_READY'::"OrderStatus"
  WHEN 'OUT_FOR_DELIVERY' THEN 'OUT_FOR_DELIVERY'::"OrderStatus"
  WHEN 'DELIVERED' THEN 'DELIVERED'::"OrderStatus"
  ELSE o."status"
END
FROM "drop_orders" AS drop_order
JOIN "drops" AS d ON d."id" = drop_order."dropId"
WHERE drop_order."orderId" = o."id";

UPDATE "orders" AS o
SET "status" = 'KITCHEN_READY'::"OrderStatus"
WHERE o."status" IN ('CONFIRMED'::"OrderStatus", 'KITCHEN_IN_PROGRESS'::"OrderStatus")
  AND EXISTS (
    SELECT 1
    FROM "kitchen_units" AS ku
    WHERE ku."orderId" = o."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "kitchen_units" AS ku
    WHERE ku."orderId" = o."id"
      AND ku."status" <> 'DONE'
  );
