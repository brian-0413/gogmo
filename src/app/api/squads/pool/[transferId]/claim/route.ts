import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadEvent, broadcastDispatcherEvent } from '@/lib/sse-emitter'

// POST /api/squads/pool/[transferId]/claim — 司機搶單（先搶先贏）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transferId: string }> }
) {
  try {
    const { transferId } = await params

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
        { success: false, error: '只有司機可以搶單' },
        { status: 403 }
      )
    }

    // 預查轉單記錄（用於基本驗證）
    const transfer = await prisma.orderTransfer.findUnique({
      where: { id: transferId },
      include: {
        order: {
          select: {
            id: true,
            driverId: true,
            scheduledTime: true,
            dispatcherId: true,
            price: true,
            pickupLocation: true,
            dropoffLocation: true,
            type: true,
            vehicleType: true,
            status: true,
          },
        },
        fromDriver: {
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

    if (transfer.status !== 'PENDING_SQUAD') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此轉單不在等待隊友接單狀態' },
        { status: 400 }
      )
    }

    if (transfer.fromDriverId === user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '不能搶自己的轉單' },
        { status: 400 }
      )
    }

    // 行程前 1 小時內不能搶單
    const now = new Date()
    const oneHourMs = 60 * 60 * 1000
    if ((transfer as any).order.scheduledTime.getTime() - now.getTime() < oneHourMs) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '行程前 1 小時內無法搶單' },
        { status: 400 }
      )
    }

    // 先將 driver ID 取出，避免在 transaction callback 中存取可能為 null 的物件
    const currentDriverId = user.driver.id

    // Prisma $transaction 確保原子性
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // SELECT FOR UPDATE（在 Prisma 中用 findUnique 搭配隔離等級）
      // 先重新查一次確認狀態未被改變
      const lockedTransfer = await tx.orderTransfer.findUnique({
        where: { id: transferId },
        include: {
          order: {
            select: {
              id: true,
              driverId: true,
              scheduledTime: true,
              dispatcherId: true,
              price: true,
            },
          },
          fromDriver: {
            include: { user: { select: { name: true } } },
          },
        },
      })

      if (!lockedTransfer || lockedTransfer.status !== 'PENDING_SQUAD') {
        throw new Error('搶單失敗：轉單已被其他司機接走')
      }

      if (lockedTransfer.fromDriverId === currentDriverId) {
        throw new Error('不能搶自己的轉單')
      }

      // 行程前 1 小時再檢查一次
      const currentTime = new Date()
      if (lockedTransfer.order.scheduledTime.getTime() - currentTime.getTime() < oneHourMs) {
        throw new Error('行程前 1 小時內無法搶單')
      }

      const order = lockedTransfer.order
      const fromDriverId = lockedTransfer.fromDriverId
      const toDriverId = currentDriverId
      const transferFee = lockedTransfer.transferFee
      const bonusPoints = lockedTransfer.bonusPoints
      const fromDriverName = lockedTransfer.fromDriver.user.name

      // a. 更新 toDriverId + status = APPROVED（atomic check: status must still be PENDING_SQUAD）
      const updatedTransfer = await tx.orderTransfer.update({
        where: { id: transferId, status: 'PENDING_SQUAD' },
        data: {
          toDriverId,
          status: 'APPROVED',
        },
      })

      // b. 更新 order.driverId = toDriverId
      await tx.order.update({
        where: { id: order.id },
        data: { driverId: toDriverId },
      })

      // c. 扣 fromDriver 3% transferFee
      const fromDriver = await tx.driver.findUnique({
        where: { id: fromDriverId },
      })
      if (!fromDriver) throw new Error('找不到原司機資料')

      const newFromBalance = fromDriver.balance - transferFee
      await tx.driver.update({
        where: { id: fromDriverId },
        data: { balance: newFromBalance },
      })

      // d. 扣 fromDriver bonus
      const newFromBalanceAfterBonus = newFromBalance - bonusPoints
      await tx.driver.update({
        where: { id: fromDriverId },
        data: { balance: newFromBalanceAfterBonus },
      })

      // e. 給 toDriver bonus
      const toDriver = await tx.driver.findUnique({
        where: { id: toDriverId },
      })
      if (!toDriver) throw new Error('找不到接手司機資料')

      const newToBalance = toDriver.balance + bonusPoints
      await tx.driver.update({
        where: { id: toDriverId },
        data: { balance: newToBalance },
      })

      // f. 建立 Transaction records (3 筆)
      // 扣 fromDriver 3%
      await tx.transaction.create({
        data: {
          orderId: order.id,
          driverId: fromDriverId,
          amount: -transferFee,
          type: 'PLATFORM_FEE',
          status: 'SETTLED',
          description: `轉單手續費 (3%)`,
        },
      })

      // 扣 fromDriver bonus
      await tx.transaction.create({
        data: {
          orderId: order.id,
          driverId: fromDriverId,
          amount: -bonusPoints,
          type: 'PLATFORM_FEE',
          status: 'SETTLED',
          description: `轉單 bonus 轉出 ${bonusPoints} 點`,
        },
      })

      // 給 toDriver bonus
      await tx.transaction.create({
        data: {
          orderId: order.id,
          driverId: toDriverId,
          amount: bonusPoints,
          type: 'RECHARGE',
          status: 'SETTLED',
          description: `接收轉單 bonus ${bonusPoints} 點（來自 ${fromDriverName}）`,
        },
      })

      return {
        updatedTransfer,
        newFromBalance: newFromBalanceAfterBonus,
        newToBalance,
      }
    })

    // Broadcast SSE 到小隊
    broadcastSquadEvent({
      type: 'TRANSFER_APPROVED',
      transferId: transfer.id,
      orderId: (transfer as any).order.id,
      fromDriverId: transfer.fromDriverId,
      toDriverId: user.driver.id,
      squadId: transfer.squadId,
      status: 'APPROVED',
    })

    // Broadcast SSE 到派單方
    broadcastDispatcherEvent({
      type: 'TRANSFER_APPROVED',
      transferId: transfer.id,
      orderId: (transfer as any).order.id,
      fromDriverId: transfer.fromDriverId,
      toDriverId: user.driver.id,
      status: 'APPROVED',
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        transfer: result.updatedTransfer,
        newFromBalance: result.newFromBalance,
        newToBalance: result.newToBalance,
      },
    })
  } catch (error) {
    console.error('Claim transfer error:', error)
    const message = error instanceof Error ? error.message : '伺服器錯誤'
    const isConflict = message.includes('已被其他司機接走')
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: isConflict ? 409 : 500 }
    )
  }
}
