import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken, sendVerifyEmail } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json<ApiResponse>({ success: false, error: '無效的 token' }, { status: 401 })
  if (user.emailVerified) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Email 已驗證' }, { status: 400 })
  }
  await sendVerifyEmail(user.id, user.email)
  return NextResponse.json<ApiResponse>({ success: true, data: { message: '驗證信已寄出' } })
}
