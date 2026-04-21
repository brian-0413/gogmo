import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { broadcastSquadEvent } from '@/lib/sse-emitter'
import { TRANSFER_LOCK_HOURS } from '@/lib/constants'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

// GET /api/cron/lock-orders — 每分鐘跑一次
// 鎖定行程前 TRANSFER_LOCK_HOURS 小時內的已接單訂單，並將相關轉單請求設為過期
export async function GET(request: NextRequest) {
  try {
    const secret = request.headers.get('x-cron-secret')
    if (!CRON_SECRET || secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const lockThreshold = new Date(now.getTime() + TRANSFER_LOCK_HOURS * 60 * 60 * 1000)

    // 查詢所有行程前 TRANSFER_LOCK_HOURS 小時內的 ACCEPTED 且未鎖定的訂單
    const ordersToLock = await prisma.order.findMany({
      where: {
        status: 'ACCEPTED',
        isLocked: false,
        scheduledTime: {
          lte: lockThreshold,
          gte: now,
        },
      },
      select: { id: true },
    })

    if (ordersToLock.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders to lock',
        lockedCount: 0,
        expiredCount: 0,
      })
    }

    const orderIds = ordersToLock.map((o) => o.id)

    // 鎖定這些訂單
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { isLocked: true },
    })

    // 將這些訂單的 PENDING_SQUAD 轉單請求設為 EXPIRED
    const pendingTransfers = await prisma.orderTransfer.findMany({
      where: {
        orderId: { in: orderIds },
        status: 'PENDING_SQUAD',
      },
    })

    if (pendingTransfers.length > 0) {
      // 退還 bonusPoints 並標記為 EXPIRED
      for (const transfer of pendingTransfers) {
        await prisma.$transaction(async (tx) => {
          // 退還 bonusPoints 給原司機
          if (transfer.bonusPoints && transfer.bonusPoints > 0) {
            await tx.driver.update({
              where: { id: transfer.fromDriverId },
              data: { balance: { increment: transfer.bonusPoints } },
            })
            await tx.transaction.create({
              data: {
                driverId: transfer.fromDriverId,
                amount: transfer.bonusPoints,
                type: 'RECHARGE',
                status: 'SETTLED',
                description: `轉單超時鎖定，bonus ${transfer.bonusPoints} 點已退還`,
              },
            })
          }

          // 標記轉單為 EXPIRED
          await tx.orderTransfer.update({
            where: { id: transfer.id },
            data: { status: 'EXPIRED' },
          })
        })

        // 通知所有相關小隊
        broadcastSquadEvent({
          type: 'TRANSFER_EXPIRED',
          transferId: transfer.id,
          orderId: transfer.orderId,
          fromDriverId: transfer.fromDriverId,
          squadId: transfer.squadId,
          status: 'EXPIRED',
          reason: '行程已鎖定，轉單請求自動過期',
        })
      }
    }

    // 逾時自動取消：PUBLISHED 且 scheduledTime + 寬限期 < now 的訂單
    const EXPIRE_GRACE_MINUTES = parseInt(process.env.ORDER_EXPIRE_GRACE_MINUTES ?? '90')
    const expireThreshold = new Date(now.getTime() - EXPIRE_GRACE_MINUTES * 60 * 1000)

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: 'PUBLISHED',
        scheduledTime: { lt: expireThreshold },
      },
      select: { id: true, dispatcherId: true },
    })

    for (const order of expiredOrders) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        })
      })
    }
    const expiredCount = expiredOrders.length

    return NextResponse.json({
      success: true,
      message: 'Lock orders cron completed',
      lockedCount: orderIds.length,
      expiredCount,
    })
  } catch (error) {
    console.error('Lock orders cron error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
