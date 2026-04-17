import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse, CreateOrderRequest } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'
import { MAX_FIELD_LENGTHS, MAX_ORDER_PRICE } from '@/lib/validation'
import { format } from 'date-fns'

// Helper to get user from request
async function getUser(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  return getUserFromToken(token)
}

// GET /api/orders - List orders
export async function GET(request: NextRequest) {
  // Apply rate limiting for read endpoints
  const rateLimitResult = checkRateLimit(request, { type: 'read' })
  if (rateLimitResult) return rateLimitResult

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
    const recommended = searchParams.get('recommended') === 'true'
    const pageRaw = parseInt(searchParams.get('page') || '1', 10)
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20, 100)
    const skip = (page - 1) * limit

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

    // Smart order recommendation for drivers
    // Returns orders sorted by a score based on urgency + price
    if (recommended && user.role === 'DRIVER' && user.driver) {
      where.status = 'PUBLISHED' // Only recommend published orders
    }

    // 司機查詢 PUBLISHED 時，一律排除已過期的行程
    if (user.role === 'DRIVER' && user.driver && where.OR) {
      // 在 OR 條件中加入時間過濾，確保 PUBLISHED 分支也排除過期訂單
      where.OR = (where.OR as Array<Record<string, unknown>>).map(condition => {
        if (condition.status === 'PUBLISHED') {
          return { ...condition, scheduledTime: { gte: new Date() } }
        }
        return condition
      })
    }

    // Fetch orders - for recommended, fetch more to sort in memory
    const fetchLimit = recommended ? Math.min(limit * 3, 100) : limit
    const orders = await prisma.order.findMany({
      where,
      include: {
        dispatcher: { include: { user: true } },
        driver: { include: { user: true } },
      },
      orderBy: recommended ? undefined : { scheduledTime: 'asc' },
      take: recommended ? fetchLimit : limit,
      skip: recommended ? 0 : skip,
    })

    let sortedOrders = orders

    // Smart recommendation scoring for drivers
    if (recommended && user.role === 'DRIVER') {
      const now = new Date()
      sortedOrders = orders
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((order: any) => {
          // Calculate time urgency score (0-100, higher = more urgent)
          const timeDiff = new Date(order.scheduledTime).getTime() - now.getTime()
          const minutesUntil = timeDiff / (1000 * 60)
          let urgencyScore = 0
          if (minutesUntil <= 30) urgencyScore = 100
          else if (minutesUntil <= 60) urgencyScore = 80
          else if (minutesUntil <= 120) urgencyScore = 60
          else if (minutesUntil <= 180) urgencyScore = 40
          else urgencyScore = 20

          // Calculate price score (0-100, normalized to 2000)
          const priceScore = Math.min((order.price / 2000) * 100, 100)

          // Combined score: urgency (60%) + price (40%)
          const recommendationScore = Math.round(urgencyScore * 0.6 + priceScore * 0.4)

          return { ...order, recommendationScore }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit) // Return only requested limit after sorting
    }

    const total = await prisma.order.count({ where })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        orders: sortedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
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
  // Apply rate limiting for order operations
  const rateLimitResult = checkRateLimit(request, { type: 'orders' })
  if (rateLimitResult) return rateLimitResult

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
        { success: false, error: '只有派單方可以建立訂單' },
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

    // Validate field lengths to prevent database errors

    for (const [field, maxLength] of Object.entries(MAX_FIELD_LENGTHS)) {
      const value = body[field as keyof CreateOrderRequest]
      if (value && typeof value === 'string' && value.length > maxLength) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `${field} 輸入過長，最多 ${maxLength} 字符` },
          { status: 400 }
        )
      }
    }

    // Validate price range
    if (body.price < 0 || body.price > MAX_ORDER_PRICE) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `價格必須在 0 - ${MAX_ORDER_PRICE.toLocaleString()} 元之間` },
        { status: 400 }
      )
    }

    // Validate passenger count
    if (body.passengerCount < 1 || body.passengerCount > 20) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '乘客人數必須在 1 - 20 人之間' },
        { status: 400 }
      )
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(body.scheduledTime)
    const now = new Date()
    if (scheduledDate < now) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '預定時間不能是過去的時間' },
        { status: 400 }
      )
    }

    // Validate vehicle enum values (database has ENUM restriction)
    const validVehicles = ['small', 'suv', 'van9', 'any', 'any_r', 'pending']
    if (body.vehicle && !validVehicles.includes(body.vehicle)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `車型 無效：${body.vehicle}。有效值：${validVehicles.join(', ')}` },
        { status: 400 }
      )
    }

    // Calculate daily sequence number (YYYYMMDD-0001 format)
    const todayStr = format(scheduledDate, 'yyyyMMdd')
    const lastOrder = await prisma.order.findFirst({
      where: { orderDate: todayStr, dispatcherId: user.dispatcher.id },
      orderBy: { orderSeq: 'desc' },
      select: { orderSeq: true },
    })
    const nextSeq = (lastOrder?.orderSeq ?? 0) + 1
    if (nextSeq > 9999) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '當日訂單已達上限 9999 筆' },
        { status: 400 }
      )
    }

    const order = await prisma.order.create({
      data: {
        orderDate: todayStr,
        orderSeq: nextSeq,
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
        type: body.type || 'pending',
        vehicle: body.vehicle || 'any',
        plateType: body.plateType || 'any',
        notes: body.notes,
        note: body.note,
        rawText: body.rawText,
        kenichiRequired: body.kenichiRequired ?? false,
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
    // Detailed server-side logging for debugging (never expose to client)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('=== Create order error ===')
    console.error('Message:', errorMessage)
    if (error instanceof Error) console.error('Stack:', error.stack)
    if (typeof error === 'object' && error !== null) {
      if ('code' in error) console.error('Prisma code:', (error as { code: string }).code)
      if ('meta' in error) console.error('Prisma meta:', JSON.stringify((error as { meta: unknown }).meta))
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
