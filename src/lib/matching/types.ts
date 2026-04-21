// 智慧排單 matching 模組的型別定義

import type { Order } from '@/types'
import type { AnyZone } from '../zones/types'

/** 緩衝時間（固定常數，單位：小時） */
export const PICKUP_BUFFER_HOURS = 2   // 接機單後緩衝
export const DROPOFF_BUFFER_HOURS = 3  // 送機單後緩衝
export const MAX_SEARCH_WINDOW_HOURS = 8 // 搜尋時間窗上限

export interface SearchWindow {
  earliestStartTime: Date
  latestStartTime: Date
}

/** 三個分數 */
export interface Scores {
  pairingScore: number     // 配套分數 (0 or 100)
  timingScore: number      // 時間分數 (0-100)
  distanceScore: number    // 距離分數 (0-100, via getDistanceScore)
  totalScore: number       // 加權總分 (0-200)
}

/** 降級層級 */
export type WarningFlag = 'DEGRADE_B' | 'DEGRADE_C' | null

/** 單一推薦結果 */
export interface Recommendation {
  order: {
    id: string
    type: string
    scheduledTime: Date | string
    pickupLocation: string
    dropoffLocation: string
    price?: number
    status?: string
    vehicleType?: string | null
    vehicleRequirement?: string | null
  }
  totalScore: number
  pairingScore: number
  timingScore: number
  distanceScore: number
  matchReason: string
  warningFlag: WarningFlag
  travelMinutesFromAnchor: number | null
}

/** API 回傳格式 */
export interface SmartSortResponse {
  mode: 'anchored' | 'standalone'
  anchor: Order | null
  recommendations: Recommendation[]
  summary: {
    pairedCount: number     // 配套推薦數
    degradeBCount: number   // 降級 B 數量
    degradeCCount: number   // 降級 C 數量
  }
  message?: string          // 友善訊息（無推薦時）
}
