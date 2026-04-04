import { NextRequest, NextResponse } from 'next/server'
import { register, getUserFromToken } from '@/lib/auth'
import { ApiResponse, RegisterRequest } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

// Register new user
export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoints
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult

  try {
    const body = await request.json() as RegisterRequest
    const { email, password, name, phone, role, licensePlate, carType, carColor, companyName } = body

    if (!email || !password || !name || !phone || !role) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少必填欄位' },
        { status: 400 }
      )
    }

    if (!['DRIVER', 'DISPATCHER'].includes(role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的角色' },
        { status: 400 }
      )
    }

    if (role === 'DRIVER' && !licensePlate) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '司機必須提供車牌號碼' },
        { status: 400 }
      )
    }

    const result = await register(email, password, name, phone, role, {
      licensePlate,
      carType: carType || '轎車',
      carColor,
      companyName,
    })

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { token: result.token, user: result.user },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// Get current user
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未提供認證令牌' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的認證令牌' },
        { status: 401 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        driver: user.driver,
        dispatcher: user.dispatcher,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
