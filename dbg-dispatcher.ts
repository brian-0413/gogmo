// @ts-nocheck
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PrismaClient } from '@prisma/client'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const dispatcher = await prisma.dispatcher.findFirst()
    console.log('First dispatcher:', JSON.stringify(dispatcher))
    const allDispatchers = await prisma.dispatcher.findMany({ take: 3 })
    console.log('All dispatchers:', allDispatchers.map(d => d.companyName + ' / ' + d.userId))
  } catch(e) {
    console.error('Error:', e.message)
  }
}
main().finally(() => { prisma.$disconnect(); process.exit(0) })
