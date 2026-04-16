// @ts-nocheck
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) { console.error('No DATABASE_URL'); process.exit(1) }

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const hash = await bcrypt.hash('Test1234', 10)
  try {
    const user = await prisma.user.create({
      data: {
        email: 'qa-dispatcher@test.com',
        password: hash,
        name: 'QA測試派單方',
        phone: '0912-345-678',
        role: 'DISPATCHER',
        emailVerified: true,
        accountStatus: 'ACTIVE',
      }
    })
    const dispatcher = await prisma.dispatcher.create({
      data: {
        userId: user.id,
        companyName: 'QA測試車隊',
        commissionRate: 0,
      }
    })
    console.log('CREATED:', user.email, user.id, dispatcher.id)
  } catch(e) {
    if (e.code === 'P2002') {
      const existing = await prisma.user.findUnique({ where: { email: 'qa-dispatcher@test.com' } })
      console.log('EXISTS:', existing?.id, existing?.email, existing?.role)
    } else {
      console.error('ERROR:', e.message)
    }
  }
}
main().finally(() => { prisma.$disconnect(); process.exit(0) })
