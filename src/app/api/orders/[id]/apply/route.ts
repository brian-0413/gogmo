import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// ─── POST /api/orders/[id]/apply ───────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
        { success: false, error: '只有司機可以申請接單' },
        { status: 403 }
      )
    }

    // 檢查帳號狀態
    if (user.accountStatus !== 'ACTIVE') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '帳號尚未通過審核，請聯繫客服' },
        { status: 403 }
      )
    }

    const order = await prisma.order.findUnique({ where: { id } })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到訂單' },
        { status: 404 }
      )
    }

    if (order.status !== 'PUBLISHED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單目前無法申請接單' },
        { status: 400 }
      )
    }

    // ─── Transaction ───────────────────────────────────
    // 以條件式 updateMany 搶單：僅當訂單仍為 PUBLISHED 時才更新，
    // 避免兩位司機同時申請同一訂單。
    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: {
          id,
          status: 'PUBLISHED',
        },
        data: {
          status: 'ASSIGNED',
          driverId: user.driver!.id,
        },
      })
      if (claim.count === 0) {
        throw new Error('此訂單已被其他司機搶走')
      }
      return claim
    })

    return NextResponse.json<ApiResponse>({
      success: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === '此訂單已被其他司機搶走') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: message },
        { status: 409 }
      )
    }
    console.error('Apply order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
