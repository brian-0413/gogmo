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
    // Find driver ABC-1234
    const driver = await prisma.driver.findFirst({
      where: { licensePlate: 'ABC-1234' },
      include: { user: true }
    })
    console.log('Driver:', driver.licensePlate, driver.user.name, '| ID:', driver.id)

    // Use the dispatcher ID from create-test-user.ts
    const dispatcherId = '9422cf1b-7fb0-4edd-be0f-b65cd6568577'

    // Create order with ACCEPTED status and assigned driver
    const order = await prisma.order.create({
      data: {
        orderDate: '20260416',
        orderSeq: 2,
        dispatcherId: dispatcherId,
        driverId: driver.id,
        passengerName: '測試乘客',
        passengerPhone: '0912-345-678',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園機場第一航廈',
        dropoffLocation: '台北市信義區',
        dropoffAddress: '台北市信義區',
        passengerCount: 2,
        luggageCount: 2,
        scheduledTime: new Date('2026-04-17T10:00:00'),
        price: 1500,
        type: 'pickup',
        vehicle: 'small',
        plateType: 'any',
        status: 'ACCEPTED',
      }
    })
    console.log('Created order:', order.id, '| status:', order.status)
  } catch(e) {
    console.error('Error:', e.message)
  }
}
main().finally(() => { prisma.$disconnect(); process.exit(0) })
