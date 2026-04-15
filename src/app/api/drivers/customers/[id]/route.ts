/**
 * GET    /api/drivers/customers/[id] — 取得單一客戶
 * PUT    /api/drivers/customers/[id] — 更新客戶資料
 * DELETE /api/drivers/customers/[id] — 刪除客戶
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/drivers/customers/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const user = token ? await getUserFromToken(token) : null
    if (!user || user.role !== 'DRIVER') {
      return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
    }
    if (!user.driver) {
      return NextResponse.json({ success: false, error: '找不到司機資料' }, { status: 404 })
    }

    const customer = await prisma.driverCustomer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json({ success: false, error: '找不到客戶資料' }, { status: 404 })
    }
    if (customer.driverId !== user.driver.id) {
      return NextResponse.json({ success: false, error: '無權限查看他人的客戶' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: customer })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

// PUT /api/drivers/customers/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const user = token ? await getUserFromToken(token) : null
    if (!user || user.role !== 'DRIVER') {
      return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
    }
    if (!user.driver) {
      return NextResponse.json({ success: false, error: '找不到司機資料' }, { status: 404 })
    }

    const existing = await prisma.driverCustomer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '找不到客戶資料' }, { status: 404 })
    }
    if (existing.driverId !== user.driver.id) {
      return NextResponse.json({ success: false, error: '無權限修改他人的客戶' }, { status: 403 })
    }

    const body = await req.json()
    const { name, phone, commonPickup, commonDropoff, preferredVehicle, notes } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone.trim()
    if (commonPickup !== undefined) updateData.commonPickup = commonPickup?.trim() || null
    if (commonDropoff !== undefined) updateData.commonDropoff = commonDropoff?.trim() || null
    if (preferredVehicle !== undefined) updateData.preferredVehicle = preferredVehicle || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    const updated = await prisma.driverCustomer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

// DELETE /api/drivers/customers/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const user = token ? await getUserFromToken(token) : null
    if (!user || user.role !== 'DRIVER') {
      return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
    }
    if (!user.driver) {
      return NextResponse.json({ success: false, error: '找不到司機資料' }, { status: 404 })
    }

    const existing = await prisma.driverCustomer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '找不到客戶資料' }, { status: 404 })
    }
    if (existing.driverId !== user.driver.id) {
      return NextResponse.json({ success: false, error: '無權限刪除他人的客戶' }, { status: 403 })
    }

    await prisma.driverCustomer.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
