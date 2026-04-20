import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastDispatcherEvent } from '@/lib/sse-emitter'
import { TRANSFER_LOCK_HOURS, MIN_BONUS_POINTS } from '@/lib/constants'

// POST /api/orders/[id]/transfer-request — 發起轉單請求（派單方核准流程）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { reason?: string; bonusPoints?: number } = {}
    try { body = await request.json() } catch {}

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
        { success: false, error: '只有司機可以發起轉單' },
        { status: 403 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        dispatcher: { include: { user: true } },
      },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到訂單' },
        { status: 404 }
      )
    }

    // 確認是本人的 ACCEPTED 訂單
    if (order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單不是您接的，無法發起轉單' },
        { status: 403 }
      )
    }

    if (order.status !== 'ACCEPTED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有已接單的訂單才能發起轉單' },
        { status: 400 }
      )
    }

    // 行程前 1 小時鎖定檢查
    const scheduledTime = new Date(order.scheduledTime)
    const now = new Date()
    const hoursUntilTrip = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursUntilTrip <= TRANSFER_LOCK_HOURS) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `行程前 ${TRANSFER_LOCK_HOURS} 小時已鎖定，無法轉單` },
        { status: 400 }
      )
    }

    // 檢查司機是否有小隊
    const membership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
      include: { squad: true },
    })

    if (!membership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您尚未加入任何小隊，無法發起轉單' },
        { status: 403 }
      )
    }

    // 檢查是否有進行中的轉單請求
    const existingTransfer = await prisma.orderTransfer.findFirst({
      where: {
        orderId: id,
        status: { in: ['PENDING_SQUAD', 'PENDING_DISPATCHER'] },
      },
    })

    if (existingTransfer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單已有進行中的轉單請求' },
        { status: 400 }
      )
    }

    // bonusPoints 處理
    const bonusPoints = body.bonusPoints ?? 0
    const driverId = user.driver.id
    const driverBalance = user.driver.balance

    // 類型驗證（防止 NaN/Infinity/字串導致餘額腐蝕）
    if (bonusPoints !== undefined) {
      if (typeof bonusPoints !== 'number' || !Number.isFinite(bonusPoints) || bonusPoints < 0) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'bonusPoints 格式不正確' },
          { status: 400 }
        )
      }
      if (bonusPoints < MIN_BONUS_POINTS) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `bonusPoints 最低為 ${MIN_BONUS_POINTS} 點` },
          { status: 400 }
        )
      }
      if (driverBalance < bonusPoints) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'bonus 點數不可超過司機餘額' },
          { status: 400 }
        )
      }
    }

    // 計算轉單費用（3%，此時不扣，等 pool claim 時扣）
    const transferFee = Math.floor(order.price * 0.03)

    // 在 transaction 內：扣 bonusPoints + 建立轉單記錄
    const transfer = await prisma.$transaction(async (tx) => {
      // 扣 bonusPoints
      if (bonusPoints > 0) {
        await tx.driver.update({
          where: { id: driverId },
          data: { balance: { decrement: bonusPoints } },
        })

        // 建立 Transaction 記錄（bonus 鎖定）
        await tx.transaction.create({
          data: {
            driverId,
            orderId: id,
            amount: -bonusPoints,
            type: 'RECHARGE',
            status: 'SETTLED',
            description: `轉單 bonus 鎖定（訂單 ${order.orderSeq ?? order.id}）`,
          },
        })
      }

      // 建立轉單記錄
      return tx.orderTransfer.create({
        data: {
          orderId: id,
          fromDriverId: driverId,
          squadId: membership.squadId,
          transferFee,
          bonusPoints,
          reason: body.reason ?? null,
          status: 'PENDING_DISPATCHER',
        },
        include: {
          order: {
            select: {
              id: true,
              orderSeq: true,
              scheduledTime: true,
              price: true,
              pickupLocation: true,
              dropoffLocation: true,
              type: true,
              vehicleType: true,
            },
          },
          fromDriver: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      })
    })

    // 廣播 SQUAD_TRANSFER_PENDING 到派單方
    broadcastDispatcherEvent({
      type: 'SQUAD_TRANSFER_PENDING',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: user.driver.id,
      status: 'PENDING_DISPATCHER',
      note: body.reason ?? undefined,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { transfer },
    })
  } catch (error) {
    console.error('Transfer request error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// GET /api/orders/[id]/transfer-request — 查詢轉單狀態
export async function GET(
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
        { success: false, error: '只有司機可以查詢轉單狀態' },
        { status: 403 }
      )
    }

    const transfer = await prisma.orderTransfer.findFirst({
      where: {
        orderId: id,
        fromDriverId: user.driver.id,
        status: { in: ['PENDING_SQUAD', 'PENDING_DISPATCHER'] },
      },
      include: {
        order: {
          select: {
            id: true,
            orderSeq: true,
            scheduledTime: true,
            price: true,
            pickupLocation: true,
            dropoffLocation: true,
            type: true,
            vehicleType: true,
          },
        },
        fromDriver: {
          include: {
            user: { select: { name: true } },
          },
        },
        toDriver: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { transfer },
    })
  } catch (error) {
    console.error('Get transfer request error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
