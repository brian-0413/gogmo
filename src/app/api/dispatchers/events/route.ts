import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { globalEmitter as sseEmitter, type DispatcherNotifyEvent } from '@/lib/sse-emitter'

// In-memory map: dispatcherId → last check time
const dispatcherLastCheckMap = new Map<string, Date>()

type SSEEvent =
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'ORDER_STATUS_CHANGE'; orderId: string; status: string; driverName: string; startedAt?: string; arrivedAt?: string; pickedUpAt?: string; completedAt?: string; transferStatus?: string }
  | { type: 'SQUAD_TRANSFER_PENDING'; transferId: string; orderId: string; fromDriverId: string; toDriverId?: string; status: string }
  | { type: 'SQUAD_TRANSFER_APPROVED'; transferId: string; orderId: string }
  | { type: 'SQUAD_TRANSFER_REJECTED'; transferId: string; orderId: string }
  | { type: 'SQUAD_TRANSFER_ACCEPTED'; transferId: string; orderId: string; fromDriverId: string; toDriverId: string }

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

      // Listen for dispatcher notification events (squad transfer notifications)
      const onDispatcherEvent = (event: DispatcherNotifyEvent) => {
        if (isClosed) return
        // Only send if this transfer belongs to this dispatcher
        if (event.type === 'TRANSFER_PENDING') {
          sendEvent({
            type: 'SQUAD_TRANSFER_PENDING',
            transferId: event.transferId,
            orderId: event.orderId,
            fromDriverId: event.fromDriverId,
            toDriverId: event.toDriverId,
            status: event.status,
          } as SSEEvent)
        } else if (event.type === 'TRANSFER_APPROVED') {
          sendEvent({
            type: 'SQUAD_TRANSFER_APPROVED',
            transferId: event.transferId,
            orderId: event.orderId,
          } as SSEEvent)
        } else if (event.type === 'TRANSFER_REJECTED') {
          sendEvent({
            type: 'SQUAD_TRANSFER_REJECTED',
            transferId: event.transferId,
            orderId: event.orderId,
          } as SSEEvent)
        }
        sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })
      }

      sseEmitter.on('dispatcher-event', onDispatcherEvent)

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
              transferStatus: order.transferStatus ?? undefined,
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
        sseEmitter.off('dispatcher-event', onDispatcherEvent)
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
