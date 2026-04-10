import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { prisma } from '@/lib/prisma'

// GET /api/drivers/[id]/documents
// Returns all UserDocument records for a driver
// Only DISPATCHER (with order relationship) or ADMIN can access
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

  const { id: driverUserId } = await params

  // ADMIN: 無限制
  if (currentUser.role === 'ADMIN') {
    const docs = await prisma.userDocument.findMany({
      where: { userId: driverUserId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json<ApiResponse>({ success: true, data: { documents: docs } })
  }

  // DISPATCHER: 必須有此司機接過的訂單才能查看
  if (currentUser.role === 'DISPATCHER') {
    const dispatcher = await prisma.dispatcher.findUnique({
      where: { userId: currentUser.id },
    })
    if (!dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '找不到派單方資料' }, { status: 404 })
    }

    // 查詢此派單方是否有訂單的司機 userId = driverUserId
    const orderWithDriver = await prisma.order.findFirst({
      where: {
        dispatcherId: dispatcher.id,
        driver: { userId: driverUserId },
      },
    })
    if (!orderWithDriver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此司機尚未接過您的訂單，無法查看證件' },
        { status: 403 }
      )
    }

    const docs = await prisma.userDocument.findMany({
      where: { userId: driverUserId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json<ApiResponse>({ success: true, data: { documents: docs } })
  }

  return NextResponse.json<ApiResponse>({ success: false, error: '無權限' }, { status: 403 })
}
