import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// GET /api/drivers/profile - Get driver profile
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

    const [driver, documents] = await Promise.all([
      prisma.driver.findUnique({
        where: { id: user.driver.id },
        select: {
          id: true,
          licensePlate: true,
          carBrand: true,
          carModel: true,
          vehicleType: true,
          carColor: true,
          isPremium: true,
          bankCode: true,
          bankAccount: true,
          balance: true,
        },
      }),
      prisma.userDocument.findMany({
        where: {
          userId: user.id,
          status: { in: ['APPROVED', 'PENDING'] },
        },
        select: {
          id: true,
          type: true,
          fileName: true,
          fileUrl: true,
          expiryDate: true,
          status: true,
          uploadFailed: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        driver: driver ? {
          id: driver.id,
          licensePlate: driver.licensePlate,
          carBrand: driver.carBrand,
          carModel: driver.carModel,
          vehicleType: driver.vehicleType,
          carColor: driver.carColor,
          isPremium: driver.isPremium,
          bankCode: driver.bankCode,
          bankAccount: driver.bankAccount,
        } : null,
        documents,
        balance: driver?.balance ?? 0,
      },
    })
  } catch (error) {
    console.error('Get driver profile error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// PUT /api/drivers/profile - Update driver profile
export async function PUT(request: NextRequest) {
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
    const { phone, bankCode, bankAccount } = body

    // Build update data
    const updateUserData: Record<string, unknown> = {}
    const updateDriverData: Record<string, unknown> = {}

    if (phone !== undefined) {
      updateUserData.phone = phone
    }

    if (bankCode !== undefined) {
      updateDriverData.bankCode = bankCode
    }

    if (bankAccount !== undefined) {
      // Validate: bankAccount must be numeric (strip leading zeros)
      const normalizedAccount = String(bankAccount).replace(/^0+/, '') || '0'
      if (!/^\d+$/.test(normalizedAccount)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '銀行帳號需為數字' },
          { status: 400 }
        )
      }
      updateDriverData.bankAccount = normalizedAccount
    }

    // Run both updates in parallel if there is data to update
    const updatePromises: Promise<unknown>[] = []
    if (Object.keys(updateUserData).length > 0) {
      updatePromises.push(
        prisma.user.update({
          where: { id: user.id },
          data: updateUserData,
        })
      )
    }
    if (Object.keys(updateDriverData).length > 0) {
      updatePromises.push(
        prisma.driver.update({
          where: { id: user.driver!.id },
          data: updateDriverData,
        })
      )
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises)
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: '個人資料已更新' },
    })
  } catch (error) {
    console.error('Update driver profile error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
