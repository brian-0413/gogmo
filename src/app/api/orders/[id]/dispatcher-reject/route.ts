import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { getOrCreateThread, createSystemMessage } from '@/lib/messages'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { reason?: string } = {}
    try { body = await request.json() } catch {}

    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以審核' }, { status: 403 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { driver: { include: { user: true } }, dispatcher: true },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>({ success: false, error: '找不到訂單' }, { status: 404 })
    }

    if (order.status !== 'ASSIGNED') {
      return NextResponse.json<ApiResponse>({ success: false, error: '此訂單不在待審核狀態' }, { status: 400 })
    }

    if (order.dispatcherId !== user.dispatcher.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: '無權限審核此訂單' }, { status: 403 })
    }

    const driverId = order.driverId!

    // 回復為 PUBLISHED，清空 driverId
    await prisma.order.update({
      where: { id },
      data: { status: 'PUBLISHED', driverId: null },
    })

    // 發系統訊息給司機
    try {
      const { id: threadId } = await getOrCreateThread(user.dispatcher.id, driverId)
      const reasonText = body.reason ? `\n原因：${body.reason}` : ''
      await createSystemMessage(
        threadId,
        `派單方拒絕了您的接單申請（${order.pickupLocation} → ${order.dropoffLocation}）${reasonText}`
      )
    } catch (e) {
      // 發訊息失敗不影響主要邏輯
      console.error('Failed to send reject message:', e)
    }

    return NextResponse.json<ApiResponse>({ success: true })
  } catch (error) {
    console.error('Dispatcher reject error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}