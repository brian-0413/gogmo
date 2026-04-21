import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以查看' }, { status: 403 })
    }

    // 取所有 ASSIGNED 訂單（等待此派單方審核）
    const orders = await prisma.order.findMany({
      where: {
        dispatcherId: user.dispatcher.id,
        status: 'ASSIGNED',
      },
      include: {
        driver: {
          include: {
            user: {
              include: {
                documents: {
                  where: {
                    type: { in: ['DRIVER_LICENSE', 'VEHICLE_REGISTRATION', 'INSURANCE'] },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    return NextResponse.json<ApiResponse>({ success: true, data: { orders } })
  } catch (error) {
    console.error('Pending approvals error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}