/**
 * PUT    /api/drivers/pricing/[id] — 更新車型報價
 * DELETE /api/drivers/pricing/[id] — 刪除車型報價
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// PUT /api/drivers/pricing/[id]
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

    const existing = await prisma.driverPricing.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '找不到定價資料' }, { status: 404 })
    }
    if (existing.driverId !== user.driver.id) {
      return NextResponse.json({ success: false, error: '無權限修改他人的定價' }, { status: 403 })
    }

    const body = await req.json()
    const { price, enabled } = body

    const updateData: Record<string, unknown> = {}
    if (price !== undefined) {
      if (typeof price !== 'number' || price < 0) {
        return NextResponse.json({ success: false, error: '價格需為正數' }, { status: 400 })
      }
      updateData.price = price
    }
    if (enabled !== undefined) {
      updateData.enabled = enabled
    }

    const updated = await prisma.driverPricing.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

// DELETE /api/drivers/pricing/[id]
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

    const existing = await prisma.driverPricing.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '找不到定價資料' }, { status: 404 })
    }
    if (existing.driverId !== user.driver.id) {
      return NextResponse.json({ success: false, error: '無權限刪除他人的定價' }, { status: 403 })
    }

    await prisma.driverPricing.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch {
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
