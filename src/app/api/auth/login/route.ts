import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import { ApiResponse, LoginRequest } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

// POST /api/auth/login
export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult

  try {
    const body = await request.json() as LoginRequest
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請提供 Email 和密碼' },
        { status: 400 }
      )
    }

    console.log('[AUTH LOGIN] Login request:', { email, hasPassword: !!password })

    const result = await login(email, password)

    console.log('[AUTH LOGIN] Login result:', { success: result.success, error: result.error, hasToken: !!result.token })

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 401 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { token: result.token, user: result.user },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
