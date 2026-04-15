import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApiResponse } from '@/types'

// POST /api/book/[driverId]/orders - Public: create QR order (no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params

    // Verify driver exists and is Premium
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    })

    if (!driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機' },
        { status: 404 }
      )
    }

    if (!driver.isPremium) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此司機尚未開通 QR 貴賓預訂功能' },
        { status: 403 }
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // Required fields validation
    const required = ['orderType', 'scheduledTime', 'vehicleType', 'passengerCount', 'pickupLocation', 'dropoffLocation', 'contactName', 'contactPhone']
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `缺少必填欄位: ${field}` },
          { status: 400 }
        )
      }
    }

    // Vehicle type validation
    const validVehicles = ['small', 'suv', 'van9']
    if (!validVehicles.includes(body.vehicleType as string)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `車型無效：${body.vehicleType}` },
        { status: 400 }
      )
    }

    // Order type validation
    const validTypes = ['pickup', 'dropoff', 'pickup_boat', 'dropoff_boat']
    if (!validTypes.includes(body.orderType as string)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `種類無效：${body.orderType}` },
        { status: 400 }
      )
    }

    // Passenger count validation
    if ((body.passengerCount as number) < 1 || (body.passengerCount as number) > 20) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '乘客人數必須在 1 - 20 人之間' },
        { status: 400 }
      )
    }

    // Scheduled time validation (must be in future)
    const scheduledDate = new Date(body.scheduledTime as string)
    const now = new Date()
    if (scheduledDate < now) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '預定時間不能是過去的時間' },
        { status: 400 }
      )
    }

    // Verify pricing entry exists and is enabled
    const pricing = await prisma.driverPricing.findUnique({
      where: {
        driverId_vehicleType: {
          driverId,
          vehicleType: body.vehicleType as string,
        },
      },
    })

    if (!pricing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該車型的報價' },
        { status: 404 }
      )
    }

    if (!pricing.enabled) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '該車型目前未開放' },
        { status: 400 }
      )
    }

    // Calculate luggage count
    const luggage: Array<{ size: string; quantity: number }> = (body.luggage as Array<{ size: string; quantity: number }>) || []
    const luggageCount = luggage.reduce((sum, item) => sum + (item.quantity || 0), 0)

    // Get or create the QR order dispatcher (shared with self-publish)
    let qrDispatcher = await prisma.dispatcher.findFirst({
      where: { companyName: { startsWith: '[QR貴賓]' } },
    })

    if (!qrDispatcher) {
      const sysUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
      if (!sysUser) {
        // Create a dummy user if no admin exists
        const dummyUser = await prisma.user.create({
          data: {
            email: 'qr-dispatch@goGMO.local',
            password: 'DO_NOT_USE_THIS_ACCOUNT',
            name: 'goGMO 系統',
            phone: '0000000000',
            role: 'DISPATCHER',
          },
        })
        qrDispatcher = await prisma.dispatcher.create({
          data: {
            userId: dummyUser.id,
            companyName: '[QR貴賓] goGMO 系統',
            commissionRate: 0,
          },
        })
      } else {
        qrDispatcher = await prisma.dispatcher.create({
          data: {
            userId: sysUser.id,
            companyName: '[QR貴賓] goGMO 系統',
            commissionRate: 0,
          },
        })
      }
    }

    // Calculate order sequence
    const todayStr = scheduledDate.toISOString().slice(0, 10).replace(/-/g, '')
    const lastOrder = await prisma.order.findFirst({
      where: {
        isQROrder: true,
        orderDate: todayStr,
        dispatcherId: qrDispatcher.id,
      },
      orderBy: { orderSeq: 'desc' },
      select: { orderSeq: true },
    })
    const nextSeq = (lastOrder?.orderSeq ?? 0) + 1

    // Build notes string
    const notesParts: string[] = []
    if ((body.notes as string)?.trim()) {
      notesParts.push(body.notes as string)
    }
    if (luggage.length > 0) {
      notesParts.push(`行李：${luggage.map(l => `${l.size} x${l.quantity}`).join('、')}`)
    }

    // Auto upsert customer
    const contactPhone = (body.contactPhone as string).trim()
    const existingCustomer = await prisma.driverCustomer.findUnique({
      where: {
        driverId_phone: {
          driverId,
          phone: contactPhone,
        },
      },
    })

    const pickupLocation = (body.pickupLocation as string).trim()
    const dropoffLocation = (body.dropoffLocation as string).trim()

    if (existingCustomer) {
      // Update lastOrderAt and common locations
      await prisma.driverCustomer.update({
        where: { id: existingCustomer.id },
        data: {
          lastOrderAt: new Date(),
          commonPickup: pickupLocation,
          commonDropoff: dropoffLocation,
        },
      })
    } else {
      // Create new customer
      await prisma.driverCustomer.create({
        data: {
          driverId,
          name: (body.contactName as string).trim(),
          phone: contactPhone,
          commonPickup: pickupLocation,
          commonDropoff: dropoffLocation,
          preferredVehicle: body.vehicleType as string,
          lastOrderAt: new Date(),
        },
      })
    }

    // Create the QR order
    const order = await prisma.order.create({
      data: {
        orderDate: todayStr,
        orderSeq: nextSeq,
        dispatcherId: qrDispatcher.id,
        driverId,
        passengerName: (body.contactName as string).trim(),
        passengerPhone: contactPhone,
        flightNumber: (body.flightNumber as string)?.trim() || '',
        pickupLocation,
        pickupAddress: pickupLocation,
        dropoffLocation,
        dropoffAddress: dropoffLocation,
        passengerCount: body.passengerCount as number,
        luggageCount,
        scheduledTime: scheduledDate,
        price: pricing.price,
        type: body.orderType as string,
        vehicle: body.vehicleType as string,
        plateType: 'any',
        notes: notesParts.join('\n') || undefined,
        status: 'ASSIGNED',
        isQROrder: true,
        qrPrice: pricing.price,
      },
      include: {
        dispatcher: { include: { user: true } },
        driver: { include: { user: true } },
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        orderId: order.id,
        message: `感謝您的預訂！我已將您的需求傳給司機 ${driver.licensePlate}，他會盡快與您聯繫。`,
      },
    })
  } catch (error) {
    console.error('Create QR order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
