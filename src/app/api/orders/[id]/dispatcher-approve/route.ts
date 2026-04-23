import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { PLATFORM_FEE_RATE } from '@/lib/constants'

// 批准的請求格式
interface ApproveBody {
  action: 'approve'
  contactName: string
  contactPhone: string
  flightNumber?: string
  pickupAddress?: string
  dropoffAddress?: string
  passengerCount: number
  luggageCount: number
  specialRequests?: string[]
  note?: string
}

// 拒絕的請求格式
interface RejectBody {
  action: 'reject'
}

// 聯合類型
type RequestBody = ApproveBody | RejectBody

// 驗證批准所需的必填欄位
function validateApproveFields(body: ApproveBody, orderType: string): string | null {
  if (!body.contactName?.trim()) return '請填寫聯絡人姓名'
  if (!body.contactPhone?.trim()) return '請填寫聯絡人電話'

  const type = orderType.toLowerCase()

  // 接機需填寫航班號碼
  if (type.includes('pickup') && !body.flightNumber?.trim()) {
    return '接機訂單請填寫航班號碼'
  }

  // 送機需填寫上車地址
  if (type.includes('dropoff') && !body.pickupAddress?.trim()) {
    return '送機訂單請填寫上車地址'
  }

  // 接機需填寫目的地地址
  if (type.includes('pickup') && !body.dropoffAddress?.trim()) {
    return '接機訂單請填寫目的地地址'
  }

  if (typeof body.passengerCount !== 'number' || body.passengerCount < 1) {
    return '請填寫乘客數量'
  }

  if (typeof body.luggageCount !== 'number' || body.luggageCount < 0) {
    return '請填寫行李數量'
  }

  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.role !== 'DISPATCHER' || !user.dispatcher) {
      return NextResponse.json<ApiResponse>({ success: false, error: '只有派單方可以審核' }, { status: 403 })
    }

    const body: RequestBody = await request.json()

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

    // 處理拒絕
    if (body.action === 'reject') {
      const updated = await prisma.order.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          driverId: null,
        },
      })
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { order: updated },
      })
    }

    // 處理批准
    if (body.action === 'approve') {
      const approveBody = body as ApproveBody

      // 驗證必填欄位
      const validationError = validateApproveFields(approveBody, order.type)
      if (validationError) {
        return NextResponse.json<ApiResponse>({ success: false, error: validationError }, { status: 400 })
      }

      const driverId = order.driverId!
      const platformFee = Math.floor(order.price * PLATFORM_FEE_RATE)

      // Transaction: 扣點 + 寫 Transaction 記錄 + 改狀態為 ACCEPTED + 寫入詳細資訊
      const updated = await prisma.$transaction(async (tx) => {
        const driver = await tx.driver.findUnique({ where: { id: driverId } })
        if (!driver) throw new Error('找不到司機資料')

        if (driver.balance < platformFee) {
          throw new Error(`司機點數不足，需要 ${platformFee} 點`)
        }

        await tx.driver.update({
          where: { id: driverId },
          data: { balance: driver.balance - platformFee },
        })

        await tx.transaction.create({
          data: {
            orderId: id,
            driverId,
            amount: -platformFee,
            type: 'PLATFORM_FEE',
            status: 'SETTLED',
            description: `接單平台費 (5%) - 訂單 #${id.slice(0, 8)}`,
          },
        })

        return tx.order.update({
          where: { id },
          data: {
            status: 'ACCEPTED',
            contactName: approveBody.contactName,
            passengerPhone: approveBody.contactPhone,
            flightNumber: approveBody.flightNumber || '',
            pickupAddress: approveBody.pickupAddress || '',
            dropoffAddress: approveBody.dropoffAddress || '',
            passengerCount: approveBody.passengerCount,
            luggageCount: approveBody.luggageCount,
            specialRequests: approveBody.specialRequests?.join('、') || '',
            note: approveBody.note || '',
          },
          include: { driver: { include: { user: true } } },
        })
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { order: updated, platformFee },
      })
    }

    return NextResponse.json<ApiResponse>({ success: false, error: '無效的操作' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('點數不足')) {
      return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 400 })
    }
    console.error('Dispatcher approve error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
