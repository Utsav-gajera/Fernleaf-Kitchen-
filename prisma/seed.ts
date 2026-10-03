import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const saltRounds = 10;
  const adminPassword = await bcrypt.hash('Admin123!', saltRounds);
  const userPassword = await bcrypt.hash('User123!', saltRounds);

  // 1. Upsert Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@starter.dev' },
    update: {
      password: adminPassword,
      role: Role.ADMIN,
    },
    create: {
      email: 'admin@starter.dev',
      password: adminPassword,
      name: 'System Admin',
      role: Role.ADMIN,
    },
  });

  // 2. Upsert standard User
  const user = await prisma.user.upsert({
    where: { email: 'user@starter.dev' },
    update: {
      password: userPassword,
      role: Role.USER,
    },
    create: {
      email: 'user@starter.dev',
      password: userPassword,
      name: 'Standard User',
      role: Role.USER,
    },
  });

  console.log('✅ Seeding completed:');
  console.log(`- Admin: ${admin.email} (Role: ${admin.role})`);
  console.log(`- User:  ${user.email} (Role: ${user.role})`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
