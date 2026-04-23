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

// POST /api/messages/read-all - Mark all messages as read for the user
export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'messages' })
  if (rateLimitResult) return rateLimitResult

  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // Get all participant records for this user
    const participants = await prisma.messageParticipant.findMany({
      where: { userId: user.id },
      select: { threadId: true },
    })

    if (participants.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true, data: { ok: true } })
    }

    const threadIds = participants.map(p => p.threadId)
    const now = new Date()

    // Mark all unread messages from others as read in all threads
    await prisma.message.updateMany({
      where: {
        threadId: { in: threadIds },
        isRead: false,
        senderId: { not: user.id },
      },
      data: { isRead: true },
    })

    // Update lastReadAt for all participant records
    await prisma.messageParticipant.updateMany({
      where: { userId: user.id },
      data: { lastReadAt: now },
    })

    return NextResponse.json<ApiResponse>({ success: true, data: { ok: true } })
  } catch (error) {
    console.error('Mark all read error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
