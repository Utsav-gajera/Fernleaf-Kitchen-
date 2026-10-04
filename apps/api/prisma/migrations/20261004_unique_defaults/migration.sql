-- The application switches defaults transactionally; these partial indexes also
-- protect the invariants when concurrent requests reach PostgreSQL together.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS position
  FROM "price_tiers"
  WHERE "isDefault" = true
)
UPDATE "price_tiers" AS tier
SET "isDefault" = false
FROM ranked
WHERE tier."id" = ranked."id" AND ranked.position > 1;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS position
  FROM "company_addresses"
  WHERE "isDefault" = true
)
UPDATE "company_addresses" AS address
SET "isDefault" = false
FROM ranked
WHERE address."id" = ranked."id" AND ranked.position > 1;

CREATE UNIQUE INDEX "price_tiers_one_default_idx"
ON "price_tiers" ("isDefault")
WHERE "isDefault" = true;

CREATE UNIQUE INDEX "company_addresses_one_default_idx"
ON "company_addresses" ("companyId")
WHERE "isDefault" = true;
