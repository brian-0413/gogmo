import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { prisma } from '@/lib/prisma'

// GET /api/drivers/[id]/documents
// Returns all UserDocument records for a driver
// Only accessible by DISPATCHER or ADMIN
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  }
  const currentUser = await getUserFromToken(token)
  if (!currentUser) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無效的 token' }, { status: 401 })
  }

  // Only DISPATCHER or ADMIN can view driver documents
  if (currentUser.role !== 'DISPATCHER' && currentUser.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '無權限' }, { status: 403 })
  }

  const { id } = await params

  const docs = await prisma.userDocument.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { documents: docs },
  })
}
