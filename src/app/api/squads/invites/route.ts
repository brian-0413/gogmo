import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/squads/invites — 取得司機的待回覆邀請
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
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有司機可以查看邀請' },
        { status: 403 }
      )
    }

    // 查詢所有 PENDING 邀請（給這個司機的）
    const invites = await prisma.squadInvite.findMany({
      where: {
        driverId: user.driver.id,
        status: 'PENDING',
      },
      include: {
        squad: {
          include: {
            founder: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { invites },
    })
  } catch (error) {
    console.error('Get invites error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
