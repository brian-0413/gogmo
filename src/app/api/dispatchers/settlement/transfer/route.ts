import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

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
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有派單方可以執行此操作' },
        { status: 403 }
      )
    }

    let body: { orderId: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body.orderId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 orderId' },
        { status: 400 }
      )
    }

    // 驗證訂單屬於該派單方
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: { driver: { include: { user: true } } },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該筆訂單' },
        { status: 404 }
      )
    }

    if (order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權限操作此訂單' },
        { status: 403 }
      )
    }

    if (order.status !== 'COMPLETED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有已完成的行程才能標記轉帳' },
        { status: 400 }
      )
    }

    if (order.transferStatus === 'completed') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此訂單已標記為已轉帳，無法重複操作' },
        { status: 400 }
      )
    }

    // 更新為已轉帳（不可逆）
    await prisma.order.update({
      where: { id: body.orderId },
      data: { transferStatus: 'completed' },
    })

    // 通知司機日誌（未來實作推播後串接）
    if (order.driver) {
      console.log(`[TRANSFER] 派單方 ${user.dispatcher.companyName} 已標記轉帳完成 NT$${order.price} 給司機 ${order.driver.user.name}（${order.driver.licensePlate}）`)
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: '已標記為已轉帳' },
    })
  } catch (error) {
    console.error('Transfer marking error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
