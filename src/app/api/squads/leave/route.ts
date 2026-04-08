import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// POST /api/squads/leave - Leave a squad
export async function POST(request: NextRequest) {
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

    if (user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有司機可以退出小隊' },
        { status: 403 }
      )
    }

    // Find the driver's membership
    const membership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
      include: { squad: true },
    })

    if (!membership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '你不在任何小隊中' },
        { status: 404 }
      )
    }

    const squad = membership.squad
    const isFounder = squad.founderId === user.driver.id

    // Check if there are pending transfers
    const pendingTransfers = await prisma.orderTransfer.count({
      where: {
        squadId: squad.id,
        status: { in: ['PENDING_SQUAD', 'PENDING_DISPATCHER'] },
      },
    })

    if (pendingTransfers > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `小隊尚有 ${pendingTransfers} 筆待處理轉單，無法退出` },
        { status: 400 }
      )
    }

    // Delete the membership
    await prisma.squadMember.delete({
      where: { id: membership.id },
    })

    // If this was the last member, delete the squad
    const remainingMembers = await prisma.squadMember.count({
      where: { squadId: squad.id },
    })

    if (remainingMembers === 0) {
      await prisma.squad.delete({
        where: { id: squad.id },
      })
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { message: '已退出小隊（小隊已解散）' },
      })
    }

    // If the founder left and others remain, transfer founder to the earliest join
    if (isFounder) {
      const oldestMember = await prisma.squadMember.findFirst({
        where: { squadId: squad.id },
        orderBy: { joinedAt: 'asc' },
      })

      if (oldestMember) {
        await prisma.squad.update({
          where: { id: squad.id },
          data: { founderId: oldestMember.driverId },
        })
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: '已退出小隊' },
    })
  } catch (error) {
    console.error('Leave squad error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
