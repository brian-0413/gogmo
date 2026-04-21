// 推薦原因模板庫
// 根據分數狀況選用對應模板產生中文 reason

import type { Scores, WarningFlag } from './types'
import { getDistanceScore } from '../zones/travelTime'

interface ReasonTemplate {
  reason: string
  scoreThreshold?: {
    pairing?: number
    distance?: number
    timing?: number
  }
}

/**
 * 根據分數與降級標記取得推薦原因
 */
export function buildMatchReason(
  scores: Scores,
  warningFlag: WarningFlag,
  candidate: { type: string },
  anchor: { type: string },
  travelMinutes: number | null
): string {
  const { pairingScore, timingScore, distanceScore } = scores

  // === 主配套 ===
  if (pairingScore === 100) {
    if (distanceScore >= 85 && timingScore >= 100) {
      return '配套完美：時間距離都合理'
    }
    if (distanceScore >= 85) {
      return travelMinutes !== null
        ? `配套推薦：路線銜接度高（${travelMinutes} 分鐘移動）`
        : '配套推薦：路線銜接度高'
    }
    return '配套推薦：能接續你的行程'
  }

  // === 降級 B（同區域同類型）===
  if (warningFlag === 'DEGRADE_B') {
    return '同區域集中接單，空車移動少'
  }

  // === 降級 C（有配套但遠）===
  if (warningFlag === 'DEGRADE_C') {
    return '有配套但距離較遠，請評估移動時間'
  }

  // === Fallback ===
  return '可接訂單'
}

/**
 * 依據時段與日期給予額外提示
 */
export function getTimeSlotHint(time: Date): string {
  const hour = time.getHours()
  if (hour >= 7 && hour < 9) return '早尖峰時段，預計較塞車'
  if (hour >= 17 && hour < 20) return '晚尖峰時段，預計較塞車'
  if (hour >= 23 || hour < 5) return '深夜時段，路面順暢'
  return ''
}
