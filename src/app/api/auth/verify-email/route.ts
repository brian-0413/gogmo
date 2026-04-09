import { NextRequest, NextResponse } from 'next/server'
import { verifyEmail } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/email-verified?status=invalid', request.url))
  }
  const result = await verifyEmail(token)
  if (!result.success) {
    return NextResponse.redirect(new URL(`/email-verified?status=error&message=${encodeURIComponent(result.error || '驗證失敗')}`, request.url))
  }
  return NextResponse.redirect(new URL('/email-verified?status=success', request.url))
}
