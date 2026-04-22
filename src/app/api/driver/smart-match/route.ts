import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { calculateSmartMatch, type SmartMatchOrder } from '@/lib/dispatch/smart-match-v2'

// GET /api/driver/smart-match?anchorId=xxx
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>({ success: false, error: '找不到司機資料' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const anchorId = searchParams.get('anchorId')

    if (!anchorId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '缺少 anchorId' }, { status: 400 })
    }

    // 取得錨點訂單（必須是已接單的行程）
    const anchor = await prisma.order.findUnique({
      where: { id: anchorId },
    })

    if (!anchor) {
      return NextResponse.json<ApiResponse>({ success: false, error: '錨點訂單不存在' }, { status: 404 })
    }

    // 錨點必須是該司機的行程
    if (anchor.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: '無權限使用此錨點' }, { status: 403 })
    }

    // 司機其他已接單（用於衝突檢查）
    const driverOrders = await prisma.order.findMany({
      where: {
        driverId: user.driver.id,
        status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      select: { id: true, scheduledTime: true, type: true },
    })

    // 取得可接單（PUBLISHED 且可見）
    const candidates = await prisma.order.findMany({
      where: {
        status: 'PUBLISHED',
        scheduledTime: { gte: new Date() },
      },
      select: {
        id: true,
        type: true,
        scheduledTime: true,
        pickupLocation: true,
        dropoffLocation: true,
        price: true,
        status: true,
        vehicleType: true,
        vehicleRequirement: true,
        originZone: true,
        destinationZone: true,
      },
    })

    // 轉換為 SmartMatchOrder 格式
    const anchorOrder: SmartMatchOrder = {
      id: anchor.id,
      type: anchor.type,
      scheduledTime: anchor.scheduledTime,
      pickupLocation: anchor.pickupLocation,
      dropoffLocation: anchor.dropoffLocation,
      price: anchor.price,
      status: anchor.status,
      vehicleType: anchor.vehicleType,
      vehicleRequirement: anchor.vehicleRequirement,
      originZone: anchor.originZone ?? null,
      destinationZone: anchor.destinationZone ?? null,
    }

    const candidateOrders: SmartMatchOrder[] = candidates.map(c => ({
      id: c.id,
      type: c.type,
      scheduledTime: c.scheduledTime,
      pickupLocation: c.pickupLocation,
      dropoffLocation: c.dropoffLocation,
      price: c.price,
      status: c.status,
      vehicleType: c.vehicleType ?? null,
      vehicleRequirement: c.vehicleRequirement ?? null,
      originZone: c.originZone ?? null,
      destinationZone: c.destinationZone ?? null,
    }))

    const driverExistingOrders: SmartMatchOrder[] = driverOrders.map(o => ({
      id: o.id,
      type: o.type,
      scheduledTime: o.scheduledTime,
      pickupLocation: '',
      dropoffLocation: '',
      price: 0,
      status: o.type,
    }))

    const recommendations = calculateSmartMatch(anchorOrder, candidateOrders, driverExistingOrders)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        anchorId,
        recommendations,
      },
    })
  } catch (error) {
    console.error('Smart match error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}