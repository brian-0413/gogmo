import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/completed-orders - Get completed orders for current driver
export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url)
    const pageRaw = parseInt(searchParams.get('page') || '1', 10)
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50, 100)
    const skip = (page - 1) * limit

    const token = _request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: {
          driverId: user.driver.id,
          status: 'COMPLETED',
        },
        include: {
          dispatcher: {
            select: { companyName: true },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.order.count({
        where: {
          driverId: user.driver.id,
          status: 'COMPLETED',
        },
      }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (orders as any[]).map((order: any) => ({
      id: order.id,
      completedAt: order.completedAt,
      pickupLocation: order.pickupLocation,
      dropoffLocation: order.dropoffLocation,
      price: order.price,
      dispatcher: {
        companyName: order.dispatcher.companyName,
      },
      transferStatus: order.transferStatus,
    }))

    return NextResponse.json<ApiResponse>({ success: true, data: { orders: data, page, limit, total } })
  } catch (error) {
    console.error('Get completed orders error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
