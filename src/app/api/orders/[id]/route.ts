import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { MAX_FIELD_LENGTHS, MAX_ORDER_PRICE } from '@/lib/validation'

// GET /api/orders/[id] - Get single order
export async function GET(
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
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        dispatcher: { include: { user: true } },
        driver: { include: { user: true } },
      },
    })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到訂單' },
        { status: 404 }
      )
    }

    // Authorization check
    if (user.role === 'DRIVER' && user.driver?.id !== order.driverId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權查看此訂單' },
        { status: 403 }
      )
    }

    if (user.role === 'DISPATCHER' && user.dispatcher?.id !== order.dispatcherId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權查看此訂單' },
        { status: 403 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: order,
    })
  } catch (error) {
    console.error('Get order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// PATCH /api/orders/[id] - Update order
export async function PATCH(
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
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const order = await prisma.order.findUnique({ where: { id } })

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到訂單' },
        { status: 404 }
      )
    }

    // Only dispatcher can update their orders
    if (user.role === 'DISPATCHER' && user.dispatcher?.id !== order.dispatcherId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權修改此訂單' },
        { status: 403 }
      )
    }

    // Delete order (only if not yet accepted/completed by dispatcher)
    if (body._action === 'delete') {
      const immutableStatuses = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']
      if (immutableStatuses.includes(order.status)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '司機已接單，行程時間 5 小時前才可由司機退單後重新發布' },
          { status: 400 }
        )
      }
      await prisma.order.delete({ where: { id } })
      return NextResponse.json<ApiResponse>({ success: true })
    }

    // Assign driver (dispatcher only)
    if (body._action === 'assign' && user.role === 'DISPATCHER') {
      if (order.status !== 'PUBLISHED') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '只能指派已發布的訂單' },
          { status: 400 }
        )
      }
      const { driverId } = body
      if (!driverId) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '請提供司機 ID' },
          { status: 400 }
        )
      }

      // Verify driver exists and is available
      const driver = await prisma.driver.findUnique({ where: { id: driverId } })
      if (!driver) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '找不到司機' },
          { status: 404 }
        )
      }

      if (driver.status !== 'ONLINE') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '司機目前不在線上' },
          { status: 400 }
        )
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          driverId,
          status: 'ASSIGNED',
        },
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: updated,
      })
    }

    // Update order status
    if (body._action === 'status') {
      const { status } = body
      const validTransitions: Record<string, string[]> = {
        ACCEPTED: ['IN_PROGRESS'],
        IN_PROGRESS: ['ARRIVED'],
        ARRIVED: ['PICKED_UP'],
        PICKED_UP: ['COMPLETED'],
        COMPLETED: [],
      }

      // Driver can update status
      if (user.role === 'DRIVER' && user.driver?.id === order.driverId) {
        if (!validTransitions[order.status]?.includes(status)) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: '無效的狀態轉換' },
            { status: 400 }
          )
        }

        const updateData: Record<string, unknown> = { status }

        // 時間戳記寫入
        if (status === 'IN_PROGRESS') updateData.startedAt = new Date()
        if (status === 'ARRIVED')    updateData.arrivedAt = new Date()
        if (status === 'PICKED_UP')  updateData.pickedUpAt = new Date()
        if (status === 'COMPLETED')   updateData.completedAt = new Date()

        const updated = await prisma.order.update({
          where: { id },
          data: updateData,
          include: {
            dispatcher: { include: { user: true } },
            driver: { include: { user: true } },
          },
        })

        // Create transaction for completed ride (平台費已在接單時預扣)
        if (status === 'COMPLETED' && user.driver) {
          await prisma.transaction.create({
            data: {
              orderId: id,
              driverId: user.driver.id,
              amount: order.price,
              type: 'RIDE_FARE',
              status: 'PENDING',
              description: `行程收入 - 訂單 #${id.slice(0, 8)}`,
            },
          })

          await prisma.driver.update({
            where: { id: user.driver.id },
            data: { status: 'ONLINE' },
          })
        }

        // 司機出發，改為忙碌
        if (status === 'IN_PROGRESS' && user.driver) {
          await prisma.driver.update({
            where: { id: user.driver.id },
            data: { status: 'BUSY' },
          })
        }

        return NextResponse.json<ApiResponse>({
          success: true,
          data: updated,
        })
      }
    }

    // General update (dispatcher only, not after driver accepted)
    if (user.role === 'DISPATCHER') {
      const editableStatuses = ['PENDING', 'PUBLISHED']
      if (!editableStatuses.includes(order.status)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '司機已接單，無法修改' },
          { status: 400 }
        )
      }
      const allowedFields = [
        'passengerName', 'passengerPhone', 'flightNumber',
        'pickupLocation', 'pickupAddress', 'dropoffLocation', 'dropoffAddress',
        'passengerCount', 'luggageCount', 'scheduledTime', 'price', 'note',
        'transferStatus',
      ]

      // Validate field lengths

      for (const [field, maxLength] of Object.entries(MAX_FIELD_LENGTHS)) {
        const value = body[field]
        if (value && typeof value === 'string' && value.length > maxLength) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: `${field} 輸入過長，最多 ${maxLength} 字符` },
            { status: 400 }
          )
        }
      }

      // Validate price and passenger count if provided
      if (body.price !== undefined && (body.price < 0 || body.price > MAX_ORDER_PRICE)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `價格必須在 0 - ${MAX_ORDER_PRICE.toLocaleString()} 元之間` },
          { status: 400 }
        )
      }

      if (body.passengerCount !== undefined && (body.passengerCount < 1 || body.passengerCount > 20)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '乘客人數必須在 1 - 20 人之間' },
          { status: 400 }
        )
      }

      const updateData: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '沒有要更新的欄位' },
          { status: 400 }
        )
      }

      const updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          dispatcher: { include: { user: true } },
          driver: { include: { user: true } },
        },
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: updated,
      })
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: '無權執行此操作' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// DELETE /api/orders/[id] - Delete order
export async function DELETE(
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
    if (!user || user.role !== 'DISPATCHER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有派單方可以刪除訂單' },
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

    // 擁有權驗證：只有建立此訂單的派單方才能刪除
    if (order.dispatcherId !== user.dispatcher?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '您無權刪除此訂單' },
        { status: 403 }
      )
    }

    if (order.status !== 'PUBLISHED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只能刪除已發布的訂單' },
        { status: 400 }
      )
    }

    await prisma.order.delete({ where: { id } })

    return NextResponse.json<ApiResponse>({ success: true })
  } catch (error) {
    console.error('Delete order error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
