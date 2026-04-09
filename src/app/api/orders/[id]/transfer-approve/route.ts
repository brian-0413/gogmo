import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadEvent, broadcastDispatcherEvent } from '@/lib/sse-emitter'

// POST /api/orders/[id]/transfer-approve — 派單方批准轉單，進入小隊支援池
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { transferId: string } = { transferId: '' }
    try { body = await request.json() } catch {}

    if (!body.transferId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 transferId' },
        { status: 400 }
      )
    }

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
        { success: false, error: '只有派單方可以批准轉單' },
        { status: 403 }
      )
    }

    // 查詢轉單記錄
    const transfer = await prisma.orderTransfer.findUnique({
      where: { id: body.transferId },
      include: {
        order: true,
        fromDriver: { include: { user: true } },
      },
    })

    if (!transfer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到轉單記錄' },
        { status: 404 }
      )
    }

    if (transfer.orderId !== id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '轉單記錄與訂單不符' },
        { status: 400 }
      )
    }

    if (transfer.status !== 'PENDING_DISPATCHER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此轉單不在等待派單方確認狀態' },
        { status: 400 }
      )
    }

    // 確認派單方是此訂單的派單方
    if (transfer.order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您不是此訂單的派單方，無法批准' },
        { status: 403 }
      )
    }

    // Transaction：更新轉單狀態為 PENDING_SQUAD（不變更訂單司機、不扣費）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedTransfer = await prisma.$transaction(async (tx: any) => {
      return tx.orderTransfer.update({
        where: { id: body.transferId },
        data: { status: 'PENDING_SQUAD' },
        include: {
          order: {
            select: {
              id: true,
              dispatcherId: true,
              scheduledTime: true,
              price: true,
              pickupLocation: true,
              dropoffLocation: true,
              type: true,
              vehicle: true,
            },
          },
          fromDriver: { include: { user: { select: { name: true } } } },
        },
      })
    })

    // Broadcast SQUAD_POOL_NEW 到小隊全成員
    broadcastSquadEvent({
      type: 'SQUAD_POOL_NEW',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      squadId: transfer.squadId,
      status: 'PENDING_SQUAD',
      bonusPoints: transfer.bonusPoints,
      reason: transfer.reason ?? undefined,
    })

    // Broadcast TRANSFER_POOL_READY 到派單方
    broadcastDispatcherEvent({
      type: 'TRANSFER_POOL_READY',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      squadId: transfer.squadId,
      status: 'PENDING_SQUAD',
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { transfer: updatedTransfer },
    })
  } catch (error) {
    console.error('Transfer approve error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}