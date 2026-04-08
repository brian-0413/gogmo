import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadEvent } from '@/lib/sse-emitter'

// POST /api/orders/[id]/transfer-request — 發起轉單請求
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { reason?: string } = {}
    try { body = await request.json() } catch {}

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
        { success: false, error: '只有司機可以發起轉單' },
        { status: 403 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        dispatcher: { include: { user: true } },
      },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到訂單' },
        { status: 404 }
      )
    }

    // 確認是本人的 ACCEPTED 訂單
    if (order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單不是您接的，無法發起轉單' },
        { status: 403 }
      )
    }

    if (order.status !== 'ACCEPTED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有已接單的訂單才能發起轉單' },
        { status: 400 }
      )
    }

    // 行程前 3 小時不能轉單（isLocked）
    if (order.isLocked) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單行程前 3 小時已鎖定，無法轉單' },
        { status: 400 }
      )
    }

    // 檢查司機是否有小隊
    const membership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
      include: { squad: true },
    })

    if (!membership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您尚未加入任何小隊，無法發起轉單' },
        { status: 403 }
      )
    }

    // 計算轉單費用（5%）
    const transferFee = Math.floor(order.price * 0.05)

    // 建立轉單記錄
    const transfer = await prisma.orderTransfer.create({
      data: {
        orderId: id,
        fromDriverId: user.driver.id,
        squadId: membership.squadId,
        transferFee,
        reason: body.reason ?? null,
        status: 'PENDING_SQUAD',
      },
      include: {
        order: {
          select: {
            id: true,
            scheduledTime: true,
            price: true,
            pickupLocation: true,
            dropoffLocation: true,
            type: true,
            vehicle: true,
          },
        },
        fromDriver: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    })

    // Broadcast SSE 通知所有隊友
    broadcastSquadEvent({
      type: 'TRANSFER_CREATED',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: user.driver.id,
      squadId: membership.squadId,
      status: 'PENDING_SQUAD',
      reason: body.reason ?? undefined,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { transfer },
    })
  } catch (error) {
    console.error('Transfer request error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
