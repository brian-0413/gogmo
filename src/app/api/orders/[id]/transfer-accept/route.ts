import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { broadcastSquadEvent, broadcastDispatcherEvent } from '@/lib/sse-emitter'
import { isVehicleCompatible } from '@/lib/vehicle'

// POST /api/orders/[id]/transfer-accept — 隊友接受轉單
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { transferId: string } = { transferId: '' }
    try { body = await request.json() } catch {}

    if (!body.transferId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 transferId' },
        { status: 400 }
      )
    }

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
        { success: false, error: '只有司機可以接受轉單' },
        { status: 403 }
      )
    }

    // 查詢轉單記錄
    const transfer = await prisma.orderTransfer.findUnique({
      where: { id: body.transferId },
      include: {
        order: true,
        fromDriver: { include: { user: true } },
      },
    })

    if (!transfer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到轉單記錄' },
        { status: 404 }
      )
    }

    if (transfer.orderId !== id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '轉單記錄與訂單不符' },
        { status: 400 }
      )
    }

    if (transfer.status !== 'PENDING_SQUAD') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此轉單已不在等待隊友接單狀態' },
        { status: 400 }
      )
    }

    // 不能是自己發起的轉單
    if (transfer.fromDriverId === user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '不能接受自己發起的轉單' },
        { status: 400 }
      )
    }

    // 確認接受司機是 SquadMember（同 Squad）
    const acceptingMembership = await prisma.squadMember.findUnique({
      where: { driverId: user.driver.id },
    })

    if (!acceptingMembership || acceptingMembership.squadId !== transfer.squadId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您不在同一小隊，無法接受轉單' },
        { status: 403 }
      )
    }

    // 檢查車型相容性
    const driver = await prisma.driver.findUnique({ where: { id: user.driver.id } })
    if (!driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 400 }
      )
    }

    if (!isVehicleCompatible(driver.vehicleType, transfer.order.vehicleType!, transfer.order.vehicleRequirement)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您的車型不符，無法接受此轉單' },
        { status: 400 }
      )
    }

    // 更新轉單狀態為 PENDING_DISPATCHER
    const updatedTransfer = await prisma.orderTransfer.update({
      where: { id: body.transferId },
      data: {
        toDriverId: user.driver.id,
        status: 'PENDING_DISPATCHER',
      },
      include: {
        order: {
          select: {
            id: true,
            dispatcherId: true,
            scheduledTime: true,
            price: true,
            pickupLocation: true,
            dropoffLocation: true,
            type: true,
            vehicleType: true,
          },
        },
        fromDriver: {
          include: {
            user: { select: { name: true } },
          },
        },
        toDriver: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    })

    // Broadcast SSE 到小隊
    broadcastSquadEvent({
      type: 'TRANSFER_ACCEPTED',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      toDriverId: user.driver.id,
      squadId: transfer.squadId,
      status: 'PENDING_DISPATCHER',
    })

    // Broadcast SSE 到派單方
    broadcastDispatcherEvent({
      type: 'SQUAD_TRANSFER_PENDING',
      transferId: transfer.id,
      orderId: id,
      fromDriverId: transfer.fromDriverId,
      toDriverId: user.driver.id,
      status: 'PENDING_DISPATCHER',
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { transfer: updatedTransfer },
    })
  } catch (error) {
    console.error('Transfer accept error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
