import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { PLATFORM_FEE_RATE } from '@/lib/constants'

// POST /api/schedule/confirm — 確認排班組合（一次接多單）
// 依序接單，每單扣 5% 平台費，有任何一單失敗則整體回滾
export async function POST(request: NextRequest) {
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
        { success: false, error: '只有司機可以使用此功能' },
        { status: 403 }
      )
    }

    let body: { orderIds: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { orderIds } = body
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '請提供要接的訂單 ID 列表' },
        { status: 400 }
      )
    }

    if (orderIds.length > 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '最多一次接 6 單' },
        { status: 400 }
      )
    }

    const driverId = user.driver.id

    // 依序接單（transaction 確保原子性）
    const results: { orderId: string; success: boolean; price: number; fee: number }[] = []
    let totalFee = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      for (const orderId of orderIds) {
        const order = await tx.order.findUnique({ where: { id: orderId } })

        if (!order) {
          throw new Error(`找不到訂單: ${orderId}`)
        }

        if (order.status !== 'PUBLISHED' && order.status !== 'ASSIGNED') {
          throw new Error(`訂單 ${orderId} 目前無法接單（狀態：${order.status}）`)
        }

        if (order.status === 'ASSIGNED' && order.driverId && order.driverId !== driverId) {
          throw new Error(`訂單 ${orderId} 已指派給其他司機`)
        }

        const driver = await tx.driver.findUnique({ where: { id: driverId } })
        if (!driver) throw new Error('找不到司機資料')

        const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)
        if (driver.balance < platformFee) {
          throw new Error(`點數不足，需要 ${platformFee} 點（訂單 ${orderId}）`)
        }

        // 更新訂單
        await tx.order.update({
          where: { id: orderId },
          data: { driverId, status: 'ACCEPTED' },
        })

        // 扣平台費
        await tx.driver.update({
          where: { id: driverId },
          data: { balance: driver.balance - platformFee },
        })

        // 記錄交易
        await tx.transaction.create({
          data: {
            orderId,
            driverId,
            amount: -platformFee,
            type: 'PLATFORM_FEE',
            status: 'SETTLED',
            description: `接單平台費 (5%) - 訂單 #${orderId.slice(0, 8)}`,
          },
        })

        totalFee += platformFee
        results.push({
          orderId,
          success: true,
          price: order.price,
          fee: platformFee,
        })
      }
    })

    const totalIncome = results.reduce((sum, r) => sum + r.price, 0)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        accepted: results,
        totalIncome,
        totalFee,
        newBalance: user.driver.balance - totalFee,
        message: `排班確認完成，共 ${results.length} 筆行程，扣除平台費 ${totalFee} 點`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('點數不足') || message.includes('找不到') || message.includes('無法接單') || message.includes('已指派')) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: message },
        { status: 400 }
      )
    }
    console.error('Schedule confirm error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
