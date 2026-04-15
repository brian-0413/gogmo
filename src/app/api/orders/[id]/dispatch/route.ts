import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// POST /api/orders/[id]/dispatch - Dispatch QR order to public hall
// Only the assigned driver can dispatch, and only for QR orders
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
        { success: false, error: '只有司機可以外派訂單' },
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

    // Must be the assigned driver
    if (order.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單不是您承接的' },
        { status: 403 }
      )
    }

    // Must be a QR order
    if (!order.isQROrder) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有 QR 貴賓單可以外派' },
        { status: 400 }
      )
    }

    // Must be in ASSIGNED status
    if (order.status !== 'ASSIGNED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `QR 貴賓單目前狀態為 ${order.status}，無法外派` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { cashCollected, commissionReturn } = body

    if (cashCollected === undefined || cashCollected < 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請填寫實收金額（cashCollected）' },
        { status: 400 }
      )
    }

    if (commissionReturn === undefined || commissionReturn < 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請填寫回金金額（commissionReturn）' },
        { status: 400 }
      )
    }

    if (commissionReturn > cashCollected) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '回金金額不能超過實收金額' },
        { status: 400 }
      )
    }

    // Dispatch: change to PUBLISHED, clear driverId, store originalDriverId
    // price becomes cashCollected (what the new driver collects from passenger)
    // qrPrice stays as the locked original price
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        driverId: null, // release back to hall
        originalDriverId: user.driver.id,
        price: cashCollected, // new driver collects this from passenger
      },
      include: {
        dispatcher: { include: { user: true } },
        driver: true,
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        orderId: updated.id,
        status: updated.status,
        cashCollected,
        commissionReturn,
        driverEarn: cashCollected - commissionReturn,
        originalDriverId: user.driver.id,
        qrPrice: order.qrPrice,
      },
    })
  } catch (error) {
    console.error('Dispatch error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
