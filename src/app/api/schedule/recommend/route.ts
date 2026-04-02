import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import {
  getScheduleRecommendations,
  formatTightnessLabel,
} from '@/lib/scheduling'
import type { Order, OrderType } from '@/types'

// GET /api/schedule/recommend — 根據司機已接訂單推薦可銜接訂單
export async function GET(request: NextRequest) {
  try {
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
        { success: false, error: '只有司機可以使用此功能' },
        { status: 403 }
      )
    }

    const driverId = user.driver.id

    // 抓司機已接的訂單（未完成）
    const currentOrders = await prisma.order.findMany({
      where: {
        driverId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    if (currentOrders.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          recommendations: [],
          message: '您目前沒有進行中的行程，無需推薦',
        },
      })
    }

    // 抓接單大廳所有 PUBLISHED 訂單
    const availableOrders = await prisma.order.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { scheduledTime: 'asc' },
    })

    if (availableOrders.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          recommendations: [],
          message: '目前接單大廳沒有可接的訂單',
        },
      })
    }

    // 轉換類型
    const orders: Order[] = currentOrders.map((o) => ({
      id: o.id,
      orderDate: o.orderDate,
      orderSeq: o.orderSeq,
      dispatcherId: o.dispatcherId,
      driverId: o.driverId ?? undefined,
      status: o.status as Order['status'],
      passengerName: o.passengerName,
      passengerPhone: o.passengerPhone,
      flightNumber: o.flightNumber,
      pickupLocation: o.pickupLocation,
      pickupAddress: o.pickupAddress,
      dropoffLocation: o.dropoffLocation,
      dropoffAddress: o.dropoffAddress,
      passengerCount: o.passengerCount,
      luggageCount: o.luggageCount,
      scheduledTime: o.scheduledTime,
      price: o.price,
      type: o.type as OrderType,
      vehicle: o.vehicle as Order['vehicle'],
      plateType: o.plateType as Order['plateType'],
      notes: o.notes ?? undefined,
      note: o.note ?? undefined,
      rawText: o.rawText ?? undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      completedAt: o.completedAt ?? undefined,
      kenichiRequired: o.kenichiRequired ?? undefined,
      dispatcher: undefined,
      driver: undefined,
    }))

    const available: Order[] = availableOrders.map((o) => ({
      id: o.id,
      orderDate: o.orderDate,
      orderSeq: o.orderSeq,
      dispatcherId: o.dispatcherId,
      driverId: o.driverId ?? undefined,
      status: o.status as Order['status'],
      passengerName: o.passengerName,
      passengerPhone: o.passengerPhone,
      flightNumber: o.flightNumber,
      pickupLocation: o.pickupLocation,
      pickupAddress: o.pickupAddress,
      dropoffLocation: o.dropoffLocation,
      dropoffAddress: o.dropoffAddress,
      passengerCount: o.passengerCount,
      luggageCount: o.luggageCount,
      scheduledTime: o.scheduledTime,
      price: o.price,
      type: o.type as OrderType,
      vehicle: o.vehicle as Order['vehicle'],
      plateType: o.plateType as Order['plateType'],
      notes: o.notes ?? undefined,
      note: o.note ?? undefined,
      rawText: o.rawText ?? undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      completedAt: o.completedAt ?? undefined,
      kenichiRequired: o.kenichiRequired ?? undefined,
      dispatcher: undefined,
      driver: undefined,
    }))

    const recommendations = getScheduleRecommendations(orders, available)

    // 格式化輸出
    const formatted = recommendations.map((rec) => ({
      triggerOrder: rec.triggerOrder,
      type: rec.type,
      airport: rec.airport,
      pickupRecommendations: rec.pickupRecommendations.map((r) => ({
        order: r.order,
        arriveAtAirport: r.arriveAtAirport.toISOString(),
        landingTime: r.landingTime.toISOString(),
        tightness: {
          level: r.tightness.level,
          label: r.tightness.label,
        },
        waitMinutes: r.waitMinutes,
        explanation: r.explanation,
      })),
      dropoffRecommendations: rec.dropoffRecommendations.map((r) => ({
        order: r.order,
        arriveAtDest: r.arriveAtDest.toISOString(),
        sendTime: r.sendTime.toISOString(),
        tightness: {
          level: r.tightness.level,
          label: r.tightness.label,
        },
        bufferMinutes: r.bufferMinutes,
        explanation: r.explanation,
      })),
      timeline: rec.timeline.map((node) => ({
        time: node.time.toISOString(),
        label: node.label,
        orderId: node.order?.id,
        isTrigger: node.isTrigger,
        waitMinutes: node.waitMinutes,
        travelMinutes: node.travelMinutes,
        peakLabel: node.peakLabel,
      })),
      totalIncome: rec.totalIncome,
    }))

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        currentOrders: orders,
        availableCount: available.length,
        recommendations: formatted,
      },
    })
  } catch (error) {
    console.error('Schedule recommend error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
