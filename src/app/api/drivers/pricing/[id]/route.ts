import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// PUT /api/drivers/pricing/[id] - Update pricing entry
export async function PUT(
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
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const pricing = await prisma.driverPricing.findUnique({ where: { id } })
    if (!pricing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該報價' },
        { status: 404 }
      )
    }

    if (pricing.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權修改此報價' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    if (body.price !== undefined) {
      if (body.price < 0 || body.price > 50000) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '價格必須在 0 - 50000 元之間' },
          { status: 400 }
        )
      }
      updateData.price = body.price
    }

    if (body.enabled !== undefined) {
      updateData.enabled = body.enabled
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '沒有要更新的欄位' },
        { status: 400 }
      )
    }

    const updated = await prisma.driverPricing.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Update pricing error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// DELETE /api/drivers/pricing/[id] - Delete pricing entry
export async function DELETE(
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
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const pricing = await prisma.driverPricing.findUnique({ where: { id } })
    if (!pricing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該報價' },
        { status: 404 }
      )
    }

    if (pricing.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權刪除此報價' },
        { status: 403 }
      )
    }

    // Check if there are pending QR orders for this vehicle type
    const pendingOrders = await prisma.order.findFirst({
      where: {
        driverId: user.driver.id,
        vehicle: pricing.vehicleType,
        isQROrder: true,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'PICKED_UP'] },
      },
    })

    if (pendingOrders) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `尚有待處理的 ${pricing.vehicleType} 車型 QR 訂單，無法刪除` },
        { status: 400 }
      )
    }

    await prisma.driverPricing.delete({ where: { id } })

    return NextResponse.json<ApiResponse>({ success: true })
  } catch (error) {
    console.error('Delete pricing error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
