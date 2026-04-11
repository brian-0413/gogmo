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
  // Delete in correct order (respecting foreign keys)
  await prisma.userDocument.deleteMany({ where: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } });
  console.log('Deleted userDocuments');

  await prisma.transaction.deleteMany({ where: { driver: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted transactions');

  await prisma.orderTransfer.deleteMany({ where: { order: { dispatcher: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } } });
  console.log('Deleted orderTransfers (via order->dispatcher)');

  await prisma.orderTransfer.deleteMany({ where: { fromDriver: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted orderTransfers (via fromDriver)');

  await prisma.orderTransfer.deleteMany({ where: { toDriver: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted orderTransfers (via toDriver)');

  await prisma.squadInvite.deleteMany({ where: { driver: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted squadInvites');

  await prisma.squadMember.deleteMany({ where: { driver: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted squadMembers');

  await prisma.order.deleteMany({ where: { dispatcher: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted orders (via dispatcher)');

  await prisma.order.deleteMany({ where: { driver: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted orders (via driver)');

  await prisma.squad.deleteMany({ where: { founder: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } } });
  console.log('Deleted squads');

  await prisma.driver.deleteMany({ where: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } });
  console.log('Deleted drivers');

  await prisma.dispatcher.deleteMany({ where: { user: { role: { in: ['DRIVER', 'DISPATCHER'] } } } });
  console.log('Deleted dispatchers');

  const { count } = await prisma.user.deleteMany({ where: { role: { in: ['DRIVER', 'DISPATCHER'] } } });
  console.log('Deleted', count, 'users (drivers + dispatchers)');

  // Count remaining
  const remaining = await prisma.user.count();
  console.log('Remaining users:', remaining);

  await prisma.$disconnect();
  console.log('Done.');
}
main().catch(e => { console.error(e.message); process.exit(1); });
