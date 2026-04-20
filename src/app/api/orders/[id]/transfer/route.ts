import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/orders/[id]/transfer — 取得訂單最新轉單記錄（供派單方橫幅顯示）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有派單方可以查詢轉單記錄' },
        { status: 403 }
      )
    }

    // 取得此訂單最新的轉單記錄
    const transfer = await prisma.orderTransfer.findFirst({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderDate: true,
            orderSeq: true,
            dispatcherId: true,
            scheduledTime: true,
            price: true,
            pickupLocation: true,
            dropoffLocation: true,
            type: true,
            vehicleType: true,
            driverId: true,
            driver: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        fromDriver: {
          include: {
            user: { select: { name: true } },
          },
        },
        toDriver: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    })

    if (!transfer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到轉單記錄' },
        { status: 404 }
      )
    }

    if ((transfer as any).order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您不是此訂單的派單方' },
        { status: 403 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { transfer },
    })
  } catch (error) {
    console.error('Transfer fetch error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
