import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { globalEmitter as sseEmitter } from '@/lib/sse-emitter'
import type { SquadTransferEvent } from '@/lib/sse-emitter'

// Track which dispatchers are listening
const squadClients = new Map<string, NodeJS.Timeout[]>()

type SSEEvent =
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'TRANSFER_CREATED'; transfer: SquadTransferEvent }
  | { type: 'TRANSFER_ACCEPTED'; transfer: SquadTransferEvent }
  | { type: 'TRANSFER_APPROVED'; transfer: SquadTransferEvent }
  | { type: 'TRANSFER_REJECTED'; transfer: SquadTransferEvent }
  | { type: 'TRANSFER_CANCELLED'; transfer: SquadTransferEvent }

// GET /api/squads/events — SSE endpoint for squad member real-time transfer notifications
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
  if (!user || user.role !== 'DRIVER' || !user.driver) {
    return NextResponse.json({ success: false, error: '只有司機可以接收小隊通知' }, { status: 403 })
  }

  const driverId = user.driver.id
  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    start(controller) {
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

      // Listen for squad transfer events
      const onSquadEvent = (event: SquadTransferEvent) => {
        if (isClosed) return
        sendEvent({ type: event.type as SSEEvent['type'], transfer: event } as SSEEvent)
        sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })
      }

      sseEmitter.on('squad-event', onSquadEvent)

      // Poll every 3 seconds for heartbeat
      const intervalId = setInterval(() => {
        if (isClosed) {
          clearInterval(intervalId)
          return
        }
        sendEvent({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })
      }, 3000)

      squadClients.set(driverId, [intervalId])

      request.signal.addEventListener('abort', () => {
        isClosed = true
        clearInterval(intervalId)
        sseEmitter.off('squad-event', onSquadEvent)
        squadClients.delete(driverId)
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
