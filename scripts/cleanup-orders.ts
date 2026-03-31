import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting cleanup...')

  // Delete all transactions first (due to foreign key)
  const txCount = await prisma.transaction.deleteMany({})
  console.log(`Deleted ${txCount.count} transactions`)

  // Delete all orders
  const orderCount = await prisma.order.deleteMany({})
  console.log(`Deleted ${orderCount.count} orders`)

  console.log('Cleanup completed!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
