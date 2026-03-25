import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/balance - Get driver balance and transactions
export async function GET(request: NextRequest) {
  try {
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
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Record<string, unknown> = { driverId: user.driver.id }
    if (status) {
      where.status = status
    }

    const [driver, transactions] = await Promise.all([
      prisma.driver.findUnique({
        where: { id: user.driver.id },
        select: { balance: true },
      }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { order: true },
      }),
    ])

    // Calculate summary
    const summary = {
      balance: driver?.balance || 0,
      pendingAmount: 0,
      settledAmount: 0,
      totalEarnings: 0,
      totalPlatformFees: 0,
    }

    for (const tx of transactions) {
      if (tx.type === 'RIDE_FARE') {
        summary.totalEarnings += tx.amount
        if (tx.status === 'PENDING') {
          summary.pendingAmount += tx.amount
        } else {
          summary.settledAmount += tx.amount
        }
      } else if (tx.type === 'PLATFORM_FEE') {
        summary.totalPlatformFees += Math.abs(tx.amount)
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...summary,
        transactions,
      },
    })
  } catch (error) {
    console.error('Get balance error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
