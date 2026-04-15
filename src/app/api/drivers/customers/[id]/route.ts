import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/customers/[id] - Get single customer
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
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const customer = await prisma.driverCustomer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該客戶' },
        { status: 404 }
      )
    }

    if (customer.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權查看此客戶' },
        { status: 403 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: customer,
    })
  } catch (error) {
    console.error('Get customer error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// PUT /api/drivers/customers/[id] - Update customer
export async function PUT(
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
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const customer = await prisma.driverCustomer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該客戶' },
        { status: 404 }
      )
    }

    if (customer.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權修改此客戶' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    const allowedFields = ['name', 'phone', 'commonPickup', 'commonDropoff', 'preferredVehicle', 'notes']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = typeof body[field] === 'string' ? body[field].trim() : body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '沒有要更新的欄位' },
        { status: 400 }
      )
    }

    // Validate preferredVehicle
    if (body.preferredVehicle !== undefined) {
      const validVehicles = ['small', 'suv', 'van9', null]
      if (!validVehicles.includes(body.preferredVehicle)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `車型無效：${body.preferredVehicle}` },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.driverCustomer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// DELETE /api/drivers/customers/[id] - Delete customer
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
    if (!user || user.role !== 'DRIVER' || !user.driver) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const customer = await prisma.driverCustomer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該客戶' },
        { status: 404 }
      )
    }

    if (customer.driverId !== user.driver.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無權刪除此客戶' },
        { status: 403 }
      )
    }

    await prisma.driverCustomer.delete({ where: { id } })

    return NextResponse.json<ApiResponse>({ success: true })
  } catch (error) {
    console.error('Delete customer error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
