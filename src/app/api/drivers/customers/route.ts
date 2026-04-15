/**
 * GET  /api/drivers/customers — 取得司機的客戶列表
 * POST /api/drivers/customers — 新增客戶
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/drivers/customers
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

    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')
    const phone = searchParams.get('phone')

    const where: Record<string, unknown> = { driverId: user.driver.id }
    if (name) {
      where.name = { contains: name, mode: 'insensitive' }
    }
    if (phone) {
      where.phone = { contains: phone }
    }

    const customers = await prisma.driverCustomer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: customers })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

// POST /api/drivers/customers
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
    const { name, phone, commonPickup, commonDropoff, preferredVehicle, notes } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: '姓名為必填' }, { status: 400 })
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ success: false, error: '電話為必填' }, { status: 400 })
    }
    if (!/^\d[\d\-\s]{6,}$/.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json({ success: false, error: '電話格式不正確' }, { status: 400 })
    }

    const customer = await prisma.driverCustomer.create({
      data: {
        driverId: user.driver.id,
        name: name.trim(),
        phone: phone.trim(),
        commonPickup: commonPickup?.trim() || null,
        commonDropoff: commonDropoff?.trim() || null,
        preferredVehicle: preferredVehicle || null,
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: customer })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
