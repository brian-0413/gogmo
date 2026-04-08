import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

const MAX_SQUAD_MEMBERS = 10

// POST /api/squads/join - Join a squad (for invited drivers)
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
        { success: false, error: '只有司機可以加入小隊' },
        { status: 403 }
      )
    }

    // Check not already in a squad
    const existingMembership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
    })

    if (existingMembership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '你已經在其他小隊中，請先退出' },
        { status: 400 }
      )
    }

    let body: { squadId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body.squadId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請提供小隊 ID' },
        { status: 400 }
      )
    }

    // Verify squad exists and has space
    const squad = await prisma.squad.findUnique({
      where: { id: body.squadId },
    })

    if (!squad) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '小隊不存在' },
        { status: 404 }
      )
    }

    // Check squad is not full
    const currentMemberCount = await prisma.squadMember.count({
      where: { squadId: squad.id },
    })
    if (currentMemberCount >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `小隊已滿（最多 ${MAX_SQUAD_MEMBERS} 人）` },
        { status: 400 }
      )
    }

    // Create membership
    const membership = await prisma.squadMember.create({
      data: {
        squadId: squad.id,
        driverId: user.driver.id,
      },
      include: {
        squad: {
          include: {
            members: {
              include: {
                driver: {
                  include: { user: true },
                },
              },
              orderBy: { joinedAt: 'asc' },
            },
            founder: {
              include: { user: true },
            },
          },
        },
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { squad: membership.squad },
    })
  } catch (error) {
    console.error('Join squad error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
