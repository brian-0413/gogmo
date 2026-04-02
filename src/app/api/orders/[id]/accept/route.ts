import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { OrderType } from '@/types'

// 尖峰時段判斷
function isPeakHour(time: Date): boolean {
  const h = time.getHours()
  return (h >= 7 && h < 9) || (h >= 16 && h < 18)
}

// 計算訂單完成後司機自由時間
function getFreeTimeAfterOrder(scheduledTime: Date, type: string): Date {
  const freeTime = new Date(scheduledTime)
  if (type === 'pickup' || type === 'pickup_boat') {
    freeTime.setMinutes(freeTime.getMinutes() + (isPeakHour(scheduledTime) ? 150 : 120))
  } else {
    freeTime.setMinutes(freeTime.getMinutes() + 60)
  }
  return freeTime
}

// POST /api/orders/[id]/accept - Driver accepts order
export async function POST(
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
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有司機可以接單' },
        { status: 403 }
      )
    }

    const order = await prisma.order.findUnique({ where: { id } })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到訂單' },
        { status: 404 }
      )
    }

    if (order.status !== 'PUBLISHED' && order.status !== 'ASSIGNED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單目前無法接單' },
        { status: 400 }
      )
    }

    // If assigned to someone else, they need to release it first
    if (order.status === 'ASSIGNED' && order.driverId && user.driver && order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單已指派給其他司機' },
        { status: 400 }
      )
    }

    // === 時間衝突檢查 ===
    const activeOrders = await prisma.order.findMany({
      where: {
        driverId: user.driver.id,
        status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      select: { scheduledTime: true, type: true },
    })

    if (activeOrders.length > 0) {
      const freeTimes = activeOrders.map((o) =>
        getFreeTimeAfterOrder(o.scheduledTime, o.type)
      )
      const latestFree = new Date(Math.max(...freeTimes.map((t) => t.getTime())))
      // 司機需在自由時間後 45 分鐘才有緩衝接新單
      const latestAcceptable = new Date(latestFree.getTime() + 45 * 60 * 1000)
      const newOrderTime = new Date(order.scheduledTime)

      if (newOrderTime < latestAcceptable) {
        const diffMins = Math.round((latestAcceptable.getTime() - newOrderTime.getTime()) / (60 * 1000))
        const lastOrder = activeOrders.sort(
          (a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime()
        )[0]
        const lastFree = getFreeTimeAfterOrder(lastOrder.scheduledTime, lastOrder.type)
        const canAcceptAt = new Date(lastFree.getTime() + 45 * 60 * 1000)
        const canAcceptStr = `${canAcceptAt.getHours().toString().padStart(2, '0')}:${canAcceptAt.getMinutes().toString().padStart(2, '0')}`

        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: `時間衝突：此單 ${newOrderTime.getHours().toString().padStart(2, '0')}:${newOrderTime.getMinutes().toString().padStart(2, '0')} 與您現有行程衝突，需等到 ${canAcceptStr} 之後才能接`
          },
          { status: 400 }
        )
      }
    }

    // Calculate platform fee (5%)
    const platformFee = Math.floor(order.price * 0.05)

    // Guard: ensure user.driver exists
    if (!user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 400 }
      )
    }

    const driverId = user.driver.id

    // Use transaction to prevent race condition
    const updated = await prisma.$transaction(async (tx) => {
      // Re-fetch driver with lock (PostgreSQL does this automatically)
      const driver = await tx.driver.findUnique({
        where: { id: driverId },
      })

      if (!driver) {
        throw new Error('找不到司機資料')
      }

      // Re-check time conflict inside transaction (race condition guard)
      const activeOrders = await tx.order.findMany({
        where: {
          driverId,
          status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
        },
        select: { scheduledTime: true, type: true },
      })

      if (activeOrders.length > 0) {
        const freeTimes = activeOrders.map((o) =>
          getFreeTimeAfterOrder(o.scheduledTime, o.type)
        )
        const latestFree = new Date(Math.max(...freeTimes.map((t) => t.getTime())))
        const latestAcceptable = new Date(latestFree.getTime() + 45 * 60 * 1000)
        const newOrderTime = new Date(order.scheduledTime)

        if (newOrderTime < latestAcceptable) {
          throw new Error('TIME_CONFLICT')
        }
      }

      // Check balance atomically
      if (driver.balance < platformFee) {
        throw new Error(`點數不足，需要 ${platformFee} 點`)
      }

      // Update order
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          driverId: driverId,
          status: 'ACCEPTED',
        },
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })

      // Deduct platform fee from driver balance
      await tx.driver.update({
        where: { id: driverId },
        data: {
          balance: driver.balance - platformFee,
        },
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          orderId: id,
          driverId: driverId,
          amount: -platformFee,
          type: 'PLATFORM_FEE',
          status: 'SETTLED',
          description: `接單平台費 (5%) - 訂單 #${id.slice(0, 8)}`,
        },
      })

      return updatedOrder
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        order: updated,
        platformFee,
        newBalance: updated.driver?.balance,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'TIME_CONFLICT') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '時間衝突：此單與您現有行程時間重疊，請稍後再試' },
        { status: 400 }
      )
    }
    console.error('Accept order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
