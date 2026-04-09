import { NextRequest, NextResponse } from 'next/server'
import { resetPassword } from '@/lib/auth'
import { ApiResponse, ResetPasswordRequest } from '@/types'

export async function POST(request: NextRequest) {
  const body = await request.json() as ResetPasswordRequest
  if (!body.token || !body.newPassword) {
    return NextResponse.json<ApiResponse>({ success: false, error: '缺少必填欄位' }, { status: 400 })
  }
  if (body.newPassword.length < 6) {
    return NextResponse.json<ApiResponse>({ success: false, error: '密碼至少 6 個字元' }, { status: 400 })
  }
  const result = await resetPassword(body.token, body.newPassword)
  if (!result.success) {
    return NextResponse.json<ApiResponse>({ success: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json<ApiResponse>({ success: true, data: { message: '密碼已重設，請使用新密碼登入' } })
}
