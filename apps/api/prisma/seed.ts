import { PrismaClient, StaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const SALT_ROUNDS = 12;

async function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Sequential upsert helper to avoid connection pool exhaustion on cloud DBs
async function seqUpsert<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  for (const item of items) {
    await fn(item);
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  const { driverId, staffUsers } = await seedStaffUsers();
  const { standardTier, enterpriseTier, partnerTier, hotStation, coldStation, grillStation } =
    await seedReferenceData();
  const { allergenMap, tagMap } = await seedAllergensAndTags();
  const { acme, greenleaf, nova, domainData } = await seedCompanies({
    driverId,
    enterpriseTier,
    partnerTier,
    standardTier,
  });

  await seedDomains(domainData);
  await seedAddresses({ acmeId: acme.id, greenleafId: greenleaf.id, novaId: nova.id });
  await seedEmployees({ acmeId: acme.id, greenleafId: greenleaf.id, novaId: nova.id, allergenMap, tagMap });
  const optionData = await seedOptions();
  const { breadGroup, sideGroup, sauceGroup, proteinGroup } = await seedOptionGroups();
  await seedDishAssignments({ breadGroup, sideGroup, sauceGroup, proteinGroup });
  const { dishData } = await seedDishes({ hotStation, coldStation, grillStation, allergenMap, tagMap });
  await seedCategories();
  await seedPrices({ dishData, optionData, standardTier, enterpriseTier, partnerTier });
  await seedPlatformSettings();
  await seedHolidays({ greenleafId: greenleaf.id, novaId: nova.id });

  console.log('\n🎉 Seed complete!');
  console.log('');
  console.log('  Staff logins:');
  console.log('  ┌─────────────────────────┬───────────┬──────────┐');
  console.log('  │ Email                   │ Password  │ Role     │');
  console.log('  ├─────────────────────────┼───────────┼──────────┤');
  for (const s of staffUsers) {
    const pad = (str: string, len: number) => str.padEnd(len);
    console.log(`  │ ${pad(s.email, 23)} │ Test@1234 │ ${pad(s.role, 8)} │`);
  }
  console.log('  └─────────────────────────┴───────────┴──────────┘');
  console.log(`\n  Companies : Acme Corp · Greenleaf Studios · Nova Health Partners`);
  console.log(`  Dishes    : ${dishData.length}`);
  console.log(`  Options   : ${optionData.length}`);
  console.log(`  Tiers     : Standard · Enterprise · Partner`);
  console.log('');
}

async function seedStaffUsers() {
  const staffPassword = await hash('Test@1234');
  const staffUsers = [
    { email: 'admin@test.com', name: 'Alex Rivera', role: StaffRole.ADMIN },
    { email: 'kitchen@test.com', name: 'Jordan Kim', role: StaffRole.KITCHEN },
    { email: 'dispatch@test.com', name: 'Sam Patel', role: StaffRole.DISPATCH },
    { email: 'driver@test.com', name: 'Chris Okafor', role: StaffRole.DRIVER },
  ];
  const createdStaff: Record<string, string> = {};
  for (const s of staffUsers) {
    const staff = await prisma.staffUser.upsert({
      where: { email: s.email },
      update: { name: s.name, role: s.role },
      create: { email: s.email, password: staffPassword, name: s.name, role: s.role },
    });
    createdStaff[s.role] = staff.id;
  }
  console.log('  ✅ Staff users seeded');
  return { driverId: createdStaff[StaffRole.DRIVER], staffUsers };
}

async function seedReferenceData() {
  const standardTier = await prisma.priceTier.upsert({
    where: { name: 'Standard' },
    update: { isDefault: true },
    create: { name: 'Standard', isDefault: true },
  });

  const enterpriseTier = await prisma.priceTier.upsert({
    where: { name: 'Enterprise' },
    update: { isDefault: false },
    create: { name: 'Enterprise', isDefault: false },
  });

  const partnerTier = await prisma.priceTier.upsert({
    where: { name: 'Partner' },
    update: { isDefault: false },
    create: { name: 'Partner', isDefault: false },
  });

  const hotStation = await prisma.kitchenStation.upsert({
    where: { name: 'Hot Kitchen' },
    update: {},
    create: { name: 'Hot Kitchen', description: 'Soups, curries, and cooked mains' },
  });

  const coldStation = await prisma.kitchenStation.upsert({
    where: { name: 'Cold & Salad' },
    update: {},
    create: { name: 'Cold & Salad', description: 'Salads, wraps, and cold platters' },
  });

  const grillStation = await prisma.kitchenStation.upsert({
    where: { name: 'Grill Station' },
    update: {},
    create: { name: 'Grill Station', description: 'Grilled proteins and sandwiches' },
  });

  console.log('  ✅ Price tiers and kitchen stations seeded');

  return { standardTier, enterpriseTier, partnerTier, hotStation, coldStation, grillStation };
}

async function seedAllergensAndTags() {
  const allergenNames = ['Gluten', 'Dairy', 'Nuts', 'Peanuts', 'Eggs', 'Soy', 'Sesame', 'Shellfish', 'Fish', 'Celery'];
  const dietaryTagNames = ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Halal', 'Kosher', 'Low-Carb', 'High-Protein'];

  const allergenMap: Record<string, string> = {};
  for (const name of allergenNames) {
    const allergen = await prisma.allergen.upsert({ where: { name }, update: {}, create: { name } });
    allergenMap[name] = allergen.id;
  }

  const tagMap: Record<string, string> = {};
  for (const name of dietaryTagNames) {
    const tag = await prisma.dietaryTag.upsert({ where: { name }, update: {}, create: { name } });
    tagMap[name] = tag.id;
  }

  console.log('  ✅ Allergens and dietary tags seeded');
  return { allergenMap, tagMap };
}

async function seedCompanies({ driverId, enterpriseTier, partnerTier, standardTier }: {
  driverId: string;
  enterpriseTier: { id: string };
  partnerTier: { id: string };
  standardTier: { id: string };
}) {
  const acme = await prisma.company.upsert({
    where: { id: 'company-acme-001' },
    update: {
      name: 'Acme Corp',
      billingContactName: 'Priya Sharma',
      billingContactEmail: 'billing@acmecorp.com',
      billingContactPhone: '+44 20 7946 0100',
      priceTierId: enterpriseTier.id,
      defaultDriverId: driverId,
      defaultDeliveryTime: '12:30',
      deliveryLeadMinutes: 45,
      defaultPackaging: 'STANDARD',
      standingInstructions: 'Leave at reception. Call on arrival.',
    },
    create: {
      id: 'company-acme-001',
      name: 'Acme Corp',
      billingContactName: 'Priya Sharma',
      billingContactEmail: 'billing@acmecorp.com',
      billingContactPhone: '+44 20 7946 0100',
      priceTierId: enterpriseTier.id,
      defaultDriverId: driverId,
      defaultDeliveryTime: '12:30',
      deliveryLeadMinutes: 45,
      defaultPackaging: 'STANDARD',
      standingInstructions: 'Leave at reception. Call on arrival.',
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
    },
  });

  const greenleaf = await prisma.company.upsert({
    where: { id: 'company-greenleaf-002' },
    update: {
      name: 'Greenleaf Studios',
      billingContactName: 'Tom Nguyen',
      billingContactEmail: 'accounts@greenleafstudios.co',
      billingContactPhone: '+44 20 7946 0200',
      priceTierId: partnerTier.id,
      defaultDeliveryTime: '13:00',
      deliveryLeadMinutes: 60,
      defaultPackaging: 'ECO_FRIENDLY',
      standingInstructions: 'Eco packaging preferred. Deliver to studio floor 3.',
    },
    create: {
      id: 'company-greenleaf-002',
      name: 'Greenleaf Studios',
      billingContactName: 'Tom Nguyen',
      billingContactEmail: 'accounts@greenleafstudios.co',
      billingContactPhone: '+44 20 7946 0200',
      priceTierId: partnerTier.id,
      defaultDeliveryTime: '13:00',
      deliveryLeadMinutes: 60,
      defaultPackaging: 'ECO_FRIENDLY',
      standingInstructions: 'Eco packaging preferred. Deliver to studio floor 3.',
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
    },
  });

  const nova = await prisma.company.upsert({
    where: { id: 'company-nova-003' },
    update: {
      name: 'Nova Health Partners',
      billingContactName: 'Maria Costa',
      billingContactEmail: 'finance@novahealthpartners.com',
      billingContactPhone: '+44 20 7946 0300',
      priceTierId: standardTier.id,
      defaultDeliveryTime: '12:00',
      deliveryLeadMinutes: 60,
      defaultPackaging: 'STANDARD',
      standingInstructions: 'Nut-free building. No nuts in any deliveries.',
    },
    create: {
      id: 'company-nova-003',
      name: 'Nova Health Partners',
      billingContactName: 'Maria Costa',
      billingContactEmail: 'finance@novahealthpartners.com',
      billingContactPhone: '+44 20 7946 0300',
      priceTierId: standardTier.id,
      defaultDeliveryTime: '12:00',
      deliveryLeadMinutes: 60,
      defaultPackaging: 'STANDARD',
      standingInstructions: 'Nut-free building. No nuts in any deliveries.',
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
    },
  });

  const domainData = [
    { domain: 'acmecorp.com', companyId: acme.id },
    { domain: 'acme.co.uk', companyId: acme.id },
    { domain: 'greenleafstudios.co', companyId: greenleaf.id },
    { domain: 'novahealthpartners.com', companyId: nova.id },
    { domain: 'novahealth.org', companyId: nova.id },
  ];

  console.log('  ✅ Companies seeded');
  return { acme, greenleaf, nova, domainData };
}

async function seedDomains(domainData: Array<{ domain: string; companyId: string }>) {
  await seqUpsert(domainData, (d) =>
    prisma.companyDomain.upsert({
      where: { domain: d.domain },
      update: { companyId: d.companyId },
      create: d,
    }),
  );
  console.log('  ✅ Company domains seeded');
}

async function seedAddresses({ acmeId, greenleafId, novaId }: { acmeId: string; greenleafId: string; novaId: string }) {
  await prisma.companyAddress.deleteMany({
    where: { companyId: { in: [acmeId, greenleafId, novaId] } },
  });

  const addressData = [
    { companyId: acmeId, addressLine1: '1 Acme Way', city: 'London', postalCode: 'EC1A 1BB', instructions: 'Main entrance, buzz Acme Corp', isDefault: true },
    { companyId: acmeId, addressLine1: '17 Canary Wharf Tower', addressLine2: 'Level 8', city: 'London', postalCode: 'E14 5AB', instructions: 'Secondary office, security desk', isDefault: false },
    { companyId: greenleafId, addressLine1: '52 Shoreditch High Street', addressLine2: 'Studio Floor 3', city: 'London', postalCode: 'E1 6JJ', instructions: 'Ring studio bell', isDefault: true },
    { companyId: novaId, addressLine1: "200 Gray's Inn Road", city: 'London', postalCode: 'WC1X 8XZ', instructions: 'Health clinic reception — nut-free zone', isDefault: true },
  ];

  for (const addr of addressData) {
    await prisma.companyAddress.create({ data: addr });
  }
  console.log('  ✅ Company addresses seeded');
}

async function seedEmployees({ acmeId, greenleafId, novaId, allergenMap, tagMap }: {
  acmeId: string;
  greenleafId: string;
  novaId: string;
  allergenMap: Record<string, string>;
  tagMap: Record<string, string>;
}) {
  const employeeData = [
    { id: 'emp-acme-001', companyId: acmeId, email: 'p.sharma@acmecorp.com', name: 'Priya Sharma' },
    { id: 'emp-acme-002', companyId: acmeId, email: 'j.whitfield@acmecorp.com', name: 'James Whitfield' },
    { id: 'emp-acme-003', companyId: acmeId, email: 'a.chen@acmecorp.com', name: 'Amy Chen' },
    { id: 'emp-acme-004', companyId: acmeId, email: 'd.osei@acmecorp.com', name: 'Kwame Osei' },
    { id: 'emp-gl-001', companyId: greenleafId, email: 't.nguyen@greenleafstudios.co', name: 'Tom Nguyen' },
    { id: 'emp-gl-002', companyId: greenleafId, email: 's.ali@greenleafstudios.co', name: 'Sara Ali' },
    { id: 'emp-gl-003', companyId: greenleafId, email: 'r.mistry@greenleafstudios.co', name: 'Rohan Mistry' },
    { id: 'emp-nova-001', companyId: novaId, email: 'm.costa@novahealthpartners.com', name: 'Maria Costa' },
    { id: 'emp-nova-002', companyId: novaId, email: 'l.jones@novahealthpartners.com', name: 'Liam Jones' },
    { id: 'emp-nova-003', companyId: novaId, email: 'f.hassan@novahealthpartners.com', name: 'Fatima Hassan' },
  ];

  for (const employee of employeeData) {
    await prisma.employee.upsert({
      where: { id: employee.id },
      update: { name: employee.name, email: employee.email },
      create: {
        id: employee.id,
        companyId: employee.companyId,
        email: employee.email,
        name: employee.name,
        canChooseDeliveryAddress: true,
        canChangeDeliveryTime: false,
        canChangePackaging: false,
      },
    });
  }

  await prisma.company.update({ where: { id: acmeId }, data: { ownerId: 'emp-acme-001' } });
  await prisma.company.update({ where: { id: greenleafId }, data: { ownerId: 'emp-gl-001' } });
  await prisma.company.update({ where: { id: novaId }, data: { ownerId: 'emp-nova-001' } });

  await prisma.employeeDietaryTag.upsert({
    where: { employeeId_dietaryTagId: { employeeId: 'emp-nova-003', dietaryTagId: tagMap['Halal'] } },
    update: {},
    create: { employeeId: 'emp-nova-003', dietaryTagId: tagMap['Halal'] },
  });
  await prisma.employeeDietaryTag.upsert({
    where: { employeeId_dietaryTagId: { employeeId: 'emp-gl-002', dietaryTagId: tagMap['Vegan'] } },
    update: {},
    create: { employeeId: 'emp-gl-002', dietaryTagId: tagMap['Vegan'] },
  });
  await prisma.employeeAllergen.upsert({
    where: { employeeId_allergenId: { employeeId: 'emp-acme-003', allergenId: allergenMap['Nuts'] } },
    update: {},
    create: { employeeId: 'emp-acme-003', allergenId: allergenMap['Nuts'] },
  });
  await prisma.employeeAllergen.upsert({
    where: { employeeId_allergenId: { employeeId: 'emp-nova-002', allergenId: allergenMap['Dairy'] } },
    update: {},
    create: { employeeId: 'emp-nova-002', allergenId: allergenMap['Dairy'] },
  });
  console.log('  ✅ Employees seeded');
}

async function seedOptions() {
  const optionData = [
    { id: 'opt-bread-white', name: 'White Bread', costPriceMinor: 20 },
    { id: 'opt-bread-whole', name: 'Wholemeal Bread', costPriceMinor: 25 },
    { id: 'opt-bread-gf', name: 'Gluten-Free Bread', costPriceMinor: 60 },
    { id: 'opt-side-salad', name: 'Side Salad', costPriceMinor: 80 },
    { id: 'opt-side-fries', name: 'Skin-on Fries', costPriceMinor: 90 },
    { id: 'opt-side-fruit', name: 'Seasonal Fruit', costPriceMinor: 70 },
    { id: 'opt-sauce-chilli', name: 'Chilli Sauce', costPriceMinor: 10 },
    { id: 'opt-sauce-mayo', name: 'Mayonnaise', costPriceMinor: 10 },
    { id: 'opt-sauce-vegan-mayo', name: 'Vegan Mayo', costPriceMinor: 15 },
    { id: 'opt-protein-chicken', name: 'Grilled Chicken', costPriceMinor: 150 },
    { id: 'opt-protein-halloumi', name: 'Grilled Halloumi', costPriceMinor: 120 },
    { id: 'opt-protein-falafel', name: 'Falafel', costPriceMinor: 100 },
  ];

  for (const option of optionData) {
    await prisma.option.upsert({
      where: { id: option.id },
      update: { name: option.name, costPriceMinor: option.costPriceMinor },
      create: option,
    });
  }
  console.log('  ✅ Options seeded');
  return optionData;
}

async function seedOptionGroups() {
  const breadGroup = await prisma.optionGroup.upsert({
    where: { id: 'og-bread-choice' },
    update: { name: 'Bread Choice', isRequired: true },
    create: { id: 'og-bread-choice', name: 'Bread Choice', isRequired: true },
  });

  const sideGroup = await prisma.optionGroup.upsert({
    where: { id: 'og-side-choice' },
    update: { name: 'Side', isRequired: false },
    create: { id: 'og-side-choice', name: 'Side', isRequired: false },
  });

  const sauceGroup = await prisma.optionGroup.upsert({
    where: { id: 'og-sauce-choice' },
    update: { name: 'Sauce', isRequired: false },
    create: { id: 'og-sauce-choice', name: 'Sauce', isRequired: false },
  });

  const proteinGroup = await prisma.optionGroup.upsert({
    where: { id: 'og-protein-upgrade' },
    update: { name: 'Protein Upgrade', isRequired: false },
    create: { id: 'og-protein-upgrade', name: 'Protein Upgrade', isRequired: false },
  });

  const ogOptionData = [
    { id: 'ogo-bread-white', optionGroupId: breadGroup.id, optionId: 'opt-bread-white', displayOrder: 1, extraChargeMinor: 0 },
    { id: 'ogo-bread-whole', optionGroupId: breadGroup.id, optionId: 'opt-bread-whole', displayOrder: 2, extraChargeMinor: 0 },
    { id: 'ogo-bread-gf', optionGroupId: breadGroup.id, optionId: 'opt-bread-gf', displayOrder: 3, extraChargeMinor: 50 },
    { id: 'ogo-side-salad', optionGroupId: sideGroup.id, optionId: 'opt-side-salad', displayOrder: 1, extraChargeMinor: 0 },
    { id: 'ogo-side-fries', optionGroupId: sideGroup.id, optionId: 'opt-side-fries', displayOrder: 2, extraChargeMinor: 100 },
    { id: 'ogo-side-fruit', optionGroupId: sideGroup.id, optionId: 'opt-side-fruit', displayOrder: 3, extraChargeMinor: 0 },
    { id: 'ogo-sauce-chilli', optionGroupId: sauceGroup.id, optionId: 'opt-sauce-chilli', displayOrder: 1, extraChargeMinor: 0 },
    { id: 'ogo-sauce-mayo', optionGroupId: sauceGroup.id, optionId: 'opt-sauce-mayo', displayOrder: 2, extraChargeMinor: 0 },
    { id: 'ogo-sauce-vegan-mayo', optionGroupId: sauceGroup.id, optionId: 'opt-sauce-vegan-mayo', displayOrder: 3, extraChargeMinor: 0 },
    { id: 'ogo-protein-chicken', optionGroupId: proteinGroup.id, optionId: 'opt-protein-chicken', displayOrder: 1, extraChargeMinor: 150 },
    { id: 'ogo-protein-halloumi', optionGroupId: proteinGroup.id, optionId: 'opt-protein-halloumi', displayOrder: 2, extraChargeMinor: 120 },
    { id: 'ogo-protein-falafel', optionGroupId: proteinGroup.id, optionId: 'opt-protein-falafel', displayOrder: 3, extraChargeMinor: 100 },
  ];

  for (const item of ogOptionData) {
    await prisma.optionGroupOption.upsert({
      where: { id: item.id },
      update: { displayOrder: item.displayOrder, extraChargeMinor: item.extraChargeMinor },
      create: item,
    });
  }
  console.log('  ✅ Option groups seeded');
  return { breadGroup, sideGroup, sauceGroup, proteinGroup };
}

async function seedDishAssignments({ breadGroup, sideGroup, sauceGroup, proteinGroup }: {
  breadGroup: { id: string };
  sideGroup: { id: string };
  sauceGroup: { id: string };
  proteinGroup: { id: string };
}) {
  const dishOgData = [
    { id: 'dog-dish-chicken-sandwich-bread', dishId: 'dish-chicken-sandwich', optionGroupId: breadGroup.id, displayOrder: 1 },
    { id: 'dog-dish-chicken-sandwich-side', dishId: 'dish-chicken-sandwich', optionGroupId: sideGroup.id, displayOrder: 2 },
    { id: 'dog-dish-chicken-sandwich-sauce', dishId: 'dish-chicken-sandwich', optionGroupId: sauceGroup.id, displayOrder: 3 },
    { id: 'dog-dish-falafel-wrap-bread', dishId: 'dish-falafel-wrap', optionGroupId: breadGroup.id, displayOrder: 1 },
    { id: 'dog-dish-falafel-wrap-side', dishId: 'dish-falafel-wrap', optionGroupId: sideGroup.id, displayOrder: 2 },
    { id: 'dog-dish-falafel-wrap-sauce', dishId: 'dish-falafel-wrap', optionGroupId: sauceGroup.id, displayOrder: 3 },
    { id: 'dog-dish-butter-chicken-side', dishId: 'dish-butter-chicken', optionGroupId: sideGroup.id, displayOrder: 1 },
    { id: 'dog-dish-butter-chicken-sauce', dishId: 'dish-butter-chicken', optionGroupId: sauceGroup.id, displayOrder: 2 },
    { id: 'dog-dish-dal-makhani-side', dishId: 'dish-dal-makhani', optionGroupId: sideGroup.id, displayOrder: 1 },
    { id: 'dog-dish-dal-makhani-sauce', dishId: 'dish-dal-makhani', optionGroupId: sauceGroup.id, displayOrder: 2 },
    { id: 'dog-dish-thai-green-curry-side', dishId: 'dish-thai-green-curry', optionGroupId: sideGroup.id, displayOrder: 1 },
    { id: 'dog-dish-thai-green-curry-sauce', dishId: 'dish-thai-green-curry', optionGroupId: sauceGroup.id, displayOrder: 2 },
    { id: 'dog-dish-beef-stir-fry-side', dishId: 'dish-beef-stir-fry', optionGroupId: sideGroup.id, displayOrder: 1 },
    { id: 'dog-dish-beef-stir-fry-sauce', dishId: 'dish-beef-stir-fry', optionGroupId: sauceGroup.id, displayOrder: 2 },
    { id: 'dog-dish-caesar-salad-protein', dishId: 'dish-caesar-salad', optionGroupId: proteinGroup.id, displayOrder: 1 },
    { id: 'dog-dish-quinoa-bowl-protein', dishId: 'dish-quinoa-bowl', optionGroupId: proteinGroup.id, displayOrder: 1 },
    { id: 'dog-dish-grilled-salmon-side', dishId: 'dish-grilled-salmon', optionGroupId: sideGroup.id, displayOrder: 1 },
  ];

  for (const dishOption of dishOgData) {
    await prisma.dishOptionGroup.upsert({
      where: { id: dishOption.id },
      update: { displayOrder: dishOption.displayOrder },
      create: dishOption,
    });
  }
  console.log('  ✅ Dish option groups attached');
}

async function seedDishes({ hotStation, coldStation, grillStation, allergenMap, tagMap }: {
  hotStation: { id: string };
  coldStation: { id: string };
  grillStation: { id: string };
  allergenMap: Record<string, string>;
  tagMap: Record<string, string>;
}) {
  const dishData = [
    { id: 'dish-butter-chicken', sku: 'HOT-001', name: 'Butter Chicken', description: 'Slow-cooked chicken in rich tomato and butter sauce, served with basmati rice', temperature: 'HOT' as const, costPriceMinor: 310, stationId: hotStation.id, allergens: ['Dairy', 'Gluten'], tags: ['Halal'] },
    { id: 'dish-dal-makhani', sku: 'HOT-002', name: 'Dal Makhani', description: 'Creamy black lentils slow-cooked with butter and spices', temperature: 'HOT' as const, costPriceMinor: 230, stationId: hotStation.id, allergens: ['Dairy'], tags: ['Vegetarian', 'Halal', 'Gluten-Free'] },
    { id: 'dish-thai-green-curry', sku: 'HOT-003', name: 'Thai Green Curry', description: 'Fragrant chicken in coconut green curry with jasmine rice', temperature: 'HOT' as const, costPriceMinor: 290, stationId: hotStation.id, allergens: ['Nuts', 'Shellfish'], tags: ['Halal', 'Gluten-Free'] },
    { id: 'dish-grilled-salmon', sku: 'GRILL-001', name: 'Grilled Salmon', description: 'Atlantic salmon fillet with lemon herb butter and seasonal greens', temperature: 'HOT' as const, costPriceMinor: 420, stationId: grillStation.id, allergens: ['Fish', 'Dairy'], tags: ['Gluten-Free', 'High-Protein', 'Low-Carb'] },
    { id: 'dish-chicken-sandwich', sku: 'GRILL-002', name: 'Grilled Chicken Sandwich', description: 'Marinated grilled chicken breast with lettuce, tomato and pickles', temperature: 'HOT' as const, costPriceMinor: 260, stationId: grillStation.id, allergens: ['Gluten', 'Eggs'], tags: ['Halal', 'High-Protein'] },
    { id: 'dish-caesar-salad', sku: 'COLD-001', name: 'Classic Caesar Salad', description: 'Cos lettuce, parmesan, croutons and house Caesar dressing', temperature: 'COLD' as const, costPriceMinor: 200, stationId: coldStation.id, allergens: ['Gluten', 'Dairy', 'Eggs', 'Fish'], tags: ['Vegetarian'] },
    { id: 'dish-falafel-wrap', sku: 'COLD-002', name: 'Falafel & Hummus Wrap', description: 'Crispy falafel with hummus, tabbouleh and pickled turnip in a flatbread', temperature: 'COLD' as const, costPriceMinor: 210, stationId: coldStation.id, allergens: ['Gluten', 'Sesame'], tags: ['Vegan', 'Vegetarian'] },
    { id: 'dish-quinoa-bowl', sku: 'COLD-003', name: 'Rainbow Quinoa Bowl', description: 'Tri-colour quinoa with roasted vegetables, avocado and tahini dressing', temperature: 'COLD' as const, costPriceMinor: 240, stationId: coldStation.id, allergens: ['Sesame', 'Nuts'], tags: ['Vegan', 'Gluten-Free', 'High-Protein'] },
    { id: 'dish-beef-stir-fry', sku: 'HOT-004', name: 'Beef & Broccoli Stir-Fry', description: 'Tender beef strips with broccoli in oyster sauce over egg fried rice', temperature: 'HOT' as const, costPriceMinor: 330, stationId: hotStation.id, allergens: ['Soy', 'Gluten', 'Eggs', 'Shellfish'], tags: ['High-Protein'] },
  ];

  for (const dish of dishData) {
    await prisma.dish.upsert({
      where: { id: dish.id },
      update: { name: dish.name, description: dish.description, temperature: dish.temperature, stationId: dish.stationId },
      create: { id: dish.id, sku: dish.sku, name: dish.name, description: dish.description, temperature: dish.temperature, costPriceMinor: dish.costPriceMinor, stationId: dish.stationId, isActive: true },
    });

    for (const allergenName of dish.allergens) {
      await prisma.dishAllergen.upsert({
        where: { dishId_allergenId: { dishId: dish.id, allergenId: allergenMap[allergenName] } },
        update: {},
        create: { dishId: dish.id, allergenId: allergenMap[allergenName] },
      });
    }

    for (const tagName of dish.tags) {
      await prisma.dishDietaryTag.upsert({
        where: { dishId_dietaryTagId: { dishId: dish.id, dietaryTagId: tagMap[tagName] } },
        update: {},
        create: { dishId: dish.id, dietaryTagId: tagMap[tagName] },
      });
    }
  }

  console.log('  ✅ Dishes seeded');
  return { dishData };
}

async function seedCategories() {
  const catData = [
    { id: 'cat-hot-mains', name: 'Hot Mains', displayOrder: 1 },
    { id: 'cat-grill', name: 'From the Grill', displayOrder: 2 },
    { id: 'cat-cold-light', name: 'Cold & Light', displayOrder: 3 },
    { id: 'cat-vegan', name: 'Vegan Picks', displayOrder: 4 },
    { id: 'cat-high-protein', name: 'High Protein', displayOrder: 5 },
  ];

  for (const category of catData) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: { name: category.name, displayOrder: category.displayOrder },
      create: { id: category.id, name: category.name, displayOrder: category.displayOrder, isActive: true },
    });
  }

  const catDishData = [
    { id: 'cd-hm-bc', categoryId: 'cat-hot-mains', dishId: 'dish-butter-chicken', displayOrder: 1 },
    { id: 'cd-hm-dm', categoryId: 'cat-hot-mains', dishId: 'dish-dal-makhani', displayOrder: 2 },
    { id: 'cd-hm-tgc', categoryId: 'cat-hot-mains', dishId: 'dish-thai-green-curry', displayOrder: 3 },
    { id: 'cd-hm-bsf', categoryId: 'cat-hot-mains', dishId: 'dish-beef-stir-fry', displayOrder: 4 },
    { id: 'cd-gr-gs', categoryId: 'cat-grill', dishId: 'dish-grilled-salmon', displayOrder: 1 },
    { id: 'cd-gr-cs', categoryId: 'cat-grill', dishId: 'dish-chicken-sandwich', displayOrder: 2 },
    { id: 'cd-cl-cae', categoryId: 'cat-cold-light', dishId: 'dish-caesar-salad', displayOrder: 1 },
    { id: 'cd-cl-fw', categoryId: 'cat-cold-light', dishId: 'dish-falafel-wrap', displayOrder: 2 },
    { id: 'cd-cl-qb', categoryId: 'cat-cold-light', dishId: 'dish-quinoa-bowl', displayOrder: 3 },
    { id: 'cd-vg-fw', categoryId: 'cat-vegan', dishId: 'dish-falafel-wrap', displayOrder: 1 },
    { id: 'cd-vg-qb', categoryId: 'cat-vegan', dishId: 'dish-quinoa-bowl', displayOrder: 2 },
    { id: 'cd-hp-gs', categoryId: 'cat-high-protein', dishId: 'dish-grilled-salmon', displayOrder: 1 },
    { id: 'cd-hp-cs', categoryId: 'cat-high-protein', dishId: 'dish-chicken-sandwich', displayOrder: 2 },
    { id: 'cd-hp-bsf', categoryId: 'cat-high-protein', dishId: 'dish-beef-stir-fry', displayOrder: 3 },
    { id: 'cd-hp-qb', categoryId: 'cat-high-protein', dishId: 'dish-quinoa-bowl', displayOrder: 4 },
  ];

  for (const item of catDishData) {
    await prisma.categoryDish.upsert({
      where: { id: item.id },
      update: { displayOrder: item.displayOrder },
      create: { id: item.id, categoryId: item.categoryId, dishId: item.dishId, displayOrder: item.displayOrder, isActive: true },
    });
  }
  console.log('  ✅ Categories seeded');
}

