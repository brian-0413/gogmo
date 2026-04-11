require('dotenv').config({ override: true });
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL;
const sslUrl = url.includes('sslmode') ? url.replace(/sslmode=[^&]*/g, 'sslmode=no-verify') : url + (url.includes('?') ? '&' : '?') + 'sslmode=no-verify';
const pool = new pg.Pool({ connectionString: sslUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  console.log('Admin users:', admins.length);
  admins.forEach(a => console.log(' -', a.email));

  const all = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  console.log('\nAll users:', all.length);
  all.forEach(u => console.log(' -', u.role, ':', u.email));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
