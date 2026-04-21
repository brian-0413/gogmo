// 智慧排單核心演算法
// 整合 filterCandidates / scoreCalculator / reasonTemplates

import type { Scores, WarningFlag, Recommendation } from './types'
import { addressToZone } from '../zones/addressToZone'
import { getTravelTime, getDistanceScore as getDS } from '../zones/travelTime'
import { calculateOrderEndTime, getSearchWindow, filterCandidates } from './candidateFilter'
import { calculateScores, applyDegradeFlags } from './scoreCalculator'
import { buildMatchReason } from './reasonTemplates'

/**
 * 對單一錨點訂單取得推薦列表
 *
 * @param anchor 錨點訂單（司機已有行程）
 * @param candidates 接單大廳所有候選訂單
 * @param driver 司機資料
 */
export function smartDispatch(
  anchor: {
    id: string
    type: string
    scheduledTime: Date | string
    pickupLocation: string
    dropoffLocation: string
    vehicleType?: string | null
    vehicleRequirement?: string | null
  },
  candidates: Array<{
    id: string
    type: string
    scheduledTime: Date | string
    pickupLocation: string
    dropoffLocation: string
    price: number
    status: string
    vehicleType?: string | null
    vehicleRequirement?: string | null
  }>
): Recommendation[] {
  // === Step 1：計算錨點結束時間 ===
  const anchorEnd = calculateOrderEndTime(anchor)
  const anchorEndZone = addressToZone(anchor.dropoffLocation)

  // === Step 2：取得搜尋時間窗 ===
  const window = getSearchWindow(anchor)

  // === Step 3：過濾候選 ===
  const filtered = filterCandidates(candidates, anchor, {}, window)

  // === Step 4：計算分數 ===
  const scored = filtered.map(candidate => {
    const scores = calculateScores(candidate, anchor, anchorEnd, anchorEndZone)
    return { ...scores, order: candidate }
  })

  // === Step 5：降級標記 ===
  const withFlags = applyDegradeFlags(scored)

  // === Step 6：排序（高分在前）===
  withFlags.sort((a, b) => b.totalScore - a.totalScore)

  // === Step 7：產生推薦原因 ===
  return withFlags.map(s => {
    const candidateStartZone = addressToZone(s.order.pickupLocation)
    const travelMinutes = candidateStartZone && anchorEndZone
      ? getTravelMinutesFromZone(anchorEndZone, candidateStartZone)
      : null

    const matchReason = buildMatchReason(s, s.warningFlag, s.order, anchor, travelMinutes)

    return {
      order: s.order,
      totalScore: s.totalScore,
      pairingScore: s.pairingScore,
      timingScore: s.timingScore,
      distanceScore: s.distanceScore,
      matchReason,
      warningFlag: s.warningFlag,
      travelMinutesFromAnchor: travelMinutes,
    }
  })
}

/**
 * Standalone 模式（司機無已接單）：按預期收益率排序
 */
export function standaloneSort(
  candidates: Array<{
    id: string
    type: string
    scheduledTime: Date | string
    pickupLocation: string
    dropoffLocation: string
    price: number
    status: string
    vehicleType?: string | null
    vehicleRequirement?: string | null
  }>
): Recommendation[] {
  const now = new Date()

  return candidates
    .filter(o => {
      if (o.status !== 'PENDING' && o.status !== 'PUBLISHED') return false
      const originZone = addressToZone(o.pickupLocation)
      const destZone = addressToZone(o.dropoffLocation)
      if (!originZone || !destZone) return false
      const t = typeof o.scheduledTime === 'string' ? new Date(o.scheduledTime) : o.scheduledTime
      return t >= now
    })
    .map(o => {
      const originZone = addressToZone(o.pickupLocation)!
      const destZone = addressToZone(o.dropoffLocation)!
      const travelMinutes = getTravelTime(originZone, destZone, { time: new Date() })
      // 預估耗時 = 車程 + 等待 45 分鐘
      const estimatedDuration = travelMinutes + 45
      const expectedHourlyRate = Math.round((o.price * 0.95) / (estimatedDuration / 60))

      return {
        order: o,
        totalScore: expectedHourlyRate, // 用時薪當分數
        pairingScore: 0,
        timingScore: 0,
        distanceScore: getDS(travelMinutes),
        matchReason: `預估時薪 NT$ ${expectedHourlyRate}`,
        warningFlag: null as WarningFlag,
        travelMinutesFromAnchor: null,
      }
    })
    .sort((a, b) => b.totalScore - a.totalScore)
}

// 輔助：從 Zone 取得車程分鐘數
function getTravelMinutesFromZone(from: string, to: string): number {
  return getTravelTime(from, to)
}
