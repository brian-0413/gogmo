import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

const actionMap: Record<string, string> = {
  start: 'IN_PROGRESS',
  arrive: 'ARRIVED',
  pickup: 'PICKED_UP',
  complete: 'COMPLETED',
}

const nextActionMap: Record<string, string | null> = {
  IN_PROGRESS: 'arrive',
  ARRIVED: 'pickup',
  PICKED_UP: 'complete',
  COMPLETED: null,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有司機可以更新狀態' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (!action || !actionMap[action]) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的 action，請使用 start / arrive / pickup / complete' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json<ApiResponse>({ success: false, error: '找不到訂單' }, { status: 404 })
    }

    if (order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: '此訂單不是您承接的' }, { status: 403 })
    }

    const driverId = user.driver.id

    const targetStatus = actionMap[action]

    const validTransitions: Record<string, string[]> = {
      ACCEPTED: ['IN_PROGRESS'],
      IN_PROGRESS: ['ARRIVED'],
      ARRIVED: ['PICKED_UP'],
      PICKED_UP: ['COMPLETED'],
    }

    if (!validTransitions[order.status]?.includes(targetStatus)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `目前狀態為 ${order.status}，無法執行 ${action}` },
        { status: 400 }
      )
    }

    // 3小時門檻檢查（只有 start 需要）
    if (action === 'start') {
      const now = new Date()
      const scheduledTime = new Date(order.scheduledTime)
      const hoursUntil = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntil >= 3) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '行程時間尚未接近，請在出發前 3 小時內再試' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = { status: targetStatus }
    if (targetStatus === 'IN_PROGRESS') updateData.startedAt = new Date()
    if (targetStatus === 'ARRIVED')    updateData.arrivedAt = new Date()
    if (targetStatus === 'PICKED_UP')  updateData.pickedUpAt = new Date()
    if (targetStatus === 'COMPLETED')  updateData.completedAt = new Date()

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })

      if (targetStatus === 'COMPLETED') {
        // 建立行程收入交易（平台費已在接單時預扣，不再重複收取）
        await tx.transaction.create({
          data: {
            orderId: id,
            driverId: driverId,
            amount: order.price,
            type: 'RIDE_FARE',
            status: 'PENDING',
            description: `行程收入 - 訂單 #${id.slice(0, 8)}`,
          },
        })
        await tx.driver.update({
          where: { id: driverId },
          data: { status: 'ONLINE' },
        })
      }

      if (targetStatus === 'IN_PROGRESS') {
        await tx.driver.update({
          where: { id: driverId },
          data: { status: 'BUSY' },
        })
      }

      return updatedOrder
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        orderId: id,
        status: targetStatus,
        startedAt: updated.startedAt?.toISOString(),
        arrivedAt: updated.arrivedAt?.toISOString(),
        pickedUpAt: updated.pickedUpAt?.toISOString(),
        completedAt: updated.completedAt?.toISOString(),
        nextAction: nextActionMap[targetStatus] ?? null,
      },
    })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}