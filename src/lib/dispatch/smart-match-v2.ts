// 智慧排單演算法（gogmo smart dispatch v2）
// 根據錨點訂單推薦配套單

import type { ZoneCode } from '@/lib/zones/v2/distance-matrix'
import { getZoneTravelTime, isAirportZone } from '@/lib/zones/v2/distance-matrix'
import { addressToZone } from '@/lib/zones/v2/address-to-zone'

// ========== 系統參數 ==========
const MIN_DROPOFF_GAP_HOURS = 1.5   // 送機後最小接機間隔
const MIN_PICKUP_GAP_HOURS = 2.5     // 接機後最小送機間隔
const MAX_RECOMMENDATIONS = 15       // 最多推薦 15 張
const CONFLICT_THRESHOLD_MINUTES = 90 // 行程衝突閾值（少於此視為衝突）

export interface SmartMatchOrder {
  id: string
  type: string                       // 'pickup' | 'dropoff' | ...
  scheduledTime: Date | string
  pickupLocation: string
  dropoffLocation: string
  price: number
  status: string
  vehicleType?: string | null
  vehicleRequirement?: string | null
  originZone?: string | null
  destinationZone?: string | null
}

export interface SmartMatchRecommendation {
  order: SmartMatchOrder
  intervalMinutes: number             // 距離錨點的時間間隔（分鐘）
  travelFromAnchor: number           // 從錨點終點到推薦單起點的車程（分鐘）
  reason: string                     // 推薦原因
  sortKey: number                    // 用於排序的 key（越小越優先）
}

/**
 * 計算錨點的結束時間
 * 錨點結束 = 預定時間 + 車程（從起點 Zone → 終點 Zone）
 */
function getAnchorEndTime(anchor: SmartMatchOrder): Date {
  const scheduledTime = anchor.scheduledTime instanceof Date
    ? anchor.scheduledTime
    : new Date(anchor.scheduledTime)

  const originZone = (anchor.originZone || addressToZone(anchor.pickupLocation)) as ZoneCode | null
  const destZone = (anchor.destinationZone || addressToZone(anchor.dropoffLocation)) as ZoneCode | null

  let travelMinutes = 90 // fallback 預估 90 分鐘
  if (originZone && destZone) {
    const tt = getZoneTravelTime(originZone as ZoneCode, destZone as ZoneCode)
    if (tt < 999) travelMinutes = tt
  }

  return new Date(scheduledTime.getTime() + travelMinutes * 60 * 1000)
}

/**
 * 根據錨點計算推薦單的時間範圍
 */
function getSearchWindow(anchorEndTime: Date, anchorType: string): { earliest: Date; latest: Date } {
  const bufferMs = (anchorType === 'dropoff' ? MIN_DROPOFF_GAP_HOURS : MIN_PICKUP_GAP_HOURS) * 60 * 60 * 1000
  const earliest = new Date(anchorEndTime.getTime() + bufferMs)
  const latest = new Date(earliest.getTime() + 8 * 60 * 60 * 1000) // 最多往後 8 小時
  return { earliest, latest }
}

/**
 * 過濾候選單（Step 1-3）
 */
function filterCandidates(
  candidates: SmartMatchOrder[],
  anchor: SmartMatchOrder,
  anchorEndTime: Date,
  window: { earliest: Date; latest: Date }
): SmartMatchOrder[] {
  const anchorType = anchor.type

  return candidates.filter(c => {
    // 排除自己
    if (c.id === anchor.id) return false

    // 排除不可接狀態
    if (c.status !== 'PUBLISHED') return false

    // 種類規則（送機→接機，接機→送機）
    if (anchorType === 'dropoff') {
      if (c.type !== 'pickup') return false
    } else if (anchorType === 'pickup') {
      if (c.type !== 'dropoff') return false
    } else {
      // 其他種類（transfer/charter/pending）→ MVP 不推薦
      return false
    }

    // 機場規則（MVP 只處理桃機）
    if (anchorType === 'dropoff') {
      // 錨點是送機（從地點去機場），推薦的接機必須是從桃機出發
      const pickupZone = (c.originZone || addressToZone(c.pickupLocation)) as ZoneCode | null
      if (!pickupZone || pickupZone !== 'TPE_AIRPORT') return false
    } else if (anchorType === 'pickup') {
      // 錨點是接機（從機場到地點），推薦的送機必須是去桃機
      const dropoffZone = (c.destinationZone || addressToZone(c.dropoffLocation)) as ZoneCode | null
      if (!dropoffZone || dropoffZone !== 'TPE_AIRPORT') return false
    }

    // 時間範圍
    const candTime = c.scheduledTime instanceof Date ? c.scheduledTime : new Date(c.scheduledTime)
    if (candTime < window.earliest) return false
    if (candTime > window.latest) return false

    return true
  })
}

/**
 * 排序並截斷
 */
