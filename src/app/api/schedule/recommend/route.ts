import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { getSmartScheduleRecommendations } from '@/lib/scheduling'
import type { Order, OrderType } from '@/types'
import { TIGHTNESS_DROPOFF_PICKUP, TIGHTNESS_PICKUP_DROPOFF } from '@/lib/scheduling'

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

    // 計算司機今日已接單數（COMPLETED）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCompletedCount = await prisma.order.count({
      where: {
        driverId,
        status: 'COMPLETED',
        completedAt: { gte: today },
      },
    })

    // 呼叫智慧排班核心邏輯
    const result = getSmartScheduleRecommendations({
      driver: {
        id: driverId,
        carType: (user.driver.carType || 'pending') as Order['vehicle'],
        acceptedOrderCount: orders.length + todayCompletedCount,
        dailyOrderLimit: 6,
      },
      acceptedOrders: orders,
      availableOrders: available,
      startOrderId: triggerOrderId || undefined,
    })

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

    // 格式化 Recommendation -> 前端格式
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatRec = (rec: any, recType: 'pickup' | 'dropoff') => ({
      ...formatRecOrder(rec.order),
      waitMinutes: rec.waitMinutes ?? 0,
      bufferMinutes: rec.bufferMinutes ?? 0,
      emptyDriveMinutes: rec.emptyDriveMinutes ?? 0,
      tightnessLabel: rec.tightness?.label ?? '',
      tightnessLevel: rec.tightness?.level ?? 'reasonable',
      reason: rec.explanation ?? '',
      recommendType: recType,
    })

    // 建構排班時間軸
    const timeline: Array<{ time: string; label: string; orderId?: string; price?: number; isTrigger?: boolean; waitMinutes?: number; travelMinutes?: number }> = []
    if (result.currentOrder) {
      const isPickup = result.currentOrder.type === 'pickup' || result.currentOrder.type === 'pickup_boat'
      const scheduledTime = new Date(result.currentOrder.scheduledTime)
      timeline.push({
        time: scheduledTime.toISOString(),
        label: `${isPickup ? '接機' : '送機'} ${result.currentOrder.pickupLocation} → ${result.currentOrder.dropoffLocation}`,
        orderId: result.currentOrder.id,
        price: result.currentOrder.price,
        isTrigger: true,
      })
      if (result.arriveTime) {
        timeline.push({
          time: result.arriveTime.toISOString(),
          label: '抵達目的地',
          isTrigger: false,
        })
      }
      // 加入第一筆推薦
      if (result.mainRecommendations.length > 0) {
        const first = result.mainRecommendations[0]
        const isRecPickup = first.order.type === 'pickup' || first.order.type === 'pickup_boat'
        timeline.push({
          time: new Date(first.order.scheduledTime).toISOString(),
          label: `${isRecPickup ? '接機' : '送機'} ${first.order.pickupLocation} → ${first.order.dropoffLocation}`,
          orderId: first.order.id,
          price: first.order.price,
          isTrigger: false,
        })
      }
    }

    const totalIncome = orders.reduce((sum: number, o: any) => sum + (o.price || 0), 0)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        driverStatus: result.driverStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentOrders: (orders as any[]).map((o: any) => ({ ...o, scheduledTime: o.scheduledTime.toString() })),
        currentOrder: result.currentOrder ? { ...result.currentOrder, scheduledTime: new Date(result.currentOrder.scheduledTime).toISOString() } : null,
        arriveTime: result.arriveTime ? result.arriveTime.toISOString() : null,
        availableCount: available.length,
        recommendations: [],
        mainRecommendations: result.mainRecommendations.map(r => formatRec(r, r.order.type === 'pickup' || r.order.type === 'pickup_boat' ? 'pickup' : 'dropoff')),
        standbyRecommendations: result.standbyRecommendations.map(r => formatRec(r, r.order.type === 'pickup' || r.order.type === 'pickup_boat' ? 'pickup' : 'dropoff')),
        nextRecommendations: result.nextRecommendations.map(r => formatRec(r, r.order.type === 'pickup' || r.order.type === 'pickup_boat' ? 'pickup' : 'dropoff')),
        timeline,
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
