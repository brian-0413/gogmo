import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadEvent, broadcastDispatcherEvent } from '@/lib/sse-emitter'

// POST /api/orders/[id]/transfer-approve — 派單方同意轉單
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
        toDriver: { include: { user: true } },
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

    if (!transfer.toDriverId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此轉單尚未有接單司機' },
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

    // Transaction：更新轉單狀態 + 更新訂單司機 + 扣轉單費
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // 更新轉單狀態
      const updatedTransfer = await tx.orderTransfer.update({
        where: { id: body.transferId },
        data: { status: 'APPROVED' },
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
          toDriver: { include: { user: { select: { name: true } } } },
        },
      })

      // 更新訂單司機
      await tx.order.update({
        where: { id },
        data: { driverId: transfer.toDriverId },
      })

      // 從 fromDriver 帳戶扣 transferFee
      const fromDriver = await tx.driver.findUnique({ where: { id: transfer.fromDriverId } })
      if (!fromDriver) throw new Error('找不到原司機資料')

      const newBalance = fromDriver.balance - transfer.transferFee
      await tx.driver.update({
        where: { id: transfer.fromDriverId },
        data: { balance: newBalance },
      })

      // 記錄轉單扣費交易
      await tx.transaction.create({
        data: {
          orderId: id,
          driverId: transfer.fromDriverId,
          amount: -transfer.transferFee,
          type: 'PLATFORM_FEE',
          status: 'SETTLED',
          description: `轉單手續費 (5%) - 訂單 #${id.slice(0, 8)}`,
        },
      })

      return { updatedTransfer, newBalance }
    })

    // Broadcast SSE 到小隊
    broadcastSquadEvent({
      type: 'TRANSFER_APPROVED',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      toDriverId: transfer.toDriverId!,
      squadId: transfer.squadId,
      status: 'APPROVED',
    })

    // Broadcast SSE 到派單方
    broadcastDispatcherEvent({
      type: 'TRANSFER_APPROVED',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      toDriverId: transfer.toDriverId!,
      status: 'APPROVED',
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        transfer: result.updatedTransfer,
        transferFee: transfer.transferFee,
        fromDriverNewBalance: result.newBalance,
      },
    })
  } catch (error) {
    console.error('Transfer approve error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
