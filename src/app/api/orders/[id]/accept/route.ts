import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { PLATFORM_FEE_RATE } from '@/lib/constants'

// ─── 衝突檢查 ─────────────────────────────────────────

function isPickupType(type: string): boolean {
  return type === 'pickup' || type === 'pickup_boat'
}
function isDropoffType(type: string): boolean {
  return type === 'dropoff' || type === 'dropoff_boat'
}

/**
 * 檢查新訂單是否與司機現有行程衝突
 * 回傳衝突原因（字串）或 null（無衝突）
 */
function checkConflict(
  newOrderTime: Date,
  newOrderType: string,
  activeOrders: Array<{ scheduledTime: Date; type: string }>
): string | null {
  for (const existing of activeOrders) {
    const existingTime = new Date(existing.scheduledTime)
    const diffMs = Math.abs(newOrderTime.getTime() - existingTime.getTime())
    const diffMins = diffMs / (1000 * 60)

    if (diffMins < 60) {
      return `⚠️ 此單 ${formatTime(newOrderTime)} 與您 ${formatTime(existingTime)} 的 ${getTypeLabel(existing.type)} 行程時間接近，請確認是否來得及`
    }
  }
  return null
}

function formatTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getTypeLabel(type: string): string {
  if (type === 'pickup' || type === 'pickup_boat') return '接機'
  if (type === 'dropoff' || type === 'dropoff_boat') return '送機'
  if (type === 'transfer') return '接駁'
  if (type === 'charter') return '包車'
  return type
}

function buildWarning(conflictMsg: string | null): string {
  const lines = []
  if (conflictMsg) lines.push(conflictMsg)
  lines.push('1. 提醒您，接單之後退單，將收取訂單 10% 的手續費。')
  lines.push('2. 請勿強接太緊繃的配趟，為了行車和荷包的安全，請謹慎接單。')
  return lines.join('\n')
}

// ─── POST /api/orders/[id]/accept ───────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { skipWarning?: boolean } = {}
    try { body = await request.json() } catch {}
    const skipWarning = body.skipWarning === true
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

    if (order.status === 'ASSIGNED' && order.driverId && order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單已指派給其他司機' },
        { status: 400 }
      )
    }

    if (!user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 400 }
      )
    }

    const driverId = user.driver.id
    const newOrderTime = new Date(order.scheduledTime)

    // ─── 衝突檢查 ──────────────────────────────────────
    if (!skipWarning) {
      const activeOrders = await prisma.order.findMany({
        where: {
          driverId,
          status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
        },
        select: { scheduledTime: true, type: true },
      })

      if (activeOrders.length > 0) {
        const conflictMsg = checkConflict(newOrderTime, order.type, activeOrders)
        if (conflictMsg) {
          const driver = await prisma.driver.findUnique({ where: { id: driverId } })
          const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

          if (!driver) {
            return NextResponse.json<ApiResponse>(
              { success: false, error: '找不到司機資料' },
              { status: 400 }
            )
          }

          if (driver.balance < platformFee) {
            return NextResponse.json<ApiResponse>(
              { success: false, error: `點數不足，需要 ${platformFee} 點` },
              { status: 400 }
            )
          }

          return NextResponse.json<ApiResponse>({
            success: true,
            data: {
              order,
              warning: buildWarning(conflictMsg),
            },
          })
        }
      }
    }

    // ─── Transaction ───────────────────────────────────
    const updated = await prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId } })
      if (!driver) throw new Error('找不到司機資料')

      const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

      if (driver.balance < platformFee) {
        throw new Error(`點數不足，需要 ${platformFee} 點`)
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { driverId, status: 'ACCEPTED' },
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })

      await tx.driver.update({
        where: { id: driverId },
        data: { balance: driver.balance - platformFee },
      })

      await tx.transaction.create({
        data: {
          orderId: id,
          driverId,
          amount: -platformFee,
          type: 'PLATFORM_FEE',
          status: 'SETTLED',
          description: `接單平台費 (5%) - 訂單 #${id.slice(0, 8)}`,
        },
      })

      return updatedOrder
    })

    const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

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
    if (message.startsWith('點數不足')) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: message },
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
