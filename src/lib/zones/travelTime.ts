// Travel Time 查詢函式
// 根據 docs/gogmo-zones-matrix.md「查詢函式」段落實作

import { getTravelTimeEntry } from './matrixData'
import { getDistanceScore as calcDistanceScore } from './matrixData'
import type { TravelTimeOptions } from './types'

/**
 * 查詢兩 Zone 之間的車程時間（分鐘）
 * 自動套用時段倍率：
 *   07:00-09:00 ×1.3
 *   17:00-20:00 ×1.4
 *   23:00-05:00 ×0.8
 *   週末 ×1.1
 */
export function getTravelTime(from: string, to: string, options?: TravelTimeOptions): number {
  const base = getTravelTimeEntry(from, to)
  if (base === undefined) return 60 // 未定義，回傳保守值 60 分鐘

  let multiplier = 1.0

  if (options?.time) {
    const hour = options.time.getHours()
    if (hour >= 7 && hour < 9) {
      multiplier *= 1.3
    } else if (hour >= 17 && hour < 20) {
      multiplier *= 1.4
    } else if (hour >= 23 || hour < 5) {
      multiplier *= 0.8
    }
  }

  if (options?.isWeekend) {
    multiplier *= 1.1
    // 觀光區（淡水、金山、瑞芳等）額外加成
    if (options?.isTouristZone) {
      multiplier *= 1.3
    }
  }

  return Math.round(base * multiplier)
}

/**
 * 根據車程時間取得距離分數（0-100）
 * ≤10 分鐘 = 100（同區）
 * ≤20 分鐘 = 85（相鄰）
 * ≤35 分鐘 = 65（次近）
 * ≤50 分鐘 = 35（較遠）
 * >50 分鐘 = 10（遠距）
 */
export function getDistanceScore(travelMinutes: number): number {
  return calcDistanceScore(travelMinutes)
}

/**
 * 計算兩個時間點之間的間隔（分鐘）
 */
export function calcGapMinutes(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (60 * 1000))
}

/**
 * 取得時段倍率標籤
 */
export function getTimeSlotLabel(time: Date, isWeekend: boolean): string {
  const hour = time.getHours()
  if (hour >= 7 && hour < 9) return '早尖峰'
  if (hour >= 17 && hour < 20) return '晚尖峰'
  if (hour >= 23 || hour < 5) return '深夜'
  if (isWeekend) return '週末'
  return '一般'
}
