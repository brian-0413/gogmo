import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/completed-orders - Get completed orders for current driver
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
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const orders = await prisma.order.findMany({
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
    })

    const data = orders.map(order => ({
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

    return NextResponse.json<ApiResponse>({ success: true, data })
  } catch (error) {
    console.error('Get completed orders error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
