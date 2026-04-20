import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadInviteEvent } from '@/lib/sse-emitter'

const MAX_SQUAD_MEMBERS = 10

/** Normalize a license plate for fuzzy matching (uppercase, no spaces/dashes) */
function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s\-_]/g, '')
}

// POST /api/squads/invite - Send a squad invite by license plate
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
        { success: false, error: '只有司機可以邀請成員' },
        { status: 403 }
      )
    }

    // Find the driver's squad membership
    const membership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
      include: {
        squad: {
          include: {
            founder: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    })

    if (!membership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '你不在任何小隊中' },
        { status: 404 }
      )
    }

    const squad = membership.squad

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

    let body: { licensePlate?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body.licensePlate || body.licensePlate.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請提供車牌號碼' },
        { status: 400 }
      )
    }

    const normalizedPlate = normalizePlate(body.licensePlate)
    if (normalizedPlate.length < 4) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '車牌號碼格式不正確（至少需要 4 個字元）' },
        { status: 400 }
      )
    }

    // Find driver by fuzzy-matched license plate (case-insensitive contains)
    const targetDriver = await prisma.driver.findFirst({
      where: {
        licensePlate: {
          contains: normalizedPlate,
          mode: 'insensitive',
        },
      },
      include: { user: true },
    })

    if (!targetDriver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到此車牌的司機' },
        { status: 404 }
      )
    }

    if (targetDriver.userId === user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '不能邀請自己' },
        { status: 400 }
      )
    }

    // Check if already in a squad
    const existingMembership = await prisma.squadMember.findUnique({
      where: { driverId: targetDriver.id },
    })

    if (existingMembership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '該司機已在其他小隊中' },
        { status: 400 }
      )
    }

    // Check if already a member of this squad
    const alreadyMember = await prisma.squadMember.findUnique({
      where: { squadId_driverId: { squadId: squad.id, driverId: targetDriver.id } },
    })

    if (alreadyMember) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '該司機已是小隊成員' },
        { status: 400 }
      )
    }

    // Check if already has a pending invite to this squad
    const existingInvite = await prisma.squadInvite.findFirst({
      where: {
        squadId: squad.id,
        driverId: targetDriver.id,
        status: 'PENDING',
      },
    })

    if (existingInvite) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '已發送過邀請，等待對方回覆中' },
        { status: 400 }
      )
    }

    // Create the invite record
    const invite = await prisma.squadInvite.create({
      data: {
        squadId: squad.id,
        driverId: targetDriver.id,
        status: 'PENDING',
      },
    })

    // 发推送通知到目标司机（通过 SSE）
    broadcastSquadInviteEvent({
      type: 'SQUAD_INVITE',
      inviteId: invite.id,
      squadId: squad.id,
      squadName: squad.name,
      driverId: targetDriver.id,
      founderName: squad.founder?.user?.name,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        invite: {
          id: invite.id,
          squadId: squad.id,
          squadName: squad.name,
          driverId: targetDriver.id,
          licensePlate: targetDriver.licensePlate,
          driverName: targetDriver.user?.name || '未知',
        },
      },
    })
  } catch (error) {
    console.error('Invite squad member error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
