import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/dispatchers/me - Get current dispatcher profile
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
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到派單方資料' },
        { status: 404 }
      )
    }

    const dispatcher = await prisma.dispatcher.findUnique({
      where: { id: user.dispatcher.id },
      include: { user: true },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: dispatcher,
    })
  } catch (error) {
    console.error('Get dispatcher error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
