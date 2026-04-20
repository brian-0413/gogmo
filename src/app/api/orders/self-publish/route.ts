import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, hashPassword } from '@/lib/auth'
import { ApiResponse, SelfPublishRequest } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'
import { MAX_ORDER_PRICE } from '@/lib/constants'
import { format } from 'date-fns'
import { randomUUID } from 'crypto'
import { normalizeVehicleInput } from '@/lib/vehicle'

export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'orders' })
  if (rateLimitResult) return rateLimitResult

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
        { success: false, error: '只有司機可以自助發單' },
        { status: 403 }
      )
    }

    // Premium 檢查
    if (!user.driver.isPremium) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此為 Premium 功能，請聯繫客服升級' },
        { status: 403 }
      )
    }

    let body: SelfPublishRequest
    try {
      body = await request.json() as SelfPublishRequest
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // 必填欄位驗證
    const required = ['orderType', 'scheduledTime', 'vehicleType', 'passengerCount', 'pickupLocation', 'dropoffLocation', 'contactName', 'contactPhone', 'feeMode', 'driverAmount']
    for (const field of required) {
      if (body[field as keyof SelfPublishRequest] === undefined || body[field as keyof SelfPublishRequest] === null || body[field as keyof SelfPublishRequest] === '') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `缺少必填欄位: ${field}` },
          { status: 400 }
        )
      }
    }

    // 航班必填檢查（接機/接船時）
    if ((body.orderType === 'pickup' || body.orderType === 'pickup_boat') && !body.flightNumber.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '接機/接船需填寫航班號碼' },
        { status: 400 }
      )
    }

    // 金額驗證
    if (body.driverAmount < 0 || body.driverAmount > MAX_ORDER_PRICE) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `司機實拿金額必須在 0 - ${MAX_ORDER_PRICE.toLocaleString()} 元之間` },
        { status: 400 }
      )
    }

    // 代收現金模式：回金不能超過代收
    if (body.feeMode === 'cash_collection') {
      if ((body.cashCollected ?? 0) < (body.commissionReturn ?? 0)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '回金金額不能超過代收金額' },
          { status: 400 }
        )
      }
    }

    // 時間驗證
    // datetime-local input 無時區資訊，視為台北時間（UTC+8）
    const scheduledTimeStr = body.scheduledTime
    const hasTimezone = scheduledTimeStr.includes('+') || scheduledTimeStr.includes('Z') || scheduledTimeStr.endsWith('+08:00')
    const scheduledDate = new Date(hasTimezone ? scheduledTimeStr : `${scheduledTimeStr}+08:00`)
    const now = new Date()
    if (scheduledDate < now) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '預定時間不能是過去的時間' },
        { status: 400 }
      )
    }

    // 車型正規化
    const normalized = normalizeVehicleInput(body.vehicleType)

    // 接送種類驗證
    const validTypes = ['pickup', 'dropoff', 'pickup_boat', 'dropoff_boat']
    if (!validTypes.includes(body.orderType)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `種類 無效：${body.orderType}` },
        { status: 400 }
      )
    }

    // 計算總行李數
    const luggageCount = body.luggage.reduce((sum, item) => sum + item.quantity, 0)

    // 組裝 notes（含特殊需求和行李資訊）
    const notesParts: string[] = []
    if (body.specialNeeds.length > 0) {
      notesParts.push(`特殊需求：${body.specialNeeds.join('、')}`)
    }
    if (body.luggage.length > 0) {
      notesParts.push(`行李：${body.luggage.map(l => `${l.size} x${l.quantity}`).join('、')}`)
    }
    if (body.notes) {
      notesParts.push(body.notes)
    }

    // 建立/找到司機自派的專用 dispatcher
    let selfDispatcher = await prisma.dispatcher.findFirst({
      where: { companyName: { startsWith: '[司機自派]' } },
    })

    if (!selfDispatcher) {
      // 建立系統級的自助發單派單方
      const sysUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
      if (!sysUser) {
        // 如果沒有 admin，建立一個虛擬 dispatcher
        const dummyUser = await prisma.user.create({
          data: {
            email: 'self-dispatch@goGMO.local',
            password: await hashPassword(randomUUID()),
            name: 'goGMO 系統',
            phone: '0000000000',
            role: 'DISPATCHER',
          },
        })
        selfDispatcher = await prisma.dispatcher.create({
          data: {
            userId: dummyUser.id,
            companyName: '[司機自派] goGMO 系統',
            commissionRate: 0,
          },
        })
      } else {
        selfDispatcher = await prisma.dispatcher.create({
          data: {
            userId: sysUser.id,
            companyName: '[司機自派] goGMO 系統',
            commissionRate: 0,
          },
        })
      }
    }

    // 計算 orderSeq（司機自派單的流水號，隔日歸零重新計算）
    // 直接從原始字串取出日期（scheduledTime 已是台北時間），避免 server timezone 干擾
    const todayStr = scheduledTimeStr.slice(0, 10).replace(/-/g, '')
    const lastSelfPublishOrder = await prisma.order.findFirst({
      where: {
        isSelfPublish: true,
        orderDate: todayStr,
        dispatcherId: selfDispatcher.id,
      },
      orderBy: { orderSeq: 'desc' },
      select: { orderSeq: true },
    })
    const nextSeq = (lastSelfPublishOrder?.orderSeq ?? 0) + 1
    if (nextSeq > 9999) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '當日自派單已達上限 9999 筆' },
        { status: 400 }
      )
    }

    const order = await prisma.order.create({
      data: {
        orderDate: todayStr,
        orderSeq: nextSeq,
        dispatcherId: selfDispatcher.id,
        passengerName: body.contactName,
        passengerPhone: body.contactPhone,
        flightNumber: body.flightNumber || '',
        pickupLocation: body.pickupLocation,
        pickupAddress: body.pickupLocation,
        dropoffLocation: body.dropoffLocation,
        dropoffAddress: body.dropoffLocation,
        passengerCount: body.passengerCount,
        luggageCount,
        scheduledTime: scheduledDate,
        price: body.driverAmount,
        type: body.orderType,
        vehicleType: normalized.vehicleType,
        vehicleRequirement: normalized.requirement,
        customVehicleNote: normalized.customVehicleNote,
        allowTaxiPlate: false,
        notes: notesParts.join('\n') || undefined,
        status: 'PUBLISHED',
        isSelfPublish: true,
      },
      include: {
        dispatcher: { include: { user: true } },
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: order,
    })
  } catch (error) {
    console.error('Self publish error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
