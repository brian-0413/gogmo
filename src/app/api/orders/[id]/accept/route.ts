import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

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
    if (order.status === 'ASSIGNED' && order.driverId && order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單已指派給其他司機' },
        { status: 400 }
      )
    }

    // Calculate platform fee (5%)
    const platformFee = Math.floor(order.price * 0.05)

    // Check if driver has enough balance
    if (user.driver.balance < platformFee) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `點數不足，需要 ${platformFee} 點` },
        { status: 400 }
      )
    }

    // Update order
    const updated = await prisma.order.update({
      where: { id },
      data: {
        driverId: user.driver.id,
        status: 'ACCEPTED',
      },
      include: {
        dispatcher: { include: { user: true } },
        driver: { include: { user: true } },
      },
    })

    // Deduct platform fee from driver balance
    await prisma.driver.update({
      where: { id: user.driver.id },
      data: {
        balance: user.driver.balance - platformFee,
      },
    })

    // Create transaction record
    await prisma.transaction.create({
      data: {
        orderId: id,
        driverId: user.driver.id,
        amount: -platformFee,
        type: 'PLATFORM_FEE',
        status: 'SETTLED',
        description: `接單平台費 (5%) - 訂單 #${id.slice(0, 8)}`,
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...updated,
        platformFee,
        newBalance: user.driver.balance - platformFee,
      },
    })
  } catch (error) {
    console.error('Accept order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
