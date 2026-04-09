import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadInviteEvent } from '@/lib/sse-emitter'

// POST /api/squads/respond — 回覆小隊邀請（接受/拒絕）
export async function POST(request: NextRequest) {
  try {
    let body: { inviteId: string; action: 'accept' | 'reject' } = { inviteId: '', action: 'accept' }
    try { body = await request.json() } catch {}

    if (!body.inviteId || !body.action) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 inviteId 或 action' },
        { status: 400 }
      )
    }

    if (!['accept', 'reject'].includes(body.action)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'action 必須是 accept 或 reject' },
        { status: 400 }
      )
    }

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
        { success: false, error: '只有司機可以回覆邀請' },
        { status: 403 }
      )
    }

    // 查詢邀請記錄
    const invite = await prisma.squadInvite.findUnique({
      where: { id: body.inviteId },
      include: {
        squad: {
          include: {
            founder: {
              include: { user: { select: { name: true } } },
            },
          },
        },
        driver: { include: { user: true } },
      },
    })

    if (!invite) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到此邀請' },
        { status: 404 }
      )
    }

    if (invite.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此邀請不是給您的' },
        { status: 403 }
      )
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此邀請已處理過了' },
        { status: 400 }
      )
    }

    if (body.action === 'accept') {
      // 先取出 driverId 避免 TypeScript narrow 問題
      const driverId = user.driver!.id

      // 檢查司機是否已在其他小隊
      const existing = await prisma.squadMember.findUnique({
        where: { driverId },
      })
      if (existing) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '您已經在其他小隊中，請先退出後再接受邀請' },
          { status: 400 }
        )
      }

      // Transaction: 更新邀請狀態 + 加入小隊
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await prisma.$transaction(async (tx: any) => {
        await tx.squadInvite.update({
          where: { id: body.inviteId },
          data: { status: 'ACCEPTED' },
        })

        const member = await tx.squadMember.create({
          data: {
            squadId: invite.squadId,
            driverId,
          },
        })

        return member
      })

      // Broadcast SQUAD_INVITE_ACCEPTED
      broadcastSquadInviteEvent({
        type: 'SQUAD_INVITE_ACCEPTED',
        inviteId: invite.id,
        squadId: invite.squadId,
        squadName: invite.squad.name,
        driverId: user.driver.id,
        founderName: invite.squad.founder?.user?.name as string | undefined,
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { message: `已成功加入 ${invite.squad.name} 小隊`, member: result },
      })
    } else {
      // 拒絕邀請
      await prisma.squadInvite.update({
        where: { id: body.inviteId },
        data: { status: 'REJECTED' },
      })

      // Broadcast SQUAD_INVITE_REJECTED
      broadcastSquadInviteEvent({
        type: 'SQUAD_INVITE_REJECTED',
        inviteId: invite.id,
        squadId: invite.squadId,
        squadName: invite.squad.name,
        driverId: user.driver.id,
        founderName: invite.squad.founder?.user?.name as string | undefined,
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { message: '已拒絕邀請' },
      })
    }
  } catch (error) {
    console.error('Respond to invite error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
