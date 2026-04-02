import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// POST /api/orders/[id]/cancel - 司機退單（扣 10%）
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
        { success: false, error: '只有司機可以退單' },
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

    // 只有 ACCEPTED 狀態才能退單
    if (order.status !== 'ACCEPTED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有已接單的訂單才能退單' },
        { status: 400 }
      )
    }

    // 司機只能退自己接的單
    if (order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單不是您接的，無法退單' },
        { status: 403 }
      )
    }

    const driverId = user.driver.id
    const cancelFee = Math.floor(order.price * 0.1) // 退單扣 10%

    // Transaction：扣費 + 還原訂單狀態 + 記錄交易
    const updated = await prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId } })

      if (!driver) throw new Error('找不到司機資料')

      // 扣退單費（可能變負數）
      const newBalance = driver.balance - cancelFee

      await tx.driver.update({
        where: { id: driverId },
        data: { balance: newBalance },
      })

      // 還原訂單狀態
      await tx.order.update({
        where: { id },
        data: {
          driverId: null,
          status: 'PUBLISHED',
        },
      })

      // 記錄退單扣費
      await tx.transaction.create({
        data: {
          orderId: id,
          driverId,
          amount: -cancelFee,
          type: 'PLATFORM_FEE', // 複用現有 type，退單屬於平台罰款
          status: 'SETTLED',
          description: `退單扣費 (10%) - 訂單 #${id.slice(0, 8)}`,
        },
      })

      return { newBalance }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        cancelFee,
        newBalance: updated.newBalance,
        message: `退單成功，已扣除 ${cancelFee} 點（訂單金額 10%）`,
      },
    })
  } catch (error) {
    console.error('Cancel order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
