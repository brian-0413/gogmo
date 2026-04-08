import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

const MAX_SQUAD_MEMBERS = 10

// GET /api/squads - Get my squad
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
        { success: false, error: '只有司機可以查看小隊' },
        { status: 403 }
      )
    }

    // Find the driver's squad membership
    const membership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
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

    if (!membership) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { squad: null },
      })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { squad: membership.squad },
    })
  } catch (error) {
    console.error('Get squad error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// POST /api/squads - Create a squad
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
        { success: false, error: '只有司機可以建立小隊' },
        { status: 403 }
      )
    }

    // Check if already in a squad
    const existing = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
    })
    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '你已經在其他小隊中，請先退出後再建立新小隊' },
        { status: 400 }
      )
    }

    let body: { name?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '小隊名稱不得為空' },
        { status: 400 }
      )
    }

    const squad = await prisma.squad.create({
      data: {
        name: body.name.trim(),
        maxMembers: MAX_SQUAD_MEMBERS,
        founderId: user.driver.id,
        members: {
          create: {
            driverId: user.driver.id,
          },
        },
      },
      include: {
        members: {
          include: {
            driver: {
              include: { user: true },
            },
          },
        },
        founder: {
          include: { user: true },
        },
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { squad },
    })
  } catch (error) {
    console.error('Create squad error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// DELETE /api/squads - Delete (disband) a squad
export async function DELETE(request: NextRequest) {
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
        { success: false, error: '只有司機可以解散小隊' },
        { status: 403 }
      )
    }

    // Find the driver's squad
    const membership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
    })

    if (!membership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '你不在任何小隊中' },
        { status: 404 }
      )
    }

    const squad = await prisma.squad.findUnique({
      where: { id: membership.squadId },
    })

    if (!squad) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '小隊不存在' },
        { status: 404 }
      )
    }

    // Only founder can disband
    if (squad.founderId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有小隊建立者可以解散小隊' },
        { status: 403 }
      )
    }

    // Cascade delete removes all members
    await prisma.squad.delete({
      where: { id: squad.id },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: '小隊已解散' },
    })
  } catch (error) {
    console.error('Delete squad error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
