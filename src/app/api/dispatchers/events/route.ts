import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'

// In-memory map: dispatcherId → last check time
const dispatcherLastCheckMap = new Map<string, Date>()

type SSEEvent =
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'ORDER_STATUS_CHANGE'; orderId: string; status: string; driverName: string; startedAt?: string; arrivedAt?: string; pickedUpAt?: string; completedAt?: string }

// GET /api/dispatchers/events - SSE endpoint for dispatcher real-time updates
export async function GET(request: NextRequest) {
  let token: string | null = null

  try {
    const cookieStore = await cookies()
    token = cookieStore.get('auth_token')?.value || null
  } catch {
    token = request.headers.get('Authorization')?.replace('Bearer ', '') || null
  }

  if (!token) {
    token = request.headers.get('Authorization')?.replace('Bearer ', '') || null
  }

  if (!token) {
    return NextResponse.json({ success: false, error: '未授權' }, { status: 401 })
  }

  const user = await getUserFromToken(token)
  if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
    return NextResponse.json({ success: false, error: '找不到派單方資料' }, { status: 404 })
  }

  const dispatcherId = user.dispatcher.id
  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: SSEEvent) => {
        if (isClosed) return
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch {
          // Controller may be closed
        }
      }

      // Send initial heartbeat
      sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })

      // Poll every 3 seconds for status changes on this dispatcher's orders
      const intervalId = setInterval(async () => {
        if (isClosed) {
          clearInterval(intervalId)
          return
        }

        try {
          const lastCheck = dispatcherLastCheckMap.get(dispatcherId) || new Date(Date.now() - 60000)

          // 查詢此派單方所有司機已接的訂單中，有狀態變化的
          const changedOrders = await prisma.order.findMany({
            where: {
              dispatcherId,
              status: { in: ['IN_PROGRESS', 'ARRIVED', 'PICKED_UP', 'COMPLETED'] },
              updatedAt: { gt: lastCheck },
            },
            include: {
              driver: { include: { user: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })

          dispatcherLastCheckMap.set(dispatcherId, new Date())

          for (const order of changedOrders) {
            sendEvent({
              type: 'ORDER_STATUS_CHANGE',
              orderId: order.id,
              status: order.status,
              driverName: order.driver?.user?.name ?? '司機',
              startedAt: order.startedAt?.toISOString(),
              arrivedAt: order.arrivedAt?.toISOString(),
              pickedUpAt: order.pickedUpAt?.toISOString(),
              completedAt: order.completedAt?.toISOString(),
            })
          }

          sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })
        } catch (error) {
          console.error('Dispatcher SSE poll error:', error)
          sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })
        }
      }, 3000)

      request.signal.addEventListener('abort', () => {
        isClosed = true
        clearInterval(intervalId)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
