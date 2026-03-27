import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/me - Get current driver profile
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

    const driver = await prisma.driver.findUnique({
      where: { id: user.driver.id },
      include: { user: true },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: driver,
    })
  } catch (error) {
    console.error('Get driver error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// PATCH /api/drivers/me - Update driver profile
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const allowedFields = ['licensePlate', 'carType', 'carColor', 'status']

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Status transition validation
    if (body.status !== undefined) {
      const validStatuses = ['ONLINE', 'OFFLINE', 'BUSY']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `無效的狀態：${body.status}。有效狀態為：${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      // When going ONLINE, update lastLocationAt to now
      if (body.status === 'ONLINE') {
        updateData.lastLocationAt = new Date()
      }
    }

    const updated = await prisma.driver.update({
      where: { id: user.driver.id },
      data: updateData,
      include: { user: true },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Update driver error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
