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

// GET /api/messages/threads/[threadId]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
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

    const { threadId } = await params

    // Verify user is a participant
    const participant = await prisma.messageParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: user.id } },
    })
    if (!participant) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權限存取此對話' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const pageRaw = parseInt(searchParams.get('page') || '1', 10)
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50, 100)
    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: skip,
      }),
      prisma.message.count({ where: { threadId } }),
    ])

    // Mark messages from other sender as read
    await prisma.message.updateMany({
      where: { threadId, isRead: false, senderId: { not: user.id } },
      data: { isRead: true },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        messages,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// POST /api/messages/threads/[threadId]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
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

    const { threadId } = await params

    // Verify user is a participant
    const participant = await prisma.messageParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: user.id } },
    })
    if (!participant) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權限存取此對話' },
        { status: 403 }
      )
    }

    const { content } = await request.json() as { content?: string }
    if (!content || content.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '訊息內容不可為空' },
        { status: 400 }
      )
    }

    const message = await prisma.message.create({
      data: {
        threadId,
        senderId: user.id,
        senderRole: user.role,
        content: content.trim(),
      },
    })

    // Update thread lastMessageAt
    await prisma.messageThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    })

    return NextResponse.json<ApiResponse>({ success: true, data: { message } })
  } catch (error) {
    console.error('Post message error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
