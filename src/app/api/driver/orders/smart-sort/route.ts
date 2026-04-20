import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { parseRegion, ADJACENT_REGIONS, REGION_LABELS } from '@/lib/geo/regions'
import { getTravelTime, calcGapMinutes } from '@/lib/geo/travelMatrix'

/**
 * GET /api/driver/orders/smart-sort
 * 取得司機的已接行程，找出可銜接的訂單並返回排序列表。
 * 每筆訂單附加 matchReason / connectsTo（僅銜接單）。
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

    // 1. 取得司機的已接行程（ACCEPTED / ARRIVED / IN_PROGRESS）
    const currentOrders = await prisma.order.findMany({
      where: {
        driverId,
        status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledTime: 'asc' },
    })

    // 2. 取得可接單（PUBLISHED 且未被接走）
    const availableOrders = await prisma.order.findMany({
      where: {
        status: 'PUBLISHED',
        scheduledTime: { gte: new Date() },
      },
      include: {
        dispatcher: { include: { user: { select: { name: true } } } },
      },
    })

    // 3. 對每個已接行程計算結束時間 + 目的地區域
    //    結束時間 = scheduledTime + 90分鐘（預估服務時間）
    const currentWithMeta = currentOrders.map(o => {
      const scheduledTime = new Date(o.scheduledTime)
      const endTime = new Date(scheduledTime.getTime() + 90 * 60 * 1000)
      const dropoffRegion = parseRegion(o.dropoffLocation)
      return {
        id: o.id,
        scheduledTime,
        endTime,
        dropoffRegion,
        pickupLocation: o.pickupLocation,
        dropoffLocation: o.dropoffLocation,
        type: o.type,
        pickupRegion: parseRegion(o.pickupLocation),
      }
    })

    // 4. 對候選訂單計算銜接分數
    type ScoredOrder = {
      order: typeof availableOrders[number]
      connectsTo: string | null
      matchReason: string | null
      travelMinutes: number | null
      gapMinutes: number | null
    }

    const scored: ScoredOrder[] = availableOrders.map(order => {
      const pickupRegion = parseRegion(order.pickupLocation)
      const orderTime = new Date(order.scheduledTime)

      // 找第一個可銜接的已接行程（取時間最早的）
      for (const cur of currentWithMeta) {
        const gap = calcGapMinutes(cur.endTime, orderTime)
        if (gap < 30 || gap > 180) continue

        const travel = getTravelTime(cur.dropoffRegion, pickupRegion)
        if (travel === null) continue
        if (travel > gap) continue
        if (travel > 90) continue

        // 可銜接！計算 reason
        const reason = buildReason(cur, order, pickupRegion, gap, travel)
        return {
          order,
          connectsTo: cur.id,
          matchReason: reason,
          travelMinutes: travel,
          gapMinutes: gap,
        }
      }

      return {
        order,
        connectsTo: null,
        matchReason: null,
        travelMinutes: null,
        gapMinutes: null,
      }
    })

    // 5. 排序：銜接單在前（按 gap 時間由短到長），其餘維持 updatedAt 順序
    const connecting = scored.filter(s => s.connectsTo !== null)
    const others = scored.filter(s => s.connectsTo === null)

    connecting.sort((a, b) => (a.gapMinutes ?? 0) - (b.gapMinutes ?? 0))

    const result = [...connecting, ...others].map(s => ({
      order: {
        id: s.order.id,
        pickupLocation: s.order.pickupLocation,
        dropoffLocation: s.order.dropoffLocation,
        scheduledTime: s.order.scheduledTime,
        price: s.order.price,
        type: s.order.type,
        passengerName: s.order.passengerName,
        flightNumber: s.order.flightNumber,
        vehicleType: s.order.vehicleType,
        vehicleRequirement: s.order.vehicleRequirement,
        status: s.order.status,
        dispatcher: s.order.dispatcher
          ? { companyName: s.order.dispatcher.companyName, user: s.order.dispatcher.user }
          : null,
      },
      connectsTo: s.connectsTo,
      matchReason: s.matchReason,
      travelMinutes: s.travelMinutes,
    }))

    return NextResponse.json<ApiResponse>({ success: true, data: { orders: result } })
  } catch (error) {
    console.error('Smart sort error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

/** 根據銜接情境生成 reason 字串 */
function buildReason(
  current: { id: string; scheduledTime: Date; dropoffRegion: string; endTime: Date },
  order: { scheduledTime: Date; pickupLocation: string },
  pickupRegion: string,
  gapMinutes: number,
  travelMinutes: number
): string {
  const curTime = formatTime(current.scheduledTime)
  const regionLabel = REGION_LABELS[pickupRegion] ?? pickupRegion

  // 是否同區域
  if (current.dropoffRegion === pickupRegion) {
    return `與你 ${curTime} 的行程同區域，銜接順暢`
  }

  // 是否相鄰區域
  if (ADJACENT_REGIONS[current.dropoffRegion]?.includes(pickupRegion)) {
    return `與你 ${curTime} 的行程相鄰（行車約 ${travelMinutes} 分）`
  }

  // 其他：顯示目的地行政區
  return `與你 ${curTime} 的行程銜接（行車約 ${travelMinutes} 分）`
}

function formatTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}