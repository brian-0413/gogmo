import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import {
  getScheduleRecommendations,
  recommendPickupAfterDropoff,
  recommendDropoffAfterPickup,
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

    const { searchParams } = new URL(request.url)
    const triggerOrderId = searchParams.get('orderId')
    const driverId = user.driver.id

    // 抓司機已接的訂單（未完成）
    let currentOrders = await prisma.order.findMany({
      where: {
        driverId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    // 如果有指定 orderId，只取那一張當觸發
    if (triggerOrderId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentOrders = (currentOrders as any[]).filter((o: any) => o.id === triggerOrderId)
    }

    // 抓接單大廳所有 PUBLISHED 訂單
    const availableOrders = await prisma.order.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { scheduledTime: 'asc' },
    })

    // 轉換為前端 Order 型別（Date 欄位轉為 ISO 字串供 JSON 傳輸）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toOrder = (o: typeof currentOrders[0]): any => ({
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
      scheduledTime: new Date(o.scheduledTime).toISOString(),
      price: o.price,
      type: o.type as OrderType,
      vehicle: o.vehicle as Order['vehicle'],
      plateType: o.plateType as Order['plateType'],
      notes: o.notes ?? undefined,
      note: o.note ?? undefined,
      rawText: o.rawText ?? undefined,
      createdAt: new Date(o.createdAt).toISOString(),
      updatedAt: new Date(o.updatedAt).toISOString(),
      completedAt: o.completedAt ? new Date(o.completedAt).toISOString() : undefined,
      kenichiRequired: o.kenichiRequired ?? undefined,
      dispatcher: undefined,
      driver: undefined,
    })

    const orders = currentOrders.map(toOrder)
    const available = availableOrders.map(toOrder)

    // 如果司機沒有進行中的行程
    if (orders.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          currentOrders: [],
          currentOrder: null,
          availableCount: available.length,
          recommendations: [],
          timeline: [],
          totalIncome: 0,
          message: '您目前沒有進行中的行程，請到接單大廳接單',
        },
      })
    }

    if (available.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          currentOrders: (orders as any[]).map((o: any) => ({ ...o, scheduledTime: o.scheduledTime.toString() })),
          currentOrder: null,
          availableCount: 0,
          recommendations: [],
          timeline: [],
          totalIncome: 0,
          message: '目前接單大廳沒有可接的訂單',
        },
      })
    }

    // 取得完整排班推薦
    const scheduleRecs = getScheduleRecommendations(orders, available)

    // 找出最近的一張行程當觸發
    const sorted = [...orders].sort(
      (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    )
    const currentOrder = sorted[sorted.length - 1]

    // 收集所有推薦（攤平）
    const allPickupRecs = scheduleRecs.flatMap((r) => r.pickupRecommendations)
    const allDropoffRecs = scheduleRecs.flatMap((r) => r.dropoffRecommendations)

    // 建構前端扁平化推薦格式
    const formatRecOrder = (order: Order) => ({
      id: order.id,
      orderDate: order.orderDate,
      orderSeq: order.orderSeq,
      type: order.type,
      vehicle: order.vehicle,
      scheduledTime: new Date(order.scheduledTime).toISOString(),
      price: order.price,
      pickupLocation: order.pickupLocation,
      dropoffLocation: order.dropoffLocation,
      passengerName: order.passengerName,
      passengerCount: order.passengerCount,
      luggageCount: order.luggageCount,
      flightNumber: order.flightNumber,
      kenichiRequired: order.kenichiRequired,
    })

    // 計算銜接說明
    const buildReason = (
      rec: typeof allPickupRecs[0] | typeof allDropoffRecs[0],
      recType: 'pickup' | 'dropoff'
    ): string => {
      if (recType === 'pickup') {
        const r = rec as typeof allPickupRecs[0]
        return r.explanation
      } else {
        const r = rec as typeof allDropoffRecs[0]
        return r.explanation
      }
    }

    const recommendations = [
      ...allPickupRecs.map((r) => ({
        ...formatRecOrder(r.order),
        tightnessLabel: r.tightness.label,
        tightnessLevel: r.tightness.level,
        reason: r.explanation,
        recommendType: 'pickup' as const,
      })),
      ...allDropoffRecs.map((r) => ({
        ...formatRecOrder(r.order),
        tightnessLabel: r.tightness.label,
        tightnessLevel: r.tightness.level,
        reason: r.explanation,
        recommendType: 'dropoff' as const,
      })),
    ]

    // 建構排班時間軸（從現有行程 + 已選推薦）
    // timeline 的 currentOrders 部分
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentOrderNodes = (orders as any[]).map((o: any) => ({
      time: new Date(o.scheduledTime).toISOString(),
      label: `${o.type === 'pickup' || o.type === 'pickup_boat' ? '接機' : '送機'} ${o.pickupLocation} → ${o.dropoffLocation}`,
      orderId: o.id,
      price: o.price,
      isTrigger: o.id === currentOrder.id,
    }))

    // 加入第一筆推薦到時間軸（示範）
    if (recommendations.length > 0) {
      const firstRec = recommendations[0]
      currentOrderNodes.push({
        time: firstRec.scheduledTime,
        label: `${firstRec.recommendType === 'pickup' ? '接機' : '送機'} ${firstRec.pickupLocation} → ${firstRec.dropoffLocation}`,
        orderId: firstRec.id,
        price: firstRec.price,
        isTrigger: false,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalIncome = (orders as any[]).reduce((sum: any, o: any) => sum + o.price, 0)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentOrders: (orders as any[]).map((o: any) => ({ ...o, scheduledTime: o.scheduledTime.toString() })),
        currentOrder: { ...currentOrder, scheduledTime: currentOrder.scheduledTime.toString() },
        availableCount: available.length,
        recommendations,
        timeline: currentOrderNodes,
        totalIncome,
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
