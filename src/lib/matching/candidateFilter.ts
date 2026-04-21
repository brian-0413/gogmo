// 候選訂單過濾器
// 根據 anchorOrder、司機資料、搜尋時間窗過濾候選訂單

import { isVehicleCompatible } from '@/lib/vehicle'
import type { VehicleType, RequirementLevel } from '@/lib/vehicle'
import { getTravelTime } from '../zones/travelTime'
import type { SearchWindow } from './types'
import type { AnyZone } from '../zones/types'
import { addressToZone } from '../zones/addressToZone'

// 候選訂單類型（只用於篩選的有限欄位）
type CandidateOrder = {
  id: string
  type: string
  scheduledTime: Date | string
  pickupLocation: string
  dropoffLocation: string
  price?: number
  status: string
  vehicleType?: string | null
  vehicleRequirement?: string | null
}

/**
 * 預估訂單結束時間
 * = 預定時間 + 預估車程（從 originZone → destinationZone）
 */
export function calculateOrderEndTime(order: {
  scheduledTime: Date | string
  pickupLocation: string
  dropoffLocation: string
}): Date {
  const scheduledTime = typeof order.scheduledTime === 'string'
    ? new Date(order.scheduledTime)
    : order.scheduledTime

  // 嘗試用 zone 計算車程，失敗時 fallback 90 分鐘
  const originZone = addressToZone(order.pickupLocation)
  const destZone = addressToZone(order.dropoffLocation)
  let travelMinutes = 90

  if (originZone && destZone) {
    const tt = getTravelTime(originZone, destZone, { time: scheduledTime })
    if (tt < 999) travelMinutes = tt
  }

  return new Date(scheduledTime.getTime() + travelMinutes * 60 * 1000)
}

/**
 * 取得搜尋時間窗
 * 接機單後緩衝 2 小時，送機單後緩衝 3 小時
 */
export function getSearchWindow(anchorOrder: {
  type: string
  scheduledTime: Date | string
  pickupLocation: string
  dropoffLocation: string
}): SearchWindow {
  const anchorEnd = calculateOrderEndTime(anchorOrder)
  const bufferHours = anchorOrder.type === 'pickup' ? 2 : 3
  const earliestStartTime = new Date(anchorEnd.getTime() + bufferHours * 60 * 60 * 1000)
  const latestStartTime = new Date(earliestStartTime.getTime() + 8 * 60 * 60 * 1000)
  return { earliestStartTime, latestStartTime }
}

/**
 * 過濾候選訂單
 * 條件：
 * - 非自己
 * - status === 'PENDING' 或 'PUBLISHED'（可接狀態）
 * - 車型可匹配
 * - 時間在搜尋窗內
 * - originZone 已解析（智慧排單不處理無法分類的訂單）
 */
export function filterCandidates(
  candidates: CandidateOrder[],
  anchor: {
    id: string
    type: string
    scheduledTime: Date | string
    pickupLocation: string
    dropoffLocation: string
    vehicleType?: string | null
  },
  _driver: { vehicleType?: string },
  window: SearchWindow
): CandidateOrder[] {
  return candidates.filter(c => {
    // 排除：自己
    if (c.id === anchor.id) return false

    // 排除：狀態不可接
    if (c.status !== 'PENDING' && c.status !== 'PUBLISHED') return false

    // 排除：車型不匹配
    const driverVehicle = (anchor.vehicleType as VehicleType) || 'SEDAN_5'
    const orderVehicle = (c as any).vehicleType as VehicleType || 'SEDAN_5'
    const orderReq = (c as any).vehicleRequirement as RequirementLevel || 'MIN'
    if (!isVehicleCompatible(driverVehicle, orderVehicle, orderReq)) return false

    // 排除：時間不在搜尋窗內
    const candTime = typeof c.scheduledTime === 'string'
      ? new Date(c.scheduledTime)
      : c.scheduledTime
    if (candTime < window.earliestStartTime) return false
    if (candTime > window.latestStartTime) return false

    // 排除：無法分類 originZone 的訂單（智慧排單不處理）
    const originZone = addressToZone(c.pickupLocation)
    if (!originZone) return false

    return true
  })
}
