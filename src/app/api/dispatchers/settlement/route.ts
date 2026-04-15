import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { PLATFORM_FEE_RATE } from '@/lib/constants'

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
    // 分頁：take/skip，限制最大 100
    const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 100)
    const skip = parseInt(searchParams.get('skip') || '0', 10)

    // Build date filter for completedAt
    const completedAtFilter: Record<string, unknown> = {}
    if (startDate) completedAtFilter.gte = new Date(startDate + 'T00:00:00')
    if (endDate) completedAtFilter.lte = new Date(endDate + 'T23:59:59')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedWhere: any = {
      dispatcherId: user.dispatcher?.id,
      status: 'COMPLETED',
      ...(Object.keys(completedAtFilter).length > 0 ? { completedAt: completedAtFilter } : {}),
    }

    // Get total count for pagination metadata
    const totalCount = await prisma.order.count({ where: completedWhere })

    const orders = await prisma.order.findMany({
      where: completedWhere,
      include: {
        driver: { include: { user: true, transactions: true } },
        transactions: true,
      },
      orderBy: { completedAt: 'desc' },
      take,
      skip,
    })

    // Count pending transfer orders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingTransferCount = (orders as any[]).filter((o: any) => o.transferStatus === 'pending').length

    // Use SQL-like aggregation via Prisma
    // Calculate summary using reduce (more efficient than multiple iterations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = (orders as any[]).reduce((acc: any, order: any) => {
        const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)
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
      const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

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

    // 分組統計
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ordersWithDriver = orders as any[]
    const pendingOrders = ordersWithDriver.filter((o: any) => o.transferStatus === 'pending')
    const completedOrders = ordersWithDriver.filter((o: any) => o.transferStatus === 'completed')

    const pendingAmount = pendingOrders.reduce((sum: number, o: any) => sum + o.price, 0)
    const completedAmount = completedOrders.reduce((sum: number, o: any) => sum + o.price, 0)
    const totalAmount = pendingAmount + completedAmount

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        completedOrdersCount: orders.length,
        totalCount,
        pagination: {
          take,
          skip,
          total: totalCount,
          hasMore: skip + orders.length < totalCount,
        },
        totalAmount,
        pendingCount: pendingOrders.length,
        pendingAmount,
        completedCount: completedOrders.length,
        completedAmount,
        orders: orders.map((o: any) => ({
          id: o.id,
          orderDate: o.orderDate,
          orderSeq: o.orderSeq,
          price: o.price,
          completedAt: o.completedAt ? new Date(o.completedAt).toISOString() : null,
          transferStatus: o.transferStatus,
          driver: o.driver ? {
            user: { name: o.driver.user.name },
            licensePlate: o.driver.licensePlate,
            bankCode: o.driver.bankCode || null,
            bankAccount: o.driver.bankAccount || null,
          } : null,
        })),
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
