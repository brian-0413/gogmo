import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// POST /api/admin/users/[id]/add-points — 手動為司機加點
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const admin = await getUserFromToken(token)
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以加點' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const points = Number(body.points)
  if (!Number.isInteger(points) || points <= 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: '請輸入正整數點數' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { driver: true },
  })
  if (!target) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到該使用者' }, { status: 404 })
  }

  if (target.role !== 'DRIVER' || !target.driver) {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有司機帳號可以加點' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '管理員手動加點'

  await prisma.$transaction(async (tx) => {
    await tx.driver.update({
      where: { userId: id },
      data: { balance: { increment: points } },
    })
    await tx.transaction.create({
      data: {
        driverId: target.driver!.id,
        amount: points,
        type: 'RECHARGE',
        status: 'SETTLED',
        description: `[管理員 ${admin.name}] ${reason}`,
      },
    })
  })

  const updated = await prisma.driver.findUnique({ where: { userId: id } })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      message: `已為 ${target.name} 增加 ${points} 點`,
      newBalance: updated?.balance,
    },
  })
}
