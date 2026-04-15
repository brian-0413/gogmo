import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/pricing - Get current driver's pricing list
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

    const pricing = await prisma.driverPricing.findMany({
      where: { driverId: user.driver.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: pricing,
    })
  } catch (error) {
    console.error('Get pricing error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// POST /api/drivers/pricing - Create pricing entry
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
        { success: false, error: '找不到司機資料' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { vehicleType, price } = body

    if (!vehicleType || price === undefined) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少必填欄位 vehicleType 或 price' },
        { status: 400 }
      )
    }

    const validVehicles = ['small', 'suv', 'van9']
    if (!validVehicles.includes(vehicleType)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `車型無效：${vehicleType}。有效值：${validVehicles.join(', ')}` },
        { status: 400 }
      )
    }

    if (price < 0 || price > 50000) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '價格必須在 0 - 50000 元之間' },
        { status: 400 }
      )
    }

    // Check if already exists
    const existing = await prisma.driverPricing.findUnique({
      where: {
        driverId_vehicleType: {
          driverId: user.driver.id,
          vehicleType,
        },
      },
    })

    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `車型 ${vehicleType} 的報價已存在，請直接編輯` },
        { status: 400 }
      )
    }

    const pricing = await prisma.driverPricing.create({
      data: {
        driverId: user.driver.id,
        vehicleType,
        price,
        enabled: true,
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: pricing,
    })
  } catch (error) {
    console.error('Create pricing error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
