import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// ─── 衝突檢查工具 ────────────────────────────────────────

function isPickupType(type: string): boolean {
  return type === 'pickup' || type === 'pickup_boat'
}
function isDropoffType(type: string): boolean {
  return type === 'dropoff' || type === 'dropoff_boat'
}

/**
 * 檢查新訂單是否與司機現有行程衝突
 * 回傳 { blocked: boolean, warning: boolean, reason: string }
 * - blocked: 同類型時間重疊，需阻擋
 * - warning: 不同類型但時間接近，需提醒
 */
function checkConflict(
  newOrderTime: Date,
  newOrderType: string,
  activeOrders: Array<{ scheduledTime: Date; type: string }>
): { blocked: boolean; warning: boolean; reason: string } {
  for (const existing of activeOrders) {
    const existingTime = new Date(existing.scheduledTime)
    const diffMs = Math.abs(newOrderTime.getTime() - existingTime.getTime())
    const diffMins = diffMs / (1000 * 60)

    // 同類型（接送）60 分鐘內 → 阻擋
    if (
      (isPickupType(newOrderType) && isPickupType(existing.type)) ||
      (isDropoffType(newOrderType) && isDropoffType(existing.type))
    ) {
      if (diffMins < 60) {
        return {
          blocked: true,
          warning: false,
          reason: `此單 ${formatTime(newOrderTime)} 與您 ${formatTime(existingTime)} 的 ${getTypeLabel(existing.type)} 行程時間太近（不足 60 分鐘），接送同類型行程需間隔至少 60 分鐘`,
        }
      }
    }

    // 不同類型但 60 分鐘內 → 提醒
    if (diffMins < 60) {
      return {
        blocked: false,
        warning: true,
        reason: `⚠️ 此單 ${formatTime(newOrderTime)} 與您 ${formatTime(existingTime)} 的 ${getTypeLabel(existing.type)} 行程時間接近，請確認是否來得及`,
      }
    }
  }

  return { blocked: false, warning: false, reason: '' }
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

// ─── POST /api/orders/[id]/accept ───────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { confirmed?: boolean } = {}
    try { body = await request.json() } catch {}
    const confirmed = body.confirmed === true
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

    // ─── 衝突檢查（在 transaction 外先做一次） ───────────
    const activeOrders = await prisma.order.findMany({
      where: {
        driverId,
        status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      select: { scheduledTime: true, type: true },
    })

    if (activeOrders.length > 0 && !confirmed) {
      const conflict = checkConflict(newOrderTime, order.type, activeOrders)

      if (conflict.blocked) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: conflict.reason,
          },
          { status: 400 }
        )
      }

      // ─── 不同類型但時間接近 → 提醒後仍可接 ───────────
      if (conflict.warning) {
        const warningMsg = `${conflict.reason}\n\n接單後退單，系統會扣該單金額的 10% 點數，接單前請務必確認接送日期和時間和已有行程是否衝突哦！`

        // 先檢查餘額，夠的話才回 warning
        const driver = await prisma.driver.findUnique({ where: { id: driverId } })
        const platformFee = Math.floor(order.price * 0.05)

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

        // 回傳 warning，讓前端顯示提醒，使用者確認後再接
        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            order,
            warning: warningMsg,
            proceed: true,
          },
        })
      }
    }

    // ─── Transaction ───────────────────────────────────
    const updated = await prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId } })

      if (!driver) throw new Error('找不到司機資料')

      // transaction 內再次檢查衝突（race condition guard）
      const activeOrdersInTx = await tx.order.findMany({
        where: {
          driverId,
          status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
        },
        select: { scheduledTime: true, type: true },
      })

      if (activeOrdersInTx.length > 0 && !confirmed) {
        const conflict = checkConflict(newOrderTime, order.type, activeOrdersInTx)
        if (conflict.blocked) throw new Error('BLOCKED')
      }

      const platformFee = Math.floor(order.price * 0.05)

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

    const platformFee = Math.floor(order.price * 0.05)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        order: updated,
        platformFee,
        newBalance: updated.driver?.balance,
        warning: null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'BLOCKED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '時間衝突：接送同類型行程需間隔至少 60 分鐘，請稍後再試' },
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
