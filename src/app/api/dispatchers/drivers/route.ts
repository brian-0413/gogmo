import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/dispatchers/drivers - Get drivers for dispatcher
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
    if (!user || user.role !== 'DISPATCHER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有派單方可以查看司機列表' },
        { status: 403 }
      )
    }

    // For MVP, show all online drivers
    // Later will filter by dispatcher's fleet
    const drivers = await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
      },
      include: { user: true },
      orderBy: { lastLocationAt: 'desc' },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: drivers,
    })
  } catch (error) {
    console.error('Get dispatcher drivers error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
