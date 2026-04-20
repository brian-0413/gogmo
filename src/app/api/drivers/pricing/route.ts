/**
 * GET  /api/drivers/pricing — 取得司機的車型報價列表
 * POST /api/drivers/pricing — 新增車型報價
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { VehicleType } from '@/lib/vehicle'

// GET /api/drivers/pricing
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const user = token ? await getUserFromToken(token) : null
    if (!user || user.role !== 'DRIVER') {
      return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
    }
    if (!user.driver) {
      return NextResponse.json({ success: false, error: '找不到司機資料' }, { status: 404 })
    }

    const pricing = await prisma.driverPricing.findMany({
      where: { driverId: user.driver.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: pricing })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

// POST /api/drivers/pricing
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const user = token ? await getUserFromToken(token) : null
    if (!user || user.role !== 'DRIVER') {
      return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
    }
    if (!user.driver) {
      return NextResponse.json({ success: false, error: '找不到司機資料' }, { status: 404 })
    }

    const body = await req.json()
    const { vehicleType, price, enabled = true } = body

    if (!vehicleType) {
      return NextResponse.json({ success: false, error: '缺少車型' }, { status: 400 })
    }
    if (price === undefined || price === null) {
      return NextResponse.json({ success: false, error: '缺少價格' }, { status: 400 })
    }
    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json({ success: false, error: '價格需為正數' }, { status: 400 })
    }
    if (![VehicleType.SEDAN_5, VehicleType.SUV_5, VehicleType.VAN_9].includes(vehicleType)) {
      return NextResponse.json({ success: false, error: '無效的車型' }, { status: 400 })
    }

    const existing = await prisma.driverPricing.findFirst({
      where: { driverId: user.driver.id, vehicleType },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: '該車型定價已存在' }, { status: 409 })
    }

    const pricing = await prisma.driverPricing.create({
      data: {
        driverId: user.driver.id,
        vehicleType,
        price,
        enabled,
      },
    })

    return NextResponse.json({ success: true, data: pricing })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
