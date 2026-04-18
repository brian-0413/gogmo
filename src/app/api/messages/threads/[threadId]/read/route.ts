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

// POST /api/messages/threads/[threadId]/read - Mark all messages in thread as read
export async function POST(
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

    // Mark all unread messages from others as read
    await prisma.message.updateMany({
      where: { threadId, isRead: false, senderId: { not: user.id } },
      data: { isRead: true },
    })

    // Update lastReadAt for participant
    await prisma.messageParticipant.update({
      where: { threadId_userId: { threadId, userId: user.id } },
      data: { lastReadAt: new Date() },
    })

    return NextResponse.json<ApiResponse>({ success: true, data: { ok: true } })
  } catch (error) {
    console.error('Mark read error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
