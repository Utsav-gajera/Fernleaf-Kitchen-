-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'KITCHEN', 'DISPATCH', 'DRIVER');

-- CreateEnum
CREATE TYPE "DishTemperature" AS ENUM ('HOT', 'COLD');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "StaffRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingContactName" TEXT,
    "billingContactEmail" TEXT,
    "billingContactPhone" TEXT,
    "ownerId" TEXT,
    "priceTierId" TEXT,
    "defaultDeliveryTime" TEXT NOT NULL DEFAULT '12:00',
    "deliveryLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultPackaging" TEXT NOT NULL DEFAULT 'STANDARD',
    "standingInstructions" TEXT,
    "defaultDriverId" TEXT,
    "mon" BOOLEAN NOT NULL DEFAULT true,
    "tue" BOOLEAN NOT NULL DEFAULT true,
    "wed" BOOLEAN NOT NULL DEFAULT true,
    "thu" BOOLEAN NOT NULL DEFAULT true,
    "fri" BOOLEAN NOT NULL DEFAULT true,
    "sat" BOOLEAN NOT NULL DEFAULT false,
    "sun" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_domains" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_addresses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "instructions" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canChooseDeliveryAddress" BOOLEAN NOT NULL DEFAULT false,
    "canChangeDeliveryTime" BOOLEAN NOT NULL DEFAULT false,
    "canChangePackaging" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dietary_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dietary_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "temperature" "DishTemperature" NOT NULL DEFAULT 'HOT',
    "costPriceMinor" INTEGER NOT NULL,
    "stationId" TEXT,
    "minQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "costPriceMinor" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowPortions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_option_groups" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequiredOverride" BOOLEAN,

    CONSTRAINT "dish_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_group_options" (
    "id" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "extraChargeMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "option_group_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_dishes" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "category_dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_hidden_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "company_hidden_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_hidden_dishes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,

    CONSTRAINT "company_hidden_dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "derivedFromTierId" TEXT,
    "multiplier" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_prices" (
    "id" TEXT NOT NULL,
    "priceTierId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,

    CONSTRAINT "dish_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_prices" (
    "id" TEXT NOT NULL,
    "priceTierId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,

    CONSTRAINT "option_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "kitchenTimeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "cutOffTime" TEXT NOT NULL DEFAULT '16:00',
    "cutOffWorkingDays" INTEGER NOT NULL DEFAULT 2,
    "dispatchLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "kitchenReadyBufferMinutes" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_holidays" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_holidays" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_allergens" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "dish_allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_dietary_tags" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "dish_dietary_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_allergens" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "option_allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_dietary_tags" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "option_dietary_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_allergens" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "employee_allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_dietary_tags" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "employee_dietary_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_ownerId_key" ON "companies"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "company_domains_domain_key" ON "company_domains"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "allergens_name_key" ON "allergens"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dietary_tags_name_key" ON "dietary_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_stations_name_key" ON "kitchen_stations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dishes_sku_key" ON "dishes"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "dish_option_groups_dishId_optionGroupId_key" ON "dish_option_groups"("dishId", "optionGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "option_group_options_optionGroupId_optionId_key" ON "option_group_options"("optionGroupId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "category_dishes_categoryId_dishId_key" ON "category_dishes"("categoryId", "dishId");

-- CreateIndex
CREATE UNIQUE INDEX "company_hidden_categories_companyId_categoryId_key" ON "company_hidden_categories"("companyId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "company_hidden_dishes_companyId_dishId_key" ON "company_hidden_dishes"("companyId", "dishId");

-- CreateIndex
CREATE UNIQUE INDEX "price_tiers_name_key" ON "price_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dish_prices_priceTierId_dishId_key" ON "dish_prices"("priceTierId", "dishId");

-- CreateIndex
CREATE UNIQUE INDEX "option_prices_priceTierId_optionId_key" ON "option_prices"("priceTierId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_holidays_date_key" ON "kitchen_holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "company_holidays_companyId_date_key" ON "company_holidays"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "dish_allergens_dishId_allergenId_key" ON "dish_allergens"("dishId", "allergenId");

-- CreateIndex
CREATE UNIQUE INDEX "dish_dietary_tags_dishId_dietaryTagId_key" ON "dish_dietary_tags"("dishId", "dietaryTagId");

-- CreateIndex
CREATE UNIQUE INDEX "option_allergens_optionId_allergenId_key" ON "option_allergens"("optionId", "allergenId");

-- CreateIndex
CREATE UNIQUE INDEX "option_dietary_tags_optionId_dietaryTagId_key" ON "option_dietary_tags"("optionId", "dietaryTagId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_allergens_employeeId_allergenId_key" ON "employee_allergens"("employeeId", "allergenId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_dietary_tags_employeeId_dietaryTagId_key" ON "employee_dietary_tags"("employeeId", "dietaryTagId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "price_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_domains" ADD CONSTRAINT "company_domains_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_addresses" ADD CONSTRAINT "company_addresses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "kitchen_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_option_groups" ADD CONSTRAINT "dish_option_groups_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_option_groups" ADD CONSTRAINT "dish_option_groups_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_group_options" ADD CONSTRAINT "option_group_options_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_group_options" ADD CONSTRAINT "option_group_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_dishes" ADD CONSTRAINT "category_dishes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_dishes" ADD CONSTRAINT "category_dishes_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hidden_categories" ADD CONSTRAINT "company_hidden_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hidden_categories" ADD CONSTRAINT "company_hidden_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hidden_dishes" ADD CONSTRAINT "company_hidden_dishes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hidden_dishes" ADD CONSTRAINT "company_hidden_dishes_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_derivedFromTierId_fkey" FOREIGN KEY ("derivedFromTierId") REFERENCES "price_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_prices" ADD CONSTRAINT "dish_prices_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "price_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_prices" ADD CONSTRAINT "dish_prices_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_prices" ADD CONSTRAINT "option_prices_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "price_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_prices" ADD CONSTRAINT "option_prices_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_allergens" ADD CONSTRAINT "dish_allergens_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_allergens" ADD CONSTRAINT "dish_allergens_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "allergens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_dietary_tags" ADD CONSTRAINT "dish_dietary_tags_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_dietary_tags" ADD CONSTRAINT "dish_dietary_tags_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "dietary_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_allergens" ADD CONSTRAINT "option_allergens_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_allergens" ADD CONSTRAINT "option_allergens_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "allergens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_dietary_tags" ADD CONSTRAINT "option_dietary_tags_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_dietary_tags" ADD CONSTRAINT "option_dietary_tags_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "dietary_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_allergens" ADD CONSTRAINT "employee_allergens_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_allergens" ADD CONSTRAINT "employee_allergens_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "allergens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_dietary_tags" ADD CONSTRAINT "employee_dietary_tags_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_dietary_tags" ADD CONSTRAINT "employee_dietary_tags_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "dietary_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

