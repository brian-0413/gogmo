import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以審核帳號' }, { status: 403 })
  }

  const { id: userId } = await params
  let body: { action: 'approve' | 'reject'; note?: string } = { action: 'approve' }
  try { body = await request.json() } catch {}

  if (!['approve', 'reject'].includes(body.action)) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無效的操作' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到該用戶' }, { status: 404 })
  }

  if (targetUser.accountStatus !== 'PENDING_REVIEW') {
    return NextResponse.json<ApiResponse>({ success: false, error: '該用戶不在待審核狀態' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    if (body.action === 'approve') {
      await tx.user.update({
        where: { id: userId },
        data: { accountStatus: 'ACTIVE' },
      })
      await tx.userDocument.updateMany({
        where: { userId },
        data: { status: 'APPROVED' },
      })
    } else {
      await tx.user.update({
        where: { id: userId },
        data: {
          accountStatus: 'REJECTED',
          rejectReason: body.note || '審核不通過',
        },
      })
      await tx.userDocument.updateMany({
        where: { userId },
        data: { status: 'REJECTED' },
      })
    }
  })

  // TODO: Send notification email
  const action = body.action === 'approve' ? '已開通' : '未通過'
  console.log(`[EMAIL] 帳號審核結果通知 ${targetUser.email}: ${action}`)

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { message: body.action === 'approve' ? '已通過審核，帳號已開通' : '已拒絕審核' },
  })
}
