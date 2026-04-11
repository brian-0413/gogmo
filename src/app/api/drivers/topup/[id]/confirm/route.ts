import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// PUT /api/drivers/topup/[id]/confirm
// 客服確認轉帳加值（Phase 1）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const currentUser = await getUserFromToken(token)
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權限，只有管理員可執行此操作' },
        { status: 403 }
      )
    }

    const { id: topupId } = await params

    // 找 Topup record
    const topup = await prisma.topup.findUnique({
      where: { id: topupId },
      include: { driver: true },
    })

    if (!topup) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到加值記錄' },
        { status: 404 }
      )
    }

    if (topup.method !== 'transfer') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '僅能確認轉帳加值' },
        { status: 400 }
      )
    }

    if (topup.status !== 'pending') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `此加值記錄狀態為 ${topup.status}，無法確認` },
        { status: 400 }
      )
    }

    // 更新 Topup status = paid
    await prisma.topup.update({
      where: { id: topupId },
      data: {
        status: 'paid',
        paidAt: new Date(),
      },
    })

    // 更新 Driver balance
    await prisma.driver.update({
      where: { id: topup.driverId },
      data: {
        balance: { increment: topup.amount },
      },
    })

    // 建立 Transaction
    await prisma.transaction.create({
      data: {
        driverId: topup.driverId,
        topupId: topup.id,
        amount: topup.amount,
        type: 'RECHARGE',
        status: 'SETTLED',
        settledAt: new Date(),
        description: `轉帳加值（客服確認）`,
      },
    })

    console.log(`[TOPUP] Transfer topup ${topupId} confirmed by admin ${currentUser.id}: +${topup.amount} to driver ${topup.driverId}`)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        topupId: topup.id,
        amount: topup.amount,
        driverBalance: topup.driver.balance + topup.amount,
      },
    })
  } catch (error) {
    console.error('Confirm topup error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
