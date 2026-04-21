import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { PLATFORM_FEE_RATE } from '@/lib/constants'

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
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以審核' }, { status: 403 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { driver: { include: { user: true } }, dispatcher: true },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>({ success: false, error: '找不到訂單' }, { status: 404 })
    }

    if (order.status !== 'ASSIGNED') {
      return NextResponse.json<ApiResponse>({ success: false, error: '此訂單不在待審核狀態' }, { status: 400 })
    }

    if (order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: '無權限審核此訂單' }, { status: 403 })
    }

    const driverId = order.driverId!
    const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

    // Transaction: 扣點 + 寫 Transaction 記錄 + 改狀態為 ACCEPTED
    const updated = await prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId } })
      if (!driver) throw new Error('找不到司機資料')

      if (driver.balance < platformFee) {
        throw new Error(`司機點數不足，需要 ${platformFee} 點`)
      }

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

      return tx.order.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        include: { driver: { include: { user: true } } },
      })
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { order: updated, platformFee },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('點數不足')) {
      return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 400 })
    }
    console.error('Dispatcher approve error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
