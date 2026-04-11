import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, hashPassword } from '@/lib/auth'
import { ApiResponse } from '@/types'

// POST /api/admin/users/[id]/reset-password — 重設密碼（管理員代為重設）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const admin = await getUserFromToken(token)
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以重設密碼' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  if (!body.newPassword || body.newPassword.length < 6) {
    return NextResponse.json<ApiResponse>({ success: false, error: '新密碼至少需要 6 個字元' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到該使用者' }, { status: 404 })
  }

  if (id === admin.id) {
    return NextResponse.json<ApiResponse>({ success: false, error: '請使用「修改密碼」功能修改自己的密碼' }, { status: 400 })
  }

  const hashed = await hashPassword(body.newPassword)
  await prisma.user.update({ where: { id }, data: { password: hashed } })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { message: '密碼已重設' },
  })
}
