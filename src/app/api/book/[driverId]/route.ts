/**
 * GET /api/book/[driverId] — 取得司機的車型選項（QR 落地頁初始化）
 * 公開端點，無需登入
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ driverId: string }> }

// GET /api/book/[driverId]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { driverId } = await params

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        pricing: {
          where: { enabled: true },
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { name: true },
        },
      },
    })

    if (!driver) {
      return NextResponse.json({ success: false, error: '司機不存在' }, { status: 404 })
    }

    if (!driver.isPremium) {
      return NextResponse.json({ success: false, error: '此司機尚未開放 QR 貴賓預訂' }, { status: 403 })
    }

    const vehicleOptions = driver.pricing.map((p) => ({
      vehicleType: p.vehicleType,
      price: p.price,
      enabled: p.enabled,
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: driver.id,
        licensePlate: driver.licensePlate,
        carType: driver.carType,
        isPremium: driver.isPremium,
        pricing: vehicleOptions,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