async function seedPrices({ dishData, optionData, standardTier, enterpriseTier, partnerTier }: {
  dishData: Array<{ id: string; costPriceMinor: number }>;
  optionData: Array<{ id: string; costPriceMinor: number }>;
  standardTier: { id: string };
  enterpriseTier: { id: string };
  partnerTier: { id: string };
}) {
  const tiers = [
    { tier: standardTier, multiplier: 2.8 },
    { tier: enterpriseTier, multiplier: 2.4 },
    { tier: partnerTier, multiplier: 3.2 },
  ];

  for (const dish of dishData) {
    for (const { tier, multiplier } of tiers) {
      await prisma.dishPrice.upsert({
        where: { id: `dp-${dish.id}-${tier.id}` },
        update: { priceMinor: Math.round(dish.costPriceMinor * multiplier) },
        create: { id: `dp-${dish.id}-${tier.id}`, dishId: dish.id, priceTierId: tier.id, priceMinor: Math.round(dish.costPriceMinor * multiplier) },
      });
    }
  }

  for (const option of optionData) {
    for (const { tier, multiplier } of tiers) {
      await prisma.optionPrice.upsert({
        where: { id: `op-${option.id}-${tier.id}` },
        update: { priceMinor: Math.round(option.costPriceMinor * multiplier) },
        create: { id: `op-${option.id}-${tier.id}`, optionId: option.id, priceTierId: tier.id, priceMinor: Math.round(option.costPriceMinor * multiplier) },
      });
    }
  }
  console.log('  ✅ Dish & option prices seeded');
}

