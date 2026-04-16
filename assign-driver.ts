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
  // Find a driver
  const driver = await prisma.driver.findFirst({
    where: { licensePlate: 'ABC-1234' },
    include: { user: true }
  })
  if (!driver) { console.log('Driver ABC-1234 not found'); return }
  console.log('Using driver:', driver.licensePlate, driver.user.name)

  // Find QA dispatcher
  const dispatcher = await prisma.dispatcher.findFirst({
    where: { companyName: 'QA測試車隊' }
  })
  if (!dispatcher) { console.log('QA dispatcher not found'); return }
  console.log('Using dispatcher:', dispatcher.id)

  // Create an order with this driver assigned
  const order = await prisma.order.create({
    data: {
      orderDate: '20260416',
      orderSeq: 1,
      dispatcherId: dispatcher.id,
      driverId: driver.id,
      passengerName: '測試乘客',
      passengerPhone: '0912-345-678',
      pickupLocation: '桃園機場',
      dropoffLocation: '台北市',
      passengerCount: 2,
      luggageCount: 2,
      scheduledTime: new Date('2026-04-17T10:00:00'),
      price: 1500,
      type: 'pickup',
      vehicle: 'small',
      plateType: 'any',
      status: 'ACCEPTED', // Driver already assigned and accepted
    }
  })
  console.log('Created order:', order.id, 'status:', order.status)
}
main().finally(() => { prisma.$disconnect(); process.exit(0) })
