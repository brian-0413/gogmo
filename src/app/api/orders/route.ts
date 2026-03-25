import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { parseOrderText, validateParsedOrder } from '@/lib/ai'
import { ApiResponse, CreateOrderRequest } from '@/types'

// Helper to get user from request
async function getUser(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  return getUserFromToken(token)
}

// GET /api/orders - List orders
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const driverId = searchParams.get('driverId')
    const myOrders = searchParams.get('myOrders') === 'true'

    const where: Record<string, unknown> = {}

    // Role-based filtering
    if (user.role === 'DRIVER' && user.driver) {
      if (myOrders) {
        where.driverId = user.driver.id
      } else {
        // Drivers can see available orders (PUBLISHED) or their own
        where.OR = [
          { status: 'PUBLISHED' },
          { driverId: user.driver.id },
        ]
      }
    } else if (user.role === 'DISPATCHER' && user.dispatcher) {
      where.dispatcherId = user.dispatcher.id
    }

    if (status) {
      where.status = status
    }

    if (driverId) {
      where.driverId = driverId
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        dispatcher: { include: { user: true } },
        driver: { include: { user: true } },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: orders,
    })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create order (dispatcher only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    if (user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有車頭可以建立訂單' },
        { status: 403 }
      )
    }

    let body: CreateOrderRequest
    try {
      body = await request.json() as CreateOrderRequest
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // Validate required fields (flightNumber is optional - can be added later)
    const required = ['passengerName', 'passengerPhone', 'pickupLocation', 'dropoffLocation', 'scheduledTime', 'price']
    for (const field of required) {
      if (body[field as keyof CreateOrderRequest] === undefined || body[field as keyof CreateOrderRequest] === null || body[field as keyof CreateOrderRequest] === '') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `缺少必填欄位: ${field}` },
          { status: 400 }
        )
      }
    }

    const order = await prisma.order.create({
      data: {
        dispatcherId: user.dispatcher.id,
        passengerName: body.passengerName,
        passengerPhone: body.passengerPhone,
        flightNumber: body.flightNumber,
        pickupLocation: body.pickupLocation,
        pickupAddress: body.pickupAddress || body.pickupLocation,
        pickupLat: body.pickupLat,
        pickupLng: body.pickupLng,
        dropoffLocation: body.dropoffLocation,
        dropoffAddress: body.dropoffAddress || body.dropoffLocation,
        dropoffLat: body.dropoffLat,
        dropoffLng: body.dropoffLng,
        passengerCount: body.passengerCount || 1,
        luggageCount: body.luggageCount || 0,
        scheduledTime: new Date(body.scheduledTime),
        price: body.price,
        note: body.note,
        status: 'PUBLISHED', // Dispatcher-created orders are immediately visible
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
    console.error('Create order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
