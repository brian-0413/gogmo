import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { format } from 'date-fns'
import { addressToZone } from '@/lib/zones/v2/address-to-zone'

export interface PublishOrderInput {
  // 基本資訊
  passengerName: string
  passengerPhone: string
  scheduledTime: string      // ISO date string
  price: number
  type: string               // pickup / dropoff / transfer / charter / pending
  vehicleType?: string
  vehicleRequirement?: string
  // 地點
  pickupLocation: string
  pickupAddress: string
  dropoffLocation: string
  dropoffAddress: string
  // 航班/人數/行李
  flightNumber?: string
  passengerCount?: number
  luggageCount?: number
  // 備註
  note?: string
  originalMessage?: string
  // 智慧解析 extra
  contactName?: string
  specialRequests?: string
  pickupAddresses?: string[]
  dropoffAddresses?: string[]
  parsedByAI?: boolean
  kenichiRequired?: boolean
  isPremium?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以發布訂單' }, { status: 403 })
    }

    const body = await request.json()
    const { orders } = body as { orders: PublishOrderInput[] }

    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '請提供訂單陣列' }, { status: 400 })
    }

    if (orders.length > 20) {
      return NextResponse.json<ApiResponse>({ success: false, error: '最多一次發布 20 單' }, { status: 400 })
    }

    // 計算每日流水號
    const todayStr = format(new Date(), 'yyyyMMdd')

    // 建立訂單
    const createdIds: string[] = []
    const errors: string[] = []

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < orders.length; i++) {
        const orderInput = orders[i]

        try {
          // 解析 Zone
          const pickupZone = addressToZone(orderInput.pickupLocation) || addressToZone(orderInput.pickupAddress) || null
          const dropoffZone = addressToZone(orderInput.dropoffLocation) || addressToZone(orderInput.dropoffAddress) || null

          // 解析 scheduledTime
          const scheduledDate = new Date(orderInput.scheduledTime)

          // 取得當日最新流水號
          const lastOrder = await tx.order.findFirst({
            where: { orderDate: todayStr, dispatcherId: user.dispatcher!.id },
            orderBy: { orderSeq: 'desc' },
            select: { orderSeq: true },
          })
          const nextSeq = (lastOrder?.orderSeq ?? 0) + 1

          const created = await tx.order.create({
            data: {
              orderDate: todayStr,
              orderSeq: nextSeq,
              dispatcherId: user.dispatcher!.id,
              passengerName: orderInput.passengerName || '待確認',
              passengerPhone: orderInput.passengerPhone || '待確認',
              scheduledTime: scheduledDate,
              price: orderInput.price,
              type: orderInput.type || 'pending',
              vehicleType: (orderInput.vehicleType as any) || 'SEDAN_5',
              vehicleRequirement: (orderInput.vehicleRequirement as any) || 'EXACT',
              pickupLocation: orderInput.pickupLocation,
              pickupAddress: orderInput.pickupAddress || orderInput.pickupLocation,
              dropoffLocation: orderInput.dropoffLocation,
              dropoffAddress: orderInput.dropoffAddress || orderInput.dropoffLocation,
              flightNumber: orderInput.flightNumber || '',
              passengerCount: orderInput.passengerCount || 1,
              luggageCount: orderInput.luggageCount || 0,
              note: orderInput.note || '',
              originalMessage: orderInput.originalMessage || '',
              parsedByAI: orderInput.parsedByAI ?? false,
              contactName: orderInput.contactName || null,
              specialRequests: orderInput.specialRequests || null,
              pickupAddresses: orderInput.pickupAddresses || [],
              dropoffAddresses: orderInput.dropoffAddresses || [],
              kenichiRequired: orderInput.kenichiRequired ?? false,
              isPremium: orderInput.isPremium ?? false,
              originZone: pickupZone,
              destinationZone: dropoffZone,
              status: 'PUBLISHED',
            },
          })

          createdIds.push(created.id)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`第 ${i + 1} 單：${msg}`)
        }
      }
    })

    if (errors.length > 0 && createdIds.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `發布失敗：${errors.join('；')}` },
        { status: 400 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        count: createdIds.length,
        ids: createdIds,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error) {
    console.error('Publish batch error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}