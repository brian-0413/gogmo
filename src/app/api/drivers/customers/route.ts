import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/customers - Get current driver's customer list
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
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'createdAt'
    const take = Math.min(parseInt(searchParams.get('take') || '20', 10), 100)
    const skip = parseInt(searchParams.get('skip') || '0', 10)

    const where: Record<string, unknown> = {
      driverId: user.driver.id,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const orderBy: Record<string, unknown> =
      sort === 'lastOrderAt' ? { lastOrderAt: 'desc' } : { createdAt: 'desc' }

    const [customers, total] = await Promise.all([
      prisma.driverCustomer.findMany({
        where,
        orderBy,
        take,
        skip,
      }),
      prisma.driverCustomer.count({ where }),
    ])

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        customers,
        pagination: { total, take, skip },
      },
    })
  } catch (error) {
    console.error('Get customers error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// POST /api/drivers/customers - Create customer manually
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
    const { name, phone, commonPickup, commonDropoff, preferredVehicle, notes } = body

    if (!name?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '姓名為必填' },
        { status: 400 }
      )
    }

    if (!phone?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '電話為必填' },
        { status: 400 }
      )
    }

    const validVehicles = ['small', 'suv', 'van9', null]
    if (preferredVehicle && !validVehicles.includes(preferredVehicle)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `車型無效：${preferredVehicle}` },
        { status: 400 }
      )
    }

    // Check duplicate phone
    const existing = await prisma.driverCustomer.findUnique({
      where: {
        driverId_phone: {
          driverId: user.driver.id,
          phone: phone.trim(),
        },
      },
    })

    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '此電話的客戶已存在' },
        { status: 400 }
      )
    }

    const customer = await prisma.driverCustomer.create({
      data: {
        driverId: user.driver.id,
        name: name.trim(),
        phone: phone.trim(),
        commonPickup: commonPickup?.trim() || null,
        commonDropoff: commonDropoff?.trim() || null,
        preferredVehicle: preferredVehicle || null,
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: customer,
    })
  } catch (error) {
    console.error('Create customer error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
