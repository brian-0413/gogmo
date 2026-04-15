import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApiResponse } from '@/types'

// GET /api/book/[driverId] - Public: get driver's vehicle options (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: { select: { name: true } } },
    })

    if (!driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機' },
        { status: 404 }
      )
    }

    if (!driver.isPremium) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此司機尚未開通 QR 貴賓預訂功能' },
        { status: 403 }
      )
    }

    const pricing = await prisma.driverPricing.findMany({
      where: { driverId, enabled: true },
      orderBy: { vehicleType: 'asc' },
    })

    if (pricing.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此司機尚未設定車型報價，請稍後再試' },
        { status: 403 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        driverId: driver.id,
        driverName: driver.user.name,
        licensePlate: driver.licensePlate,
        vehicleOptions: pricing.map(p => ({
          vehicleType: p.vehicleType,
          price: p.price,
        })),
      },
    })
  } catch (error) {
    console.error('Get book info error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
