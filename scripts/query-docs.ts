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
  const docs = await prisma.userDocument.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('Total documents:', docs.length);
  docs.forEach((d, i) => {
    console.log('-- Doc', i+1, '---');
    console.log('  User:', d.userId);
    console.log('  Type:', d.type);
    console.log('  FileName:', d.fileName);
    console.log('  fileUrl:', d.fileUrl || '(none)');
    console.log('  driveFileId:', d.driveFileId || '(none)');
    console.log('  uploadFailed:', d.uploadFailed);
    console.log('  status:', d.status);
    console.log('  Created:', d.createdAt);
  });
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
