require('dotenv').config({ override: true });
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const url = process.env.DATABASE_URL;
const sslUrl = url.includes('sslmode') ? url.replace(/sslmode=[^&]*/g, 'sslmode=no-verify') : url + (url.includes('?') ? '&' : '?') + 'sslmode=no-verify';
const pool = new pg.Pool({ connectionString: sslUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2] || 'admin@goGMO.com';
  const password = process.argv[3] || 'Admin1234';
  const name = process.argv[4] || '系統管理員';

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, name },
    create: {
      email,
      password: hashed,
      name,
      phone: '0000000000',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    },
  });

  // Also create admin record if not exists
  await prisma.admin.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log('Admin created/updated:');
  console.log('  Email:', email);
  console.log('  Password:', password);
  console.log('  Name:', name);
  console.log('\n登入方式：選擇「派單方」Tab，使用上述 Email + 密碼即可進入 /dashboard/admin');

  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