function sortAndLimit(
  filtered: SmartMatchOrder[],
  anchor: SmartMatchOrder,
  anchorEndTime: Date
): SmartMatchOrder[] {
  const anchorType = anchor.type

  // 計算錨點的終點 zone（推薦單的起點要離這裡近）
  const anchorEndZone = (anchor.destinationZone || addressToZone(anchor.dropoffLocation)) as ZoneCode | null

  const sorted = [...filtered].sort((a, b) => {
    if (anchorType === 'dropoff') {
      // 送機錨點 → 按時間由近而遠排序
      const aTime = a.scheduledTime instanceof Date ? a.scheduledTime : new Date(a.scheduledTime)
      const bTime = b.scheduledTime instanceof Date ? b.scheduledTime : new Date(b.scheduledTime)
      return aTime.getTime() - bTime.getTime()
    } else {
      // 接機錨點 → 先按距離，再按時間
      const aZone = (a.originZone || addressToZone(a.pickupLocation)) as ZoneCode | null
      const bZone = (b.originZone || addressToZone(b.pickupLocation)) as ZoneCode | null
      const aDist = (anchorEndZone && aZone) ? getZoneTravelTime(anchorEndZone, aZone) : 999
      const bDist = (anchorEndZone && bZone) ? getZoneTravelTime(anchorEndZone, bZone) : 999
      if (aDist !== bDist) return aDist - bDist
      const aTime = a.scheduledTime instanceof Date ? a.scheduledTime : new Date(a.scheduledTime)
      const bTime = b.scheduledTime instanceof Date ? b.scheduledTime : new Date(b.scheduledTime)
      return aTime.getTime() - bTime.getTime()
    }
  })

  return sorted.slice(0, MAX_RECOMMENDATIONS)
}

/**
 * 主導出函式
 */
export function calculateSmartMatch(
  anchor: SmartMatchOrder,
  candidates: SmartMatchOrder[],
  driverExistingOrders: SmartMatchOrder[] = []
): SmartMatchRecommendation[] {
  // Step 0: 基本驗證
  if (!anchor || !anchor.scheduledTime) return []

  const anchorEndTime = getAnchorEndTime(anchor)
  const window = getSearchWindow(anchorEndTime, anchor.type)
  const anchorType = anchor.type

  // Step 1-3: 過濾
  const filtered = filterCandidates(candidates, anchor, anchorEndTime, window)

  // Step 4: 排序並截斷
  const sorted = sortAndLimit(filtered, anchor, anchorEndTime)

  // Step 5: 時間衝突檢查（移除與司機其他已接單衝突的）
  const withoutConflict = sorted.filter(rec => {
    return !driverExistingOrders.some(existing => {
      if (existing.id === anchor.id) return false
      const existingTime = existing.scheduledTime instanceof Date
        ? existing.scheduledTime
        : new Date(existing.scheduledTime)
      const recTime = rec.scheduledTime instanceof Date
        ? rec.scheduledTime
        : new Date(rec.scheduledTime)
      const diffMinutes = Math.abs(existingTime.getTime() - recTime.getTime()) / (1000 * 60)
      return diffMinutes < CONFLICT_THRESHOLD_MINUTES
    })
  })

  // 轉換為 SmartMatchRecommendation 格式
  const anchorEndZone = (anchor.destinationZone || addressToZone(anchor.dropoffLocation)) as ZoneCode | null

  return withoutConflict.map(order => {
    const orderTime = order.scheduledTime instanceof Date
      ? order.scheduledTime
      : new Date(order.scheduledTime)
    const intervalMinutes = Math.round((orderTime.getTime() - anchorEndTime.getTime()) / (1000 * 60))

    const orderPickupZone = (order.originZone || addressToZone(order.pickupLocation)) as ZoneCode | null
    const travelFromAnchor = (anchorEndZone && orderPickupZone)
      ? getZoneTravelTime(anchorEndZone, orderPickupZone)
      : 999

    const reason = buildReason(anchorType, intervalMinutes, travelFromAnchor, order)

    let sortKey: number
    if (anchorType === 'dropoff') {
      sortKey = intervalMinutes
    } else {
      sortKey = travelFromAnchor * 1000 + intervalMinutes
    }

    return {
      order,
      intervalMinutes,
      travelFromAnchor,
      reason,
      sortKey,
    }
  }).sort((a, b) => a.sortKey - b.sortKey)
}

/**
 * 建立推薦原因字串
 */
function buildReason(
  anchorType: string,
  intervalMinutes: number,
  travelFromAnchor: number,
  order: SmartMatchOrder
): string {
  const hours = Math.floor(intervalMinutes / 60)
  const mins = intervalMinutes % 60
  const timeLabel = hours > 0 ? `${hours}小時${mins > 0 ? `${mins}分` : ''}` : `${mins}分鐘`

  if (anchorType === 'dropoff') {
    return `距離送機 ${timeLabel}，桃機出發`
  } else {
    const distLabel = travelFromAnchor <= 20 ? '極近' : travelFromAnchor <= 40 ? '近' : travelFromAnchor <= 60 ? '適中' : '較遠'
    return `距離錨點 ${distLabel}（${travelFromAnchor}分），間隔 ${timeLabel}`
  }
}