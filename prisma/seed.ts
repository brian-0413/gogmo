import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Check if test users already exist (idempotent - skip if already seeded)
  const existingDriver = await prisma.user.findUnique({ where: { email: 'driver1@test.com' } })
  if (existingDriver) {
    console.log('ℹ️  Seed data already exists, skipping...')
    console.log('   To re-seed, manually delete the test users first.')
    return
  }

  console.log('✅ No existing seed data, proceeding...')

  // Hash password for test users
  const hashedPassword = await bcrypt.hash('test123', 12)

  // ========== Create Dispatchers (派單方) ==========
  const dispatcherUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'dispatcher1@test.com',
        password: hashedPassword,
        name: '張小明',
        phone: '0912345678',
        role: 'DISPATCHER',
        dispatcher: {
          create: {
            companyName: '快速機場接送',
            commissionRate: 0,
          },
        },
      },
      include: { dispatcher: true },
    }),
    prisma.user.create({
      data: {
        email: 'dispatcher2@test.com',
        password: hashedPassword,
        name: '李小華',
        phone: '0923456789',
        role: 'DISPATCHER',
        dispatcher: {
          create: {
            companyName: '優質機場接送',
            commissionRate: 0,
          },
        },
      },
      include: { dispatcher: true },
    }),
  ])

  console.log(`✅ Created ${dispatcherUsers.length} dispatchers`)

  // ========== Create Drivers (司機) ==========
  const driverUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'driver1@test.com',
        password: hashedPassword,
        name: '王小明',
        phone: '0933456789',
        role: 'DRIVER',
        driver: {
          create: {
            licensePlate: 'ABC-1234',
            carType: '轎車',
            carColor: '黑色',
            balance: 500,
            status: 'ONLINE',
          },
        },
      },
      include: { driver: true },
    }),
    prisma.user.create({
      data: {
        email: 'driver2@test.com',
        password: hashedPassword,
        name: '陳大明',
        phone: '0944567890',
        role: 'DRIVER',
        driver: {
          create: {
            licensePlate: 'DEF-5678',
            carType: 'SUV',
            carColor: '白色',
            balance: 1200,
            status: 'ONLINE',
          },
        },
      },
      include: { driver: true },
    }),
    prisma.user.create({
      data: {
        email: 'driver3@test.com',
        password: hashedPassword,
        name: '劉美麗',
        phone: '0955678901',
        role: 'DRIVER',
        driver: {
          create: {
            licensePlate: 'GHI-9012',
            carType: '福祉車',
            carColor: '銀色',
            balance: 800,
            status: 'ONLINE',
          },
        },
      },
      include: { driver: true },
    }),
    prisma.user.create({
      data: {
        email: 'driver4@test.com',
        password: hashedPassword,
        name: '黃志偉',
        phone: '0966789012',
        role: 'DRIVER',
        driver: {
          create: {
            licensePlate: 'JKL-3456',
            carType: '轎車',
            carColor: '藍色',
            balance: 300,
            status: 'OFFLINE',
          },
        },
      },
      include: { driver: true },
    }),
    prisma.user.create({
      data: {
        email: 'driver5@test.com',
        password: hashedPassword,
        name: '周雅文',
        phone: '0977890123',
        role: 'DRIVER',
        driver: {
          create: {
            licensePlate: 'MNO-7890',
            carType: 'SUV',
            carColor: '灰色',
            balance: 2000,
            status: 'ONLINE',
          },
        },
      },
      include: { driver: true },
    }),
  ])

  console.log(`✅ Created ${driverUsers.length} drivers`)

  const drivers = driverUsers.map(u => u.driver!)
  const dispatchers = dispatcherUsers.map(u => u.dispatcher!)

  // ========== Create Orders (訂單) ==========
  const now = new Date()
  const oneHour = 60 * 60 * 1000
  const oneDay = 24 * oneHour

  const orders = await Promise.all([
    // PUBLISHED orders (可搶單)
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        status: 'PUBLISHED',
        passengerName: '林先生',
        passengerPhone: '0988901234',
        flightNumber: 'CI101',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園市大園區航站南路 1 號',
        dropoffLocation: '台北市信義區',
        dropoffAddress: '台北市信義區市府路 1 號',
        passengerCount: 2,
        luggageCount: 2,
        scheduledTime: new Date(now.getTime() + 2 * oneHour),
        price: 1200,
        note: '需要兒童座椅',
      },
    }),
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        status: 'PUBLISHED',
        passengerName: '張小姐',
        passengerPhone: '0988902345',
        flightNumber: 'BR852',
        pickupLocation: '桃園機場第二航廈',
        pickupAddress: '桃園市大園區航站北路 2 號',
        dropoffLocation: '新北市板橋區',
        dropoffAddress: '新北市板橋區中山路 100 號',
        passengerCount: 1,
        luggageCount: 1,
        scheduledTime: new Date(now.getTime() + 3 * oneHour),
        price: 1100,
      },
    }),
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[1].id,
        status: 'PUBLISHED',
        passengerName: '王先生',
        passengerPhone: '0988903456',
        flightNumber: 'AE991',
        pickupLocation: '松山機場',
        pickupAddress: '台北市松山區敦化北路 399 號',
        dropoffLocation: '基隆市暖暖區',
        dropoffAddress: '基隆市暖暖區暖暖街 88 號',
        passengerCount: 3,
        luggageCount: 4,
        scheduledTime: new Date(now.getTime() + 1.5 * oneHour),
        price: 1500,
        note: '有很多行李',
      },
    }),

    // ASSIGNED orders (已指派司機)
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        driverId: drivers[0].id,
        status: 'ASSIGNED',
        passengerName: '陳太太',
        passengerPhone: '0988904567',
        flightNumber: 'JL99',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園市大園區航站南路 1 號',
        dropoffLocation: '桃園市龜山區',
        dropoffAddress: '桃園市龜山區文化一路 200 號',
        passengerCount: 2,
        luggageCount: 2,
        scheduledTime: new Date(now.getTime() + 30 * 60 * 1000),
        price: 800,
      },
    }),

    // ACCEPTED orders (司機已接單)
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        driverId: drivers[1].id,
        status: 'ACCEPTED',
        passengerName: '黃先生',
        passengerPhone: '0988905678',
        flightNumber: 'NH1234',
        pickupLocation: '桃園機場第二航廈',
        pickupAddress: '桃園市大園區航站北路 2 號',
        dropoffLocation: '新竹市東區',
        dropoffAddress: '新竹市東區光復路 1 段 100 號',
        passengerCount: 1,
        luggageCount: 1,
        scheduledTime: new Date(now.getTime() + 4 * oneHour),
        price: 1800,
      },
    }),
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[1].id,
        driverId: drivers[2].id,
        status: 'ACCEPTED',
        passengerName: '林小姐',
        passengerPhone: '0988906789',
        flightNumber: 'CX451',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園市大園區航站南路 1 號',
        dropoffLocation: '台中市西屯區',
        dropoffAddress: '台中市西屯區台灣大道 100 號',
        passengerCount: 4,
        luggageCount: 3,
        scheduledTime: new Date(now.getTime() + 5 * oneHour),
        price: 2500,
        note: '家族旅行',
      },
    }),

    // ARRIVED orders (司機已抵達)
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        driverId: drivers[0].id,
        status: 'ARRIVED',
        passengerName: '許先生',
        passengerPhone: '0988907890',
        flightNumber: 'SQ876',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園市大園區航站南路 1 號',
        dropoffLocation: '台北市大安區',
        dropoffAddress: '台北市大安區新生南路 200 號',
        passengerCount: 2,
        luggageCount: 2,
        scheduledTime: new Date(now.getTime() - 10 * 60 * 1000), // 10 mins ago
        price: 1300,
      },
    }),

    // IN_PROGRESS orders (行程進行中)
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[1].id,
        driverId: drivers[4].id,
        status: 'IN_PROGRESS',
        passengerName: '楊太太',
        passengerPhone: '0988908901',
        flightNumber: 'EK366',
        pickupLocation: '桃園機場第二航廈',
        pickupAddress: '桃園市大園區航站北路 2 號',
        dropoffLocation: '高雄市左營區',
        dropoffAddress: '高雄市左營區高鐵路 100 號',
        passengerCount: 3,
        luggageCount: 5,
        scheduledTime: new Date(now.getTime() - 30 * 60 * 1000),
        price: 3500,
        note: '需要大型行李廂',
      },
    }),

    // COMPLETED orders (已完成)
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        driverId: drivers[1].id,
        status: 'COMPLETED',
        passengerName: '柯先生',
        passengerPhone: '0988909012',
        flightNumber: 'BR857',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園市大園區航站南路 1 號',
        dropoffLocation: '台北市中山區',
        dropoffAddress: '台北市中山區南京西路 50 號',
        passengerCount: 1,
        luggageCount: 1,
        scheduledTime: new Date(now.getTime() - 2 * oneHour),
        completedAt: new Date(now.getTime() - 1.5 * oneHour),
        price: 1100,
      },
    }),
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        driverId: drivers[0].id,
        status: 'COMPLETED',
        passengerName: '賴小姐',
        passengerPhone: '0988900123',
        flightNumber: 'CI11',
        pickupLocation: '桃園機場第二航廈',
        pickupAddress: '桃園市大園區航站北路 2 號',
        dropoffLocation: '新北市中和區',
        dropoffAddress: '新北市中和區中山路 300 號',
        passengerCount: 2,
        luggageCount: 2,
        scheduledTime: new Date(now.getTime() - 4 * oneHour),
        completedAt: new Date(now.getTime() - 3 * oneHour),
        price: 1000,
      },
    }),
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[1].id,
        driverId: drivers[2].id,
        status: 'COMPLETED',
        passengerName: '施先生',
        passengerPhone: '0988901235',
        flightNumber: 'JL1',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園市大園區航站南路 1 號',
        dropoffLocation: '彰化縣彰化市',
        dropoffAddress: '彰化縣彰化市中山路 150 號',
        passengerCount: 3,
        luggageCount: 3,
        scheduledTime: new Date(now.getTime() - 6 * oneHour),
        completedAt: new Date(now.getTime() - 5 * oneHour),
        price: 2200,
      },
    }),

    // More PUBLISHED for tomorrow
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[0].id,
        status: 'PUBLISHED',
        passengerName: '沈先生',
        passengerPhone: '0988902346',
        flightNumber: 'NH587',
        pickupLocation: '桃園機場第一航廈',
        pickupAddress: '桃園市大園區航站南路 1 號',
        dropoffLocation: '宜蘭縣宜蘭市',
        dropoffAddress: '宜蘭縣宜蘭市中山路 88 號',
        passengerCount: 2,
        luggageCount: 2,
        scheduledTime: new Date(now.getTime() + oneDay + oneHour),
        price: 1600,
      },
    }),
    prisma.order.create({
      data: {
        dispatcherId: dispatchers[1].id,
        status: 'PUBLISHED',
        passengerName: '孫小姐',
        passengerPhone: '0988903457',
        flightNumber: 'BR135',
        pickupLocation: '桃園機場第二航廈',
        pickupAddress: '桃園市大園區航站北路 2 號',
        dropoffLocation: '花蓮縣花蓮市',
        dropoffAddress: '花蓮縣花蓮市中山路 200 號',
        passengerCount: 4,
        luggageCount: 6,
        scheduledTime: new Date(now.getTime() + oneDay + 3 * oneHour),
        price: 3000,
        note: '國旅旅客，行李多',
      },
    }),
  ])

  console.log(`✅ Created ${orders.length} orders`)

  // Create transactions for completed orders
  const completedOrders = orders.filter(o => o.status === 'COMPLETED')
  for (const order of completedOrders) {
    const platformFee = Math.floor(order.price * 0.05)
    await prisma.transaction.createMany({
      data: [
        {
          orderId: order.id,
          driverId: order.driverId!,
          amount: order.price - platformFee,
          type: 'RIDE_FARE',
          status: 'SETTLED',
          description: `行程收入 - 訂單 #${order.id.slice(0, 8)}`,
        },
        {
          orderId: order.id,
          driverId: order.driverId!,
          amount: -platformFee,
          type: 'PLATFORM_FEE',
          status: 'SETTLED',
          description: '平台費 (5%)',
        },
      ],
    })
  }

  console.log(`✅ Created ${completedOrders.length * 2} transactions for completed orders`)

  // Summary
  console.log('\n========================================')
  console.log('🎉 Seed completed successfully!')
  console.log('========================================')
  console.log('\n📋 Test Accounts:')
  console.log('----------------------------------------')
  console.log('【派單方 (Dispatchers)】')
  dispatcherUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} / test123 (${u.name})`)
  })
  console.log('\n【司機 (Drivers)】')
  driverUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} / test123 (${u.name}, ${u.driver!.licensePlate}, ${u.driver!.balance} 點)`)
  })
  console.log('\n========================================')
  console.log(`📊 Stats: ${dispatcherUsers.length} dispatchers, ${driverUsers.length} drivers, ${orders.length} orders`)
  console.log('========================================\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
