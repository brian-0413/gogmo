import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/dispatchers/settlement - Get settlement report
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有派單方可以查看對帳表' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date filter for createdAt
    const createdAtFilter: Record<string, unknown> = {}
    if (startDate) createdAtFilter.gte = new Date(startDate + 'T00:00:00')
    if (endDate) createdAtFilter.lte = new Date(endDate + 'T23:59:59')

    // Get ALL orders in date range (for total count)
    const allOrders = await prisma.order.findMany({
      where: {
        dispatcherId: user.dispatcher?.id,
        ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
      },
    })

    // Get completed orders for transfer list
    const completedAtFilter: Record<string, unknown> = {}
    if (startDate) completedAtFilter.gte = new Date(startDate + 'T00:00:00')
    if (endDate) completedAtFilter.lte = new Date(endDate + 'T23:59:59')

    const orders = await prisma.order.findMany({
      where: {
        dispatcherId: user.dispatcher?.id,
        status: 'COMPLETED',
        ...(Object.keys(completedAtFilter).length > 0 ? { completedAt: completedAtFilter } : {}),
      },
      include: {
        driver: { include: { user: true, transactions: true } },
        transactions: true,
      },
      orderBy: { completedAt: 'desc' },
    })

    // Count pending transfer orders
    const pendingTransferCount = orders.filter(o => o.transferStatus === 'pending').length

    // Use SQL-like aggregation via Prisma
    // Calculate summary using reduce (more efficient than multiple iterations)
    const summary = orders.reduce(
      (acc, order) => {
        const platformFee = Math.floor(order.price * 0.05)
        return {
          totalOrders: acc.totalOrders + 1,
          totalRevenue: acc.totalRevenue + order.price,
          totalPlatformFee: acc.totalPlatformFee + platformFee,
          totalNetRevenue: acc.totalNetRevenue + order.price - platformFee,
        }
      },
      { totalOrders: 0, totalRevenue: 0, totalPlatformFee: 0, totalNetRevenue: 0 }
    )

    // Group by driver using reduce
    const driverMap = new Map<string, {
      driver: { id: string; name: string; licensePlate: string }
      totalOrders: number
      totalAmount: number
      platformFee: number
      netAmount: number
    }>()

    for (const order of orders) {
      if (!order.driver) continue

      const driverId = order.driver.id
      const existing = driverMap.get(driverId)
      const platformFee = Math.floor(order.price * 0.05)

      if (existing) {
        existing.totalOrders++
        existing.totalAmount += order.price
        existing.platformFee += platformFee
        existing.netAmount += order.price - platformFee
      } else {
        driverMap.set(driverId, {
          driver: {
            id: order.driver.id,
            name: order.driver.user.name,
            licensePlate: order.driver.licensePlate,
          },
          totalOrders: 1,
          totalAmount: order.price,
          platformFee,
          netAmount: order.price - platformFee,
        })
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        allOrdersCount: allOrders.length,
        pendingTransferCount,
        summary,
        orders,
        driverTransferList: Array.from(driverMap.values()),
      },
    })
  } catch (error) {
    console.error('Get settlement error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
