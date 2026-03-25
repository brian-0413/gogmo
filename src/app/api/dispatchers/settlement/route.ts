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
        { success: false, error: '只有車頭可以查看對帳表' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get all completed orders for this dispatcher
    const where: Record<string, unknown> = {
      dispatcherId: user.dispatcher?.id,
      status: 'COMPLETED',
    }

    if (startDate || endDate) {
      where.completedAt = {}
      if (startDate) (where.completedAt as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.completedAt as Record<string, unknown>).lte = new Date(endDate)
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        driver: { include: { user: true } },
        transaction: true,
      },
      orderBy: { completedAt: 'desc' },
    })

    // Group by driver for transfer list
    const driverSummary: Record<string, {
      driver: { id: string; name: string; licensePlate: string }
      totalOrders: number
      totalAmount: number
      platformFee: number
      netAmount: number
    }> = {}

    for (const order of orders) {
      if (!order.driver) continue

      const driverId = order.driver.id
      if (!driverSummary[driverId]) {
        driverSummary[driverId] = {
          driver: {
            id: order.driver.id,
            name: order.driver.user.name,
            licensePlate: order.driver.licensePlate,
          },
          totalOrders: 0,
          totalAmount: 0,
          platformFee: 0,
          netAmount: 0,
        }
      }

      const platformFee = Math.floor(order.price * 0.05)
      driverSummary[driverId].totalOrders++
      driverSummary[driverId].totalAmount += order.price
      driverSummary[driverId].platformFee += platformFee
      driverSummary[driverId].netAmount += order.price - platformFee
    }

    // Summary statistics
    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum: number, o: { price: number }) => sum + o.price, 0),
      totalPlatformFee: orders.reduce((sum: number, o: { price: number }) => Math.floor(o.price * 0.05), 0),
      totalNetRevenue: orders.reduce((sum: number, o: { price: number }) => sum + o.price - Math.floor(o.price * 0.05), 0),
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        summary,
        orders,
        driverTransferList: Object.values(driverSummary),
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
