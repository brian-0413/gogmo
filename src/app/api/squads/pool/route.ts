import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/squads/pool — 取得司機所屬小隊的所有 PENDING_SQUAD 轉單
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

    if (user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有司機可以查看支援池' },
        { status: 403 }
      )
    }

    // 查詢司機所屬小隊
    const membership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
    })

    if (!membership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您尚未加入任何小隊' },
        { status: 403 }
      )
    }

    // 查詢小隊中所有 PENDING_SQUAD 的轉單，排除司機自己發起的
    const transfers = await prisma.orderTransfer.findMany({
      where: {
        squadId: membership.squadId,
        status: 'PENDING_SQUAD',
        fromDriverId: {
          not: user.driver.id,
        },
      },
      include: {
        order: {
          select: {
            id: true,
            scheduledTime: true,
            price: true,
            pickupLocation: true,
            dropoffLocation: true,
            type: true,
            vehicleType: true,
            passengerCount: true,
            passengerName: true,
            passengerPhone: true,
            flightNumber: true,
          },
        },
        fromDriver: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { transfers },
    })
  } catch (error) {
    console.error('Get squad pool error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
