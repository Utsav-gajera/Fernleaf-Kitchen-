DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'KitchenProgressStatus'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE "KitchenProgressStatus" AS ENUM ('PENDING', 'STARTED', 'DONE');
  END IF;
END
$$;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "kitchenStatus" "KitchenProgressStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "orders"
SET "kitchenStatus" = CASE
  WHEN "kitchenReadyAt" IS NOT NULL THEN 'DONE'::"KitchenProgressStatus"
  WHEN "kitchenStartedAt" IS NOT NULL THEN 'STARTED'::"KitchenProgressStatus"
  ELSE 'PENDING'::"KitchenProgressStatus"
END
WHERE "kitchenStartedAt" IS NOT NULL
   OR "kitchenReadyAt" IS NOT NULL;
