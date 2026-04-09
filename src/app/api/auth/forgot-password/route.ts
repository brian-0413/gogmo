import { NextRequest, NextResponse } from 'next/server'
import { forgotPassword } from '@/lib/auth'
import { ApiResponse, ForgotPasswordRequest } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult
  const body = await request.json() as ForgotPasswordRequest
  if (!body.account || !body.role) {
    return NextResponse.json<ApiResponse>({ success: false, error: '缺少必填欄位' }, { status: 400 })
  }
  if (!['DRIVER', 'DISPATCHER'].includes(body.role)) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無效的角色' }, { status: 400 })
  }
  const result = await forgotPassword(body.account, body.role, body.email)
  if (!result.success) {
    return NextResponse.json<ApiResponse>({ success: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json<ApiResponse>({ success: true, data: { message: '重設連結已寄至您的 Email' } })
}
