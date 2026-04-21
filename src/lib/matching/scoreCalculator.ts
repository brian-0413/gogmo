// 分數計算器
// 計算每張候選訂單的：配套分數、時間分數、距離分數、總分

import type { Order } from '@/types'
import { getTravelTime, getDistanceScore, calcGapMinutes } from '../zones/travelTime'
import type { Scores, WarningFlag } from './types'
import {
  PICKUP_BUFFER_HOURS,
  DROPOFF_BUFFER_HOURS,
} from './types'

/**
 * 計算三個分數 + 總分
 *
 * @param candidate 候選訂單
 * @param anchor 錨點訂單（司機已有行程）
 * @param anchorEnd 錨點結束時間（calculateOrderEndTime）
 * @param anchorEndZone 錨點終點 Zone
 */
export function calculateScores(
  candidate: {
    id: string
    type: string
    scheduledTime: Date | string
    pickupLocation: string
    dropoffLocation: string
    vehicleType?: string | null
    vehicleRequirement?: string | null
    originZone?: string
  },
  anchor: {
    id: string
    type: string
    scheduledTime: Date | string
    pickupLocation: string
    dropoffLocation: string
    vehicleType?: string | null
  },
  anchorEnd: Date,
  anchorEndZone: string | null
): Scores & { warningFlag: WarningFlag; travelMinutesFromAnchor: number | null } {
  const candidateType = candidate.type || 'pending'

  // === 配套分數 ===
  const isPair =
    (anchor.type === 'pickup' && candidateType === 'dropoff') ||
    (anchor.type === 'dropoff' && candidateType === 'pickup') ||
    (anchor.type === 'pickup_boat' && candidateType === 'dropoff_boat') ||
    (anchor.type === 'dropoff_boat' && candidateType === 'pickup_boat')
  const pairingScore = isPair ? 100 : 0

  // === 時間分數 ===
  const bufferHours = anchor.type?.startsWith('pickup') ? PICKUP_BUFFER_HOURS : DROPOFF_BUFFER_HOURS
  const candidateTime = typeof candidate.scheduledTime === 'string'
    ? new Date(candidate.scheduledTime)
    : candidate.scheduledTime
  const gapHours = calcGapMinutes(anchorEnd, candidateTime) / 60

  let timingScore: number
  if (gapHours < bufferHours) {
    timingScore = 0 // 緩衝不夠
  } else if (gapHours <= bufferHours + 2) {
    timingScore = 100 // 剛好
  } else if (gapHours <= bufferHours + 4) {
    timingScore = 70
  } else if (gapHours <= bufferHours + 6) {
    timingScore = 40
  } else {
    timingScore = 10
  }

  // === 距離分數 ===
  let travelMinutes: number | null = null
  let distanceScore = 50 // 無法計算時的中間值

  if (anchorEndZone) {
    const candidateStartZone = (candidate as any).originZone as string | undefined
    if (candidateStartZone) {
      travelMinutes = getTravelTime(anchorEndZone, candidateStartZone, {
        time: anchorEnd,
        isWeekend: isWeekend(anchorEnd),
      })
      distanceScore = getDistanceScore(travelMinutes)
    }
  }

  // === 加權總分 ===
  // 配套 1.0 + 時間 0.6 + 距離 0.4 = 最高 200
  const totalScore = Math.round(
    pairingScore * 1.0 +
    timingScore * 0.6 +
    distanceScore * 0.4
  )

  return {
    pairingScore,
    timingScore,
    distanceScore,
    totalScore,
    warningFlag: null,
    travelMinutesFromAnchor: travelMinutes,
  }
}

/**
 * 降級策略：賦予 warningFlag
 *
 * Layer A（主）：pairingScore === 100
 * Layer B（同區域同類型）：pairingScore === 0 但同類型 + distanceScore >= 65
 * Layer C（有配套但遠）：pairingScore === 100 但 distanceScore < 65
 */
export function applyDegradeFlags(scored: Array<Scores & { warningFlag: WarningFlag; order: { id: string; type: string; pickupLocation: string; dropoffLocation: string; scheduledTime: Date | string } }>): Array<Scores & { warningFlag: WarningFlag; order: { id: string; type: string; pickupLocation: string; dropoffLocation: string; scheduledTime: Date | string } }> {
  const hasA = scored.some(s => s.pairingScore === 100)

  if (hasA) {
    // 主層：檢查是否有 C 層（有配套但遠）
    return scored.map(s => {
      if (s.pairingScore === 100 && s.distanceScore < 65) {
        return { ...s, warningFlag: 'DEGRADE_C' as WarningFlag }
      }
      return s
    })
  }

  // 降級 B：同類型 + distanceScore >= 65
  return scored.map(s => {
    if (s.pairingScore === 0 && s.distanceScore >= 65) {
      return { ...s, warningFlag: 'DEGRADE_B' as WarningFlag }
    }
    return s
  })
}

/** 簡單判斷是否週末 */
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}
