import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse, DriverStatus } from '@/types'

// GET /api/drivers - Get drivers (dispatcher only)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // Dispatcher can see their own drivers
    if (user.role === 'DISPATCHER' && user.dispatcher) {
      const drivers = await prisma.driver.findMany({
        where: {
          // For now, show all drivers (in production, filter by dispatcher)
        },
        include: { user: true },
        orderBy: { status: 'asc' },
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: drivers,
      })
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: '無權查看司機列表' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Get drivers error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
