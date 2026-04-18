import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

async function getUser(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  return getUserFromToken(token)
}

// GET /api/messages/threads - List threads for current user
export async function GET(request: NextRequest) {
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

    // Find all threads where user is a participant
    const participants = await prisma.messageParticipant.findMany({
      where: { userId: user.id },
      include: {
        thread: {
          include: {
            dispatcher: { include: { user: true } },
            driver: { include: { user: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    const threads = participants
      .map(p => p.thread)
      .filter(t => t !== null)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      .map(thread => {
        const lastMessage = thread.messages[0]
        return {
          id: thread.id,
          dispatcher: {
            id: thread.dispatcher.id,
            companyName: thread.dispatcher.companyName,
            user: { id: thread.dispatcher.user.id, name: thread.dispatcher.user.name },
          },
          driver: {
            id: thread.driver.id,
            licensePlate: thread.driver.licensePlate,
            user: { id: thread.driver.user.id, name: thread.driver.user.name },
          },
          lastMessage: lastMessage
            ? { content: lastMessage.content, createdAt: lastMessage.createdAt, isSystem: lastMessage.isSystem }
            : null,
          lastMessageAt: thread.lastMessageAt,
        }
      })

    return NextResponse.json<ApiResponse>({ success: true, data: { threads } })
  } catch (error) {
    console.error('List threads error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// POST /api/messages/threads - Create or get a thread
export async function POST(request: NextRequest) {
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

    const { dispatcherId, driverId } = await request.json() as { dispatcherId?: string; driverId?: string }

    if (user.role === 'DISPATCHER') {
      if (!driverId) return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 driverId' },
        { status: 400 }
      )
      const dispatcher = await prisma.dispatcher.findUnique({ where: { userId: user.id } })
      if (!dispatcher) return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到派單方資料' },
        { status: 404 }
      )
      const thread = await prisma.messageThread.upsert({
        where: { dispatcherId_driverId: { dispatcherId: dispatcher.id, driverId } },
        create: {
          dispatcherId: dispatcher.id,
          driverId,
          participants: {
            create: [
              { userId: user.id, role: 'DISPATCHER' },
              { userId: (await prisma.driver.findUnique({ where: { id: driverId }, select: { userId: true } }))!.userId, role: 'DRIVER' },
            ],
          },
        },
        update: {},
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })
      return NextResponse.json<ApiResponse>({ success: true, data: { thread } })
    } else if (user.role === 'DRIVER') {
      if (!dispatcherId) return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 dispatcherId' },
        { status: 400 }
      )
      const driver = await prisma.driver.findUnique({ where: { userId: user.id } })
      if (!driver) return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
      const thread = await prisma.messageThread.upsert({
        where: { dispatcherId_driverId: { dispatcherId, driverId: driver.id } },
        create: {
          dispatcherId,
          driverId: driver.id,
          participants: {
            create: [
              { userId: (await prisma.dispatcher.findUnique({ where: { id: dispatcherId }, select: { userId: true } }))!.userId, role: 'DISPATCHER' },
              { userId: user.id, role: 'DRIVER' },
            ],
          },
        },
        update: {},
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })
      return NextResponse.json<ApiResponse>({ success: true, data: { thread } })
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: '無權限' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Create thread error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