async function seedPlatformSettings() {
  await prisma.platformSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', kitchenTimeZone: 'Europe/London', cutOffTime: '16:00', cutOffWorkingDays: 2, dispatchLeadMinutes: 60, kitchenReadyBufferMinutes: 30 },
  });
}

async function seedHolidays({ greenleafId, novaId }: { greenleafId: string; novaId: string }) {
  const kitchenHolidays = [
    { id: 'kh-xmas-2026', date: new Date('2026-12-25'), name: 'Christmas Day' },
    { id: 'kh-boxing-2026', date: new Date('2026-12-26'), name: 'Boxing Day' },
    { id: 'kh-ny-2027', date: new Date('2027-01-01'), name: "New Year's Day" },
  ];

  for (const holiday of kitchenHolidays) {
    await prisma.kitchenHoliday.upsert({
      where: { id: holiday.id },
      update: { name: holiday.name },
      create: holiday,
    });
  }

  await prisma.companyHoliday.upsert({
    where: { companyId_date: { companyId: novaId, date: new Date('2027-04-02') } },
    update: {},
    create: { companyId: novaId, date: new Date('2027-04-02'), name: 'Good Friday' },
  });
  await prisma.companyHoliday.upsert({
    where: { companyId_date: { companyId: greenleafId, date: new Date('2026-10-20') } },
    update: {},
    create: { companyId: greenleafId, date: new Date('2026-10-20'), name: 'Diwali' },
  });
  console.log('  ✅ Platform settings & holidays seeded');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
