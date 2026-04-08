import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { broadcastSquadEvent } from '@/lib/sse-emitter'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

// GET /api/cron/lock-orders — 每分鐘跑一次
// 鎖定行程前 3 小時內的已接單訂單，並將相關轉單請求設為過期
export async function GET(request: NextRequest) {
  try {
    const secret = request.headers.get('x-cron-secret')
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000
    const lockThreshold = new Date(now.getTime() + THREE_HOURS_MS)

    // 查詢所有行程前 3 小時內的 ACCEPTED 且未鎖定的訂單
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
      await prisma.orderTransfer.updateMany({
        where: {
          id: { in: pendingTransfers.map((t) => t.id) },
        },
        data: { status: 'EXPIRED' },
      })

      // 通知所有相關小隊
      for (const transfer of pendingTransfers) {
        broadcastSquadEvent({
          type: 'TRANSFER_CANCELLED',
          transferId: transfer.id,
          orderId: transfer.orderId,
          fromDriverId: transfer.fromDriverId,
          squadId: transfer.squadId,
          status: 'EXPIRED',
          reason: '行程已鎖定，轉單請求自動過期',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Lock orders cron completed',
      lockedCount: orderIds.length,
      expiredCount: pendingTransfers.length,
    })
  } catch (error) {
    console.error('Lock orders cron error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
