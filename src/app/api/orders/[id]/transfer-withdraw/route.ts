import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadEvent, broadcastDispatcherEvent } from '@/lib/sse-emitter'

// POST /api/orders/[id]/transfer-withdraw — 派單方撤回轉單
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
        { success: false, error: '只有派單方可以撤回轉單' },
        { status: 403 }
      )
    }

    // 查詢轉單記錄
    const transfer = await prisma.orderTransfer.findUnique({
      where: { id: body.transferId },
      include: {
        order: {
          select: {
            id: true,
            dispatcherId: true,
            scheduledTime: true,
            price: true,
            status: true,
          },
        },
        fromDriver: true,
        squad: true,
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

    if (transfer.status !== 'PENDING_SQUAD') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此轉單不在待接手狀態，無法撤回' },
        { status: 400 }
      )
    }

    // 確認派單方是此訂單的派單方
    if (transfer.order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您不是此訂單的派單方，無法撤回' },
        { status: 403 }
      )
    }

    // 檢查行程前 1 小時內
    const scheduledTime = new Date(transfer.order.scheduledTime)
    const now = new Date()
    const oneHourMs = 60 * 60 * 1000
    if (scheduledTime.getTime() - now.getTime() > oneHourMs) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '行程尚未在 1 小時內，無法撤回轉單' },
        { status: 400 }
      )
    }

    // Transaction：更新轉單狀態 + 更新訂單狀態 + 退還費用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // 更新轉單狀態
      const updatedTransfer = await tx.orderTransfer.update({
        where: { id: body.transferId },
        data: { status: 'CANCELLED' },
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
              vehicle: true,
            },
          },
          fromDriver: { include: { user: { select: { name: true } } } },
        },
      })

      // 退還 bonusPoints 給原司機
      if (transfer.bonusPoints > 0) {
        await tx.driver.update({
          where: { id: transfer.fromDriverId },
          data: { balance: { increment: transfer.bonusPoints } },
        })
        await tx.transaction.create({
          data: {
            orderId: id,
            driverId: transfer.fromDriverId,
            amount: transfer.bonusPoints,
            type: 'RECHARGE',
            status: 'SETTLED',
            description: `轉單撤回退還 bonus 點數 - 訂單 #${id.slice(0, 8)}`,
          },
        })
      }

      // 退還 transferFee 給原司機
      if (transfer.transferFee > 0) {
        await tx.driver.update({
          where: { id: transfer.fromDriverId },
          data: { balance: { increment: transfer.transferFee } },
        })
        await tx.transaction.create({
          data: {
            orderId: id,
            driverId: transfer.fromDriverId,
            amount: transfer.transferFee,
            type: 'RECHARGE',
            status: 'SETTLED',
            description: `轉單撤回退還轉單費 - 訂單 #${id.slice(0, 8)}`,
          },
        })
      }

      // 取得原司機最新的 balance
      const fromDriver = await tx.driver.findUnique({ where: { id: transfer.fromDriverId } })

      return { updatedTransfer, fromDriver }
    })

    // Broadcast SSE 到小隊
    broadcastSquadEvent({
      type: 'TRANSFER_WITHDRAWN',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      squadId: transfer.squadId,
      status: 'CANCELLED',
    })

    // Broadcast SSE 到派單方
    broadcastDispatcherEvent({
      type: 'TRANSFER_WITHDRAWN',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      status: 'CANCELLED',
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        transfer: result.updatedTransfer,
        refundedBonus: transfer.bonusPoints,
        refundedTransferFee: transfer.transferFee,
        fromDriverNewBalance: result.fromDriver?.balance,
      },
    })
  } catch (error) {
    console.error('Transfer withdraw error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
