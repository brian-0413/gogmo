import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

// In-memory map to track each driver's last check time
// In production, consider using Redis or a database
const driverLastCheckMap = new Map<string, Date>()

// SSE event types
type SSEEvent =
  | { type: 'NEW_ORDER'; order: unknown }
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'ORDER_CANCELLED'; orderId: string }

// GET /api/drivers/events - SSE endpoint for real-time order notifications
export async function GET(request: NextRequest) {
  // Try to get token from cookie first (EventSource doesn't support custom headers)
  // Fall back to Authorization header for fetch-based SSE
  let token: string | null = null

  try {
    const cookieStore = await cookies()
    token = cookieStore.get('auth_token')?.value || null
  } catch {
    // In edge/runtime contexts where cookies() might not work, fall back to header
    token = request.headers.get('Authorization')?.replace('Bearer ', '') || null
  }

  // Also check Authorization header as fallback
  if (!token) {
    token = request.headers.get('Authorization')?.replace('Bearer ', '') || null
  }

  if (!token) {
    return NextResponse.json(
      { success: false, error: '未授權' },
      { status: 401 }
    )
  }

  const user = await getUserFromToken(token)
  if (!user || user.role !== 'DRIVER' || !user.driver) {
    return NextResponse.json(
      { success: false, error: '找不到司機資料' },
      { status: 404 }
    )
  }

  const driverId = user.driver.id

  // Initialize last check time for this driver
  // Use 24 hours ago as fallback to catch orders created during server restart
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (!driverLastCheckMap.has(driverId)) {
    driverLastCheckMap.set(driverId, twentyFourHoursAgo)
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send an SSE message
      const sendEvent = (event: SSEEvent) => {
        if (isClosed) return
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch {
          // Controller may be closed
        }
      }

      // Send initial connection confirmation
      sendEvent({
        type: 'HEARTBEAT',
        timestamp: new Date().toISOString(),
      })

      // Immediately send all currently available PUBLISHED orders (that haven't been accepted yet)
      // This ensures the driver sees all existing orders on connect, not just new ones
      try {
        const currentOrders = await prisma.order.findMany({
          where: {
            status: 'PUBLISHED',
            driverId: null,
          },
          include: {
            dispatcher: { include: { user: true } },
          },
          orderBy: { updatedAt: 'desc' },
        })

        for (const order of currentOrders) {
          sendEvent({
            type: 'NEW_ORDER',
            order: {
              ...order,
              scheduledTime: order.scheduledTime.toISOString(),
              createdAt: order.createdAt.toISOString(),
              updatedAt: order.updatedAt.toISOString(),
              dispatcher: order.dispatcher
                ? {
                    ...order.dispatcher,
                    createdAt: order.dispatcher.createdAt.toISOString(),
                    updatedAt: order.dispatcher.updatedAt.toISOString(),
                  }
                : undefined,
            },
          })
        }
      } catch (error) {
        console.error('SSE initial orders fetch error:', error)
      }

      // Poll every 3 seconds for new orders
      const intervalId = setInterval(async () => {
        if (isClosed) {
          clearInterval(intervalId)
          return
        }

        try {
          // Get last check time for this driver
          const lastCheck = driverLastCheckMap.get(driverId) || now

          // Query for PUBLISHED orders updated since last check
          // Using updatedAt instead of createdAt so orders published after server restart are also caught
          // lastCheck defaults to 24h ago on fresh connection (see above)
          const newOrders = await prisma.order.findMany({
            where: {
              status: 'PUBLISHED',
              updatedAt: {
                gt: lastCheck,
              },
              driverId: null,
            },
            include: {
              dispatcher: { include: { user: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })

          // Update last check time
          driverLastCheckMap.set(driverId, new Date())

          // Send each new order as an SSE event
          for (const order of newOrders) {
            sendEvent({
              type: 'NEW_ORDER',
              order: {
                ...order,
                scheduledTime: order.scheduledTime.toISOString(),
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
                dispatcher: order.dispatcher
                  ? {
                      ...order.dispatcher,
                      createdAt: order.dispatcher.createdAt.toISOString(),
                      updatedAt: order.dispatcher.updatedAt.toISOString(),
                    }
                  : undefined,
              },
            })
          }

          // Send heartbeat
          sendEvent({
            type: 'HEARTBEAT',
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error('SSE poll error:', error)
          // Send heartbeat even on error to keep connection alive
          sendEvent({
            type: 'HEARTBEAT',
            timestamp: new Date().toISOString(),
          })
        }
      }, 3000) // 3 seconds

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        isClosed = true
        clearInterval(intervalId)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering if behind proxy
    },
  })
}
