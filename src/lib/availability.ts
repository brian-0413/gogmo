/**
 * 司機可用時間計算 + 智慧配單演算法
 *
 * 時間邏輯：
 * - 接機後：scheduledTime + (尖峰? 150分 : 120分)
 * - 送機後：scheduledTime + 60分鐘
 * - 尖峰時段：07:00-09:00 / 16:00-18:00
 */

import type { Order } from '@/types'
import { VehicleType, RequirementLevel } from '@/lib/vehicle'
import { isVehicleCompatible, getCompatibleVehicleTypes } from '@/lib/vehicle'

// ─── 尖峰時段判斷 ────────────────────────────────────────

function isPeakHour(time: Date): boolean {
  const hours = [7, 8, 16, 17]
  return hours.includes(time.getHours())
}

// ─── 計算單一訂單的「自由時間」 ────────────────────────────

/**
 * 根據訂單類型和時間，計算司機完成此訂單後的最早可用時間
 * @param order 司機已接的行程
 * @returns 自由時間（Date）
 */
export function getFreeTimeAfterOrder(order: Pick<Order, 'scheduledTime' | 'type'>): Date {
  const scheduled = new Date(order.scheduledTime)
  const freeTime = new Date(scheduled)

  if (order.type === 'pickup' || order.type === 'pickup_boat') {
    // 接機後：尖峰+150分，一般+120分
    const offset = isPeakHour(scheduled) ? 150 : 120
    freeTime.setMinutes(freeTime.getMinutes() + offset)
  } else if (order.type === 'dropoff' || order.type === 'dropoff_boat') {
    // 送機後：+60分鐘
    freeTime.setMinutes(freeTime.getMinutes() + 60)
  } else {
    // 其他類型（接駁/包車）：+60分鐘
    freeTime.setMinutes(freeTime.getMinutes() + 60)
  }

  return freeTime
}

// ─── 計算司機的最早可用時間 ────────────────────────────────

/**
 * 從司機的所有已接訂單中，取最晚的自由時間
 * （代表司機整體上什麼時候可以再接新單）
 */
export function getDriverFreeTime(
  currentOrders: Array<Pick<Order, 'scheduledTime' | 'type' | 'status'>>
): Date {
  // 只考慮尚未完成的訂單
  const activeOrders = currentOrders.filter(
    (o) => !['COMPLETED', 'CANCELLED'].includes(o.status)
  )

  if (activeOrders.length === 0) {
    return new Date() // 司機現在就空
  }

  const freeTimes = activeOrders.map(getFreeTimeAfterOrder)
  return new Date(Math.max(...freeTimes.map((t) => t.getTime())))
}

// ─── 檢查司機能否趕上新訂單的上車時間 ────────────────────

/**
 * 粗估：司機能否從現有訂單終點，及時趕到新訂單的上車地
 * 目前用固定緩衝：機場接送需要預留 45 分鐘抵達緩衝
 * （未來可升級為 Haversine 距離計算）
 */
export function canArriveOnTime(
  driverFreeTime: Date,
  newOrder: Pick<Order, 'scheduledTime' | 'type'>
): boolean {
  const newScheduled = new Date(newOrder.scheduledTime)

  // 司機必須在 [新單時間 - 45分] 之前自由
  const latestDepart = new Date(newScheduled.getTime() - 45 * 60 * 1000)
  return driverFreeTime <= latestDepart
}

// ─── 智慧配單核心 ────────────────────────────────────────

export interface MatchedOrder extends Order {
  /** 司機從最後一單完成到此單上車所需的分鐘數 */
  minutesFromFree: number
  /** 原因說明 */
  reason: string
}

/**
 * 為司機推薦適合的後續訂單
 *
 * @param currentOrders 司機已接的行程（含狀態）
 * @param availableOrders 接單大廳中的可接訂單
 * @param driverVehicle 司機車型
 * @returns 推薦的訂單陣列（已排序：最推薦的在前）
 */
export function findMatchingOrders(
  currentOrders: Array<Pick<Order, 'scheduledTime' | 'type' | 'status'>>,
  availableOrders: Order[],
  driverVehicle: string
): MatchedOrder[] {
  const driverFreeTime = getDriverFreeTime(currentOrders)

  // 車型過濾（使用統一的 isVehicleCompatible，新系統預設 MIN 等級）
  const now = new Date()
  const recommendations: MatchedOrder[] = []

  for (const order of availableOrders) {
    // 1. 車型過濾（新系統 MIN 等級：司機車型 >= 訂單車型即可）
    if (!isVehicleCompatible(driverVehicle as VehicleType, (order as any).vehicleType as VehicleType, RequirementLevel.MIN)) continue

    // 2. 狀態過濾（只考慮 PUBLISHED）
    if (order.status !== 'PUBLISHED') continue

    // 3. 只推薦未來的單
    const orderTime = new Date(order.scheduledTime)
    if (orderTime <= now) continue

    // 4. 時間可行性檢查
    if (!canArriveOnTime(driverFreeTime, order)) continue

    // 5. 計算分鐘差（從自由時間到訂單時間）
    const minutesDiff = Math.round(
      (orderTime.getTime() - driverFreeTime.getTime()) / (60 * 1000)
    )

    // 6. 生成原因說明
    const reason = buildReason(currentOrders, order, driverFreeTime)

    recommendations.push({
      ...order,
      minutesFromFree: minutesDiff,
      reason,
    })
  }

  // 按 minutesFromFree 排序（越接近自由時間的越前面）
  recommendations.sort((a, b) => a.minutesFromFree - b.minutesFromFree)

  return recommendations
}

// ─── 生成推薦原因 ────────────────────────────────────────

function buildReason(
  currentOrders: Array<Pick<Order, 'scheduledTime' | 'type' | 'status'>>,
  newOrder: Order,
  driverFreeTime: Date
): string {
  const freeTime = new Date(driverFreeTime)
  const newTime = new Date(newOrder.scheduledTime)
  const diffMins = Math.round((newTime.getTime() - freeTime.getTime()) / (60 * 1000))

  // 找出觸發自由時間的最後一單
  const lastOrder = [...currentOrders]
    .filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status))
    .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())[0]

  if (!lastOrder) return '您目前無進行中行程，可立即接單'

  const lastTime = new Date(lastOrder.scheduledTime)
  const typeLabel = newOrder.type === 'pickup' || newOrder.type === 'pickup_boat'
    ? '接機'
    : newOrder.type === 'dropoff' || newOrder.type === 'dropoff_boat'
    ? '送機'
    : newOrder.type === 'transfer' ? '接駁' : '包車'

  if (diffMins <= 30) {
    return `${typeLabel}時間剛好，緩衝充足`
  } else if (diffMins <= 90) {
    return `${typeLabel}時間適中，有充足休息時間`
  } else {
    return `${typeLabel}時間充裕，可從容安排`
  }
}

// ─── 格式化顯示 ──────────────────────────────────────────

export function formatFreeTime(dt: Date): string {
  return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`
}
