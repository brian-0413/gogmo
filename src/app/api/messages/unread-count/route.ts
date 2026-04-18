import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'
import { getUnreadCountByUser } from '@/lib/messages'

async function getUser(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  return getUserFromToken(token)
}

// GET /api/messages/unread-count
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

    const count = await getUnreadCountByUser(user.id)
    return NextResponse.json<ApiResponse>({ success: true, data: { count } })
  } catch (error) {
    console.error('Unread count error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
