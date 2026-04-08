import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

const MAX_SQUAD_MEMBERS = 10

// POST /api/squads/invite - Invite a member (by email)
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
      include: { squad: true },
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

    let body: { driverEmail?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body.driverEmail || body.driverEmail.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請提供司機 Email' },
        { status: 400 }
      )
    }

    const targetEmail = body.driverEmail.trim().toLowerCase()

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: { driver: true },
    })

    if (!targetUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到此 Email 的用戶' },
        { status: 404 }
      )
    }

    if (targetUser.role !== 'DRIVER' || !targetUser.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此用戶不是司機身份' },
        { status: 400 }
      )
    }

    if (targetUser.id === user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '不能邀請自己' },
        { status: 400 }
      )
    }

    // Check if already in a squad
    const existingMembership = await prisma.squadMember.findUnique({
      where: { driverId: targetUser.driver.id },
    })

    if (existingMembership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '該司機已在其他小隊中' },
        { status: 400 }
      )
    }

    // Check if already a member of this squad
    const alreadyMember = await prisma.squadMember.findUnique({
      where: { squadId_driverId: { squadId: squad.id, driverId: targetUser.driver.id } },
    })

    if (alreadyMember) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '該司機已是小隊成員' },
        { status: 400 }
      )
    }

    // Directly create the membership (invited member joins immediately)
    const newMember = await prisma.squadMember.create({
      data: {
        squadId: squad.id,
        driverId: targetUser.driver.id,
      },
      include: {
        driver: {
          include: { user: true },
        },
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { member: newMember },
    })
  } catch (error) {
    console.error('Invite squad member error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
