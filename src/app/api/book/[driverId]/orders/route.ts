/**
 * POST /api/book/[driverId]/orders — 旅客送出 QR 訂單
 * 公開端點，無需登入
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ driverId: string }> }

// POST /api/book/[driverId]/orders
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { driverId } = await params

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        pricing: { where: { enabled: true } },
      },
    })

    if (!driver) {
      return NextResponse.json({ success: false, error: '司機不存在' }, { status: 404 })
    }

    if (!driver.isPremium) {
      return NextResponse.json({ success: false, error: '此司機尚未開放 QR 貴賓預訂' }, { status: 403 })
    }

    const body = await req.json()
    const {
      orderType,
      airport,
      scheduledTime,
      flightNumber,
      vehicleType,
      passengerCount,
      luggage,
      pickupLocation,
      dropoffLocation,
      contactName,
      contactPhone,
      notes,
    } = body

    // Validation
    if (!orderType || !['pickup', 'dropoff'].includes(orderType)) {
      return NextResponse.json({ success: false, error: '缺少或無效的行程類型' }, { status: 400 })
    }
    if (!scheduledTime) {
      return NextResponse.json({ success: false, error: '缺少預定時間' }, { status: 400 })
    }
    if (!vehicleType) {
      return NextResponse.json({ success: false, error: '缺少車型' }, { status: 400 })
    }
    if (!contactName || !contactName.trim()) {
      return NextResponse.json({ success: false, error: '缺少聯絡人姓名' }, { status: 400 })
    }
    if (!contactPhone || !contactPhone.trim()) {
      return NextResponse.json({ success: false, error: '缺少聯絡人電話' }, { status: 400 })
    }

    // Time validation: must be future
    const scheduledDate = new Date(scheduledTime)
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ success: false, error: '預定時間需為未來' }, { status: 400 })
    }

    // Vehicle validation
    const pricing = driver.pricing.find((p) => p.vehicleType === vehicleType)
    if (!pricing) {
      return NextResponse.json({ success: false, error: '該車型未開放預訂' }, { status: 400 })
    }

    // Luggage count
    const luggageCount = Array.isArray(luggage)
      ? luggage.reduce((sum: number, l: { quantity: number }) => sum + (l.quantity || 0), 0)
      : 0

    // Auto-upsert customer by phone
    const existingCustomer = await prisma.driverCustomer.findFirst({
      where: { driverId, phone: contactPhone.trim() },
    })

    if (existingCustomer) {
      await prisma.driverCustomer.update({
        where: { id: existingCustomer.id },
        data: {
          lastOrderAt: new Date(),
          commonPickup: pickupLocation?.trim() || existingCustomer.commonPickup,
          commonDropoff: dropoffLocation?.trim() || existingCustomer.commonDropoff,
        },
      })
    } else {
      await prisma.driverCustomer.create({
        data: {
          driverId,
          name: contactName.trim(),
          phone: contactPhone.trim(),
          commonPickup: pickupLocation?.trim() || null,
          commonDropoff: dropoffLocation?.trim() || null,
          preferredVehicle: vehicleType,
        },
      })
    }

    // Determine pickup/dropoff based on orderType
    const isPickup = orderType === 'pickup'
    const actualPickup = isPickup ? (airport || '') : (pickupLocation || '')
    const actualDropoff = isPickup ? (pickupLocation || '') : (airport || '')

    // Get dispatcher for QR orders
    const userDispatcher = await prisma.dispatcher.findUnique({
      where: { userId: driver.userId },
    })
    if (!userDispatcher) {
      return NextResponse.json({ success: false, error: '系統錯誤：無法建立訂單' }, { status: 500 })
    }

    const order = await prisma.order.create({
      data: {
        dispatcherId: userDispatcher.id,
        driverId,
        status: 'ASSIGNED',
        passengerName: contactName.trim(),
        passengerPhone: contactPhone.trim(),
        pickupLocation: actualPickup,
        pickupAddress: actualPickup,
        dropoffLocation: actualDropoff,
        dropoffAddress: actualDropoff,
        scheduledTime: scheduledDate,
        price: pricing.price,
        type: orderType,
        vehicle: vehicleType,
        plateType: 'R',
        passengerCount: passengerCount || 1,
        luggageCount,
        flightNumber: flightNumber || '',
        notes: notes || null,
        isSelfPublish: false,
        isQROrder: true,
        originalDriverId: driverId,
        qrPrice: pricing.price,
        transferStatus: 'pending',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        message: `感謝您的預訂！我已將您的需求傳給司機 ${driver.licensePlate}，他會盡快與您聯繫。`,
      },
    })
  } catch (err) {
    console.error('QR order creation error:', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
