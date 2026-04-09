import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import {
  PLATFORM_FEE_RATE,
  CANCELLATION_FEE_RATE,
  TRANSFER_FEE_RATE,
  MIN_BONUS_POINTS,
} from '@/lib/constants'
import { ApiResponse } from '@/types'

// In-memory config override (resets on server restart)
// In production this would be stored in a DB AdminConfig table
let configOverrides: Record<string, number> = {}

interface FeeConfig {
  PLATFORM_FEE_RATE: number
  CANCELLATION_FEE_RATE: number
  TRANSFER_FEE_RATE: number
  MIN_BONUS_POINTS: number
  isOverridden: boolean
}

// GET /api/admin/config — 取得費率設定
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
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有管理員可以查看費率設定' },
        { status: 403 }
      )
    }

    const config: FeeConfig = {
      PLATFORM_FEE_RATE,
      CANCELLATION_FEE_RATE,
      TRANSFER_FEE_RATE,
      MIN_BONUS_POINTS,
      isOverridden: Object.keys(configOverrides).length > 0,
    }

    // Apply overrides if any
    if (configOverrides.PLATFORM_FEE_RATE !== undefined) {
      config.PLATFORM_FEE_RATE = configOverrides.PLATFORM_FEE_RATE
    }
    if (configOverrides.CANCELLATION_FEE_RATE !== undefined) {
      config.CANCELLATION_FEE_RATE = configOverrides.CANCELLATION_FEE_RATE
    }
    if (configOverrides.TRANSFER_FEE_RATE !== undefined) {
      config.TRANSFER_FEE_RATE = configOverrides.TRANSFER_FEE_RATE
    }
    if (configOverrides.MIN_BONUS_POINTS !== undefined) {
      config.MIN_BONUS_POINTS = configOverrides.MIN_BONUS_POINTS
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { config },
    })
  } catch (error) {
    console.error('Get config error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/config — 更新費率設定（記憶體暫存，重啟後重設）
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
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有管理員可以修改費率設定' },
        { status: 403 }
      )
    }

    let body: Partial<{
      PLATFORM_FEE_RATE: number
      CANCELLATION_FEE_RATE: number
      TRANSFER_FEE_RATE: number
      MIN_BONUS_POINTS: number
    }> = {}
    try { body = await request.json() } catch {}

    // Validate ranges
    if (body.PLATFORM_FEE_RATE !== undefined) {
      if (body.PLATFORM_FEE_RATE < 0 || body.PLATFORM_FEE_RATE > 1) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '平台費率需在 0~1 之間（例如：0.05 = 5%）' },
          { status: 400 }
        )
      }
    }
    if (body.CANCELLATION_FEE_RATE !== undefined) {
      if (body.CANCELLATION_FEE_RATE < 0 || body.CANCELLATION_FEE_RATE > 1) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '取消費率需在 0~1 之間' },
          { status: 400 }
        )
      }
    }
    if (body.TRANSFER_FEE_RATE !== undefined) {
      if (body.TRANSFER_FEE_RATE < 0 || body.TRANSFER_FEE_RATE > 1) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '轉單費率需在 0~1 之間' },
          { status: 400 }
        )
      }
    }
    if (body.MIN_BONUS_POINTS !== undefined) {
      if (body.MIN_BONUS_POINTS < 0 || !Number.isInteger(body.MIN_BONUS_POINTS)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '最低 bonus 點數需為正整數' },
          { status: 400 }
        )
      }
    }

    // Apply overrides
    if (body.PLATFORM_FEE_RATE !== undefined) configOverrides.PLATFORM_FEE_RATE = body.PLATFORM_FEE_RATE
    if (body.CANCELLATION_FEE_RATE !== undefined) configOverrides.CANCELLATION_FEE_RATE = body.CANCELLATION_FEE_RATE
    if (body.TRANSFER_FEE_RATE !== undefined) configOverrides.TRANSFER_FEE_RATE = body.TRANSFER_FEE_RATE
    if (body.MIN_BONUS_POINTS !== undefined) configOverrides.MIN_BONUS_POINTS = body.MIN_BONUS_POINTS

    const config: FeeConfig = {
      PLATFORM_FEE_RATE: configOverrides.PLATFORM_FEE_RATE ?? PLATFORM_FEE_RATE,
      CANCELLATION_FEE_RATE: configOverrides.CANCELLATION_FEE_RATE ?? CANCELLATION_FEE_RATE,
      TRANSFER_FEE_RATE: configOverrides.TRANSFER_FEE_RATE ?? TRANSFER_FEE_RATE,
      MIN_BONUS_POINTS: configOverrides.MIN_BONUS_POINTS ?? MIN_BONUS_POINTS,
      isOverridden: Object.keys(configOverrides).length > 0,
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        config,
        note: '設定已更新（記憶體暫存，伺服器重啟後會重設為預設值）',
      },
    })
  } catch (error) {
    console.error('Put config error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
