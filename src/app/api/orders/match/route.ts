import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { findMatchingOrders, getDriverFreeTime, formatFreeTime, getFreeTimeAfterOrder } from '@/lib/availability'
import { ApiResponse, OrderType } from '@/types'

// GET /api/orders/match - 檢查司機的合適配單
export async function GET(request: NextRequest) {
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
      { success: false, error: '只有司機可以查看配單建議' },
      { status: 403 }
    )
  }

  try {
    const driverId = user.driver.id
    const driverVehicle = user.driver.carType

    // 1. 取得司機所有已接的行程（含狀態）
    const currentOrders = await prisma.order.findMany({
      where: {
        driverId,
        status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        scheduledTime: true,
        type: true,
        status: true,
        pickupLocation: true,
        dropoffLocation: true,
        price: true,
        vehicle: true,
        orderDate: true,
        orderSeq: true,
        passengerName: true,
        passengerCount: true,
        luggageCount: true,
        flightNumber: true,
        kenichiRequired: true,
      },
      orderBy: { scheduledTime: 'asc' },
    })

    // 2. 取得接單大廳所有可接訂單
    const availableOrders = await prisma.order.findMany({
      where: {
        status: 'PUBLISHED',
        driverId: null,
      },
      include: {
        dispatcher: { include: { user: true } },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    // 3. 格式化當前行程（計算每單的自由時間）
    const currentWithFreeTime = currentOrders.map((o) => ({
      ...o,
      scheduledTime: o.scheduledTime,
      type: o.type as OrderType,
      status: o.status as 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS',
      kenichiRequired: o.kenichiRequired ?? false,
      freeTime: getFreeTimeAfterOrder({ scheduledTime: o.scheduledTime, type: o.type as OrderType }),
    }))

    // 4. 計算司機最早可用時間
    const driverFreeTime = getDriverFreeTime(
      currentOrders.map((o) => ({
        scheduledTime: o.scheduledTime,
        type: o.type as OrderType,
        status: o.status as 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS',
      }))
    )

    // 5. 執行配單演算法
    const recommendations = findMatchingOrders(
      currentOrders.map((o) => ({
        scheduledTime: o.scheduledTime,
        type: o.type as OrderType,
        status: o.status as 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS',
      })),
      availableOrders.map((o) => ({
        id: o.id,
        orderDate: o.orderDate,
        orderSeq: o.orderSeq,
        dispatcherId: o.dispatcherId,
        driverId: o.driverId ?? undefined,
        status: o.status as import('@/types').OrderStatus,
        passengerName: o.passengerName,
        passengerPhone: o.passengerPhone,
        flightNumber: o.flightNumber,
        pickupLocation: o.pickupLocation,
        pickupAddress: o.pickupAddress,
        pickupLat: o.pickupLat ?? undefined,
        pickupLng: o.pickupLng ?? undefined,
        dropoffLocation: o.dropoffLocation,
        dropoffAddress: o.dropoffAddress,
        dropoffLat: o.dropoffLat ?? undefined,
        dropoffLng: o.dropoffLng ?? undefined,
        passengerCount: o.passengerCount,
        luggageCount: o.luggageCount,
        scheduledTime: o.scheduledTime,
        price: o.price,
        type: o.type as OrderType,
        vehicle: o.vehicle as import('@/types').VehicleType,
        plateType: o.plateType as import('@/types').PlateType,
        kenichiRequired: o.kenichiRequired ?? false,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt?.toISOString(),
        completedAt: o.completedAt?.toISOString() ?? undefined,
        startedAt: o.startedAt?.toISOString() ?? undefined,
        arrivedAt: o.arrivedAt?.toISOString() ?? undefined,
        pickedUpAt: o.pickedUpAt?.toISOString() ?? undefined,
        notes: o.notes ?? undefined,
        note: o.note ?? undefined,
        rawText: o.rawText ?? undefined,
      })),
      driverVehicle
    )

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        currentOrders: currentWithFreeTime.map((o) => ({
          id: o.id,
          scheduledTime: o.scheduledTime.toISOString(),
          type: o.type,
          status: o.status,
          pickupLocation: o.pickupLocation,
          dropoffLocation: o.dropoffLocation,
          price: o.price,
          freeTime: formatFreeTime(o.freeTime),
        })),
        driverFreeTime: formatFreeTime(driverFreeTime),
        recommendations: recommendations.map((r) => ({
          id: r.id,
          orderDate: r.orderDate,
          orderSeq: r.orderSeq,
          type: r.type,
          vehicle: r.vehicle,
          scheduledTime: r.scheduledTime instanceof Date
            ? r.scheduledTime.toISOString()
            : r.scheduledTime,
          price: r.price,
          pickupLocation: r.pickupLocation,
          dropoffLocation: r.dropoffLocation,
          passengerName: r.passengerName,
          passengerCount: r.passengerCount,
          luggageCount: r.luggageCount,
          flightNumber: r.flightNumber,
          kenichiRequired: r.kenichiRequired,
          minutesFromFree: r.minutesFromFree,
          reason: r.reason,
        })),
        summary: {
          currentOrdersCount: currentOrders.length,
          recommendationsCount: recommendations.length,
        },
      },
    })
  } catch (error) {
    console.error('Match orders error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
