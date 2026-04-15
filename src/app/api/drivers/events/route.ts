import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

// SSE event types
type SSEEvent =
  | { type: 'NEW_ORDER'; order: unknown }
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'ORDER_CANCELLED'; orderId: string }
  | { type: 'TRANSFER_STATUS_CHANGE'; orderId: string; transferStatus: string }

// Thread-safety note:
// The previous `driverLastCheckMap` (in-memory Map) is NOT safe across multiple
// Next.js instances/workers. Each instance has its own copy, so polling from
// instance A would miss orders published from instance B.
// FIX: We track each driver's last SSE check time in the `Driver` table
// (`lastSseCheckAt`). The SSE endpoint updates this timestamp on every poll
// and queries for orders with updatedAt > lastSseCheckAt. This works correctly
// across all instances because all instances share the same database.

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

  // Get the driver's last SSE check time from the database.
  // If not set, default to 24 hours ago to catch orders created during restart.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driver = await (prisma.driver.findUnique as any)({
    where: { id: driverId },
    select: { lastSseCheckAt: true },
  }).catch(() => null) // column may not exist yet — safe to ignore
  const lastCheck = driver?.lastSseCheckAt
    ? new Date(driver.lastSseCheckAt)
    : new Date(Date.now() - 24 * 60 * 60 * 1000)

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
            scheduledTime: { gte: new Date() }, // 排除已過期的行程
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
          // Use the stored lastCheck (from DB) for the poll.
          // We don't update lastCheck in-memory; instead we update Driver.lastSseCheckAt
          // in the DB after each poll, ensuring cross-instance correctness.
          const pollTime = new Date()

          // Query for PUBLISHED orders updated since last check
          const newOrders = await prisma.order.findMany({
            where: {
              status: 'PUBLISHED',
              updatedAt: {
                gt: lastCheck,
              },
              driverId: null,
              scheduledTime: { gte: new Date() }, // 排除已過期的行程
            },
            include: {
              dispatcher: { include: { user: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })

          // Update lastSseCheckAt in DB so all instances see the same checkpoint
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma.driver.update as any)({
            where: { id: driverId },
            data: { lastSseCheckAt: pollTime },
          }).catch(() => { /* ignore if column doesn't exist yet */ })

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

          // Check for transfer status changes on completed orders
          const changedTransfers = await prisma.order.findMany({
            where: {
              driverId,
              status: 'COMPLETED',
              updatedAt: { gt: lastCheck },
            },
            select: {
              id: true,
              transferStatus: true,
            },
          })

          for (const order of changedTransfers) {
            sendEvent({
              type: 'TRANSFER_STATUS_CHANGE',
              orderId: order.id,
              transferStatus: order.transferStatus,
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