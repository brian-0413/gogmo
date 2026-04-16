// @ts-nocheck
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) { console.error('No DATABASE_URL'); process.exit(1) }
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const drivers = await prisma.driver.findMany({
    take: 5,
    include: { user: true }
  })
  if (drivers.length === 0) {
    console.log('No drivers found')
  } else {
    for (const d of drivers) {
      console.log('Driver:', d.licensePlate, d.carType, '| User:', d.user?.name, d.user?.email)
    }
  }

  const orders = await prisma.order.findMany({
    take: 5,
    where: { status: { in: ['ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'PICKED_UP', 'PUBLISHED'] } },
    include: { driver: { include: { user: true } } }
  })
  if (orders.length === 0) {
    console.log('No orders with drivers')
  } else {
    for (const o of orders) {
      console.log('Order:', o.id, o.status, '| Driver:', o.driver?.licensePlate, o.driver?.user?.name)
    }
  }
}
main().finally(() => { prisma.$disconnect(); process.exit(0) })
