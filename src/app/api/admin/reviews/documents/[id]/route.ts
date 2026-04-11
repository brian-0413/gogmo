import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// PUT /api/admin/reviews/documents/[id] — 更新文件到期日
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const admin = await getUserFromToken(token)
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以修改文件資料' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const doc = await prisma.userDocument.findUnique({ where: { id } })
  if (!doc) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到該文件' }, { status: 404 })
  }

  const updateData: { expiryDate?: Date | null; status?: string } = {}
  if (body.expiryDate !== undefined) {
    updateData.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null
  }
  if (['PENDING', 'APPROVED', 'REJECTED'].includes(body.status)) {
    updateData.status = body.status
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: '沒有要更新的欄位' }, { status: 400 })
  }

  await prisma.userDocument.update({ where: { id }, data: updateData })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { message: '文件資料已更新' },
  })
}
