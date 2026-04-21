import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { smartDispatch, standaloneSort } from '@/lib/matching/smartDispatch'
import type { SmartSortResponse } from '@/lib/matching/types'

/**
 * GET /api/driver/orders/smart-sort
 *
 * Query params:
 * - anchorOrderId?: string（可選，不傳表示司機無已接單，走 standalone 模式）
 *
 * 使用新的 lib/matching/ 智慧排單演算法：
 * - 有錨點：以錨點為中心計算三層優先級（配套 > 時間 > 距離）
 * - 無錨點：按預期時薪排序
 */
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

    const driverId = user.driver.id
    const { searchParams } = new URL(request.url)
    const anchorOrderId = searchParams.get('anchorOrderId') ?? undefined

    // 取得司機的已接行程（ACCEPTED / ARRIVED / IN_PROGRESS）
    const currentOrders = await prisma.order.findMany({
      where: {
        driverId,
        status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    // 取得可接單（PUBLISHED 且未被接走）
    const availableOrders = await prisma.order.findMany({
      where: {
        status: 'PUBLISHED',
        scheduledTime: { gte: new Date() },
      },
      include: {
        dispatcher: { include: { user: { select: { name: true } } } },
      },
    })

    // 如果有指定錨點訂單
    if (anchorOrderId) {
      const anchor = currentOrders.find(o => o.id === anchorOrderId)
      if (!anchor) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '找不到錨點訂單' },
          { status: 404 }
        )
      }

      const recommendations = smartDispatch(anchor, availableOrders)

      const response: SmartSortResponse = {
        mode: 'anchored',
        anchor: anchor as any,
        recommendations: recommendations as any,
        summary: {
          pairedCount: recommendations.filter(r => r.pairingScore === 100).length,
          degradeBCount: recommendations.filter(r => r.warningFlag === 'DEGRADE_B').length,
          degradeCCount: recommendations.filter(r => r.warningFlag === 'DEGRADE_C').length,
        },
      }

      return NextResponse.json<ApiResponse>({ success: true, data: response })
    }

    // 如果司機已有行程，取時間最早那個作為錨點
    if (currentOrders.length > 0) {
      const anchor = currentOrders[0]
      const recommendations = smartDispatch(anchor, availableOrders)

      const response: SmartSortResponse = {
        mode: 'anchored',
        anchor: anchor as any,
        recommendations: recommendations as any,
        summary: {
          pairedCount: recommendations.filter(r => r.pairingScore === 100).length,
          degradeBCount: recommendations.filter(r => r.warningFlag === 'DEGRADE_B').length,
          degradeCCount: recommendations.filter(r => r.warningFlag === 'DEGRADE_C').length,
        },
        message: recommendations.length === 0 ? '目前沒有合適的銜接單，稍後再試' : undefined,
      }

      return NextResponse.json<ApiResponse>({ success: true, data: response })
    }

    // 無已接行程 → standalone 模式
    const recommendations = standaloneSort(availableOrders)

    const response: SmartSortResponse = {
      mode: 'standalone',
      anchor: null,
      recommendations: recommendations as any,
      summary: {
        pairedCount: 0,
        degradeBCount: 0,
        degradeCCount: 0,
      },
      message: recommendations.length === 0 ? '目前沒有可接訂單' : undefined,
    }

    return NextResponse.json<ApiResponse>({ success: true, data: response })
  } catch (error) {
    console.error('Smart sort error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
