/**
 * 智慧排班系統 - 時間參數與計算函數
 *
 * 規格參考：docs/smart-scheduling.md
 *
 * 尖峰時段：06:30-09:00 / 16:00-19:00
 * 行車時間表：雙北 <-> 桃園機場 / 松山機場
 */

import type { Order } from '@/types'

// ─── 尖峰時段判斷 ─────────────────────────────────────────

/**
 * 判斷指定時間是否為尖峰時段
 * 早上尖峰：06:30 - 09:00
 * 下午尖峰：16:00 - 19:00
 */
export function isPeakHour(time: Date): boolean {
  const hour = time.getHours()
  const minute = time.getMinutes()
  const totalMinutes = hour * 60 + minute

  // 早上尖峰 06:30 - 09:00
  if (totalMinutes >= 6 * 60 + 30 && totalMinutes <= 9 * 60) return true
  // 下午尖峰 16:00 - 19:00
  if (totalMinutes >= 16 * 60 && totalMinutes <= 19 * 60) return true

  return false
}

// ─── 行車時間表 ───────────────────────────────────────────

interface TravelTime {
  offPeak: number  // 分鐘
  peak: number     // 分鐘
}

const TRAVEL_TIMES: Record<string, TravelTime> = {
  'taipei-TPE':  { offPeak: 50, peak: 75 },  // 雙北 → 桃園機場
  'TPE-taipei':  { offPeak: 50, peak: 75 },  // 桃園機場 → 雙北
  'taipei-TSA':  { offPeak: 30, peak: 50 },  // 雙北 → 松山機場
  'TSA-taipei':  { offPeak: 30, peak: 50 },  // 松山機場 → 雙北
}

/**
 * 根據出發時間的尖峰/離峰狀態，回傳行車分鐘數
 */
export function getTravelMinutes(from: string, to: string, departTime: Date): number {
  const key = `${from}-${to}`
  const times = TRAVEL_TIMES[key]
  if (!times) return 60 // 預設 60 分鐘
  return isPeakHour(departTime) ? times.peak : times.offPeak
}

// ─── 機場識別 ─────────────────────────────────────────────

/**
 * 從地點字串識別機場
 * 回傳 'TPE' | 'TSA' | 'KHH' | 'RMQ' | null
 */
export function detectAirport(location: string): string | null {
  const loc = location.toUpperCase()
  if (loc.includes('TPE') || loc.includes('桃園')) return 'TPE'
  if (loc.includes('TSA') || loc.includes('松山')) return 'TSA'
  if (loc.includes('KHH') || loc.includes('小港')) return 'KHH'
  if (loc.includes('RMQ') || loc.includes('清泉')) return 'RMQ'
  return null
}

// ─── 銜接緊密度 ───────────────────────────────────────────

export type Tightness = 'perfect' | 'reasonable' | 'tight'

export interface TightnessInfo {
  level: Tightness
  label: string
  color: string   // Tailwind class
  bgColor: string // Tailwind class
}

const TIGHTNESS_MAP: Record<Tightness, TightnessInfo> = {
  perfect: {
    level: 'perfect',
    label: '完美銜接',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  reasonable: {
    level: 'reasonable',
    label: '需等候',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
  tight: {
    level: 'tight',
    label: '時間較趕',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
}

/**
 * 送機 → 接機：計算銜接緊密度
 * @param arriveAtAirport 司機預計到達機場時間
 * @param landingTime 航班落地時間
 * @returns 銜接緊密度資訊
 */
export function calcTightnessPickup(arriveAtAirport: Date, landingTime: Date): TightnessInfo {
  const diffMs = arriveAtAirport.getTime() - landingTime.getTime()
  const diffMins = diffMs / (1000 * 60)

  if (diffMins >= -30 && diffMins <= 30) {
    return TIGHTNESS_MAP.perfect // 司機到機場時，客人 0-30 分鐘內出關
  } else if (diffMins >= -60 && diffMins <= 60) {
    return TIGHTNESS_MAP.reasonable // 30-60 分鐘等候
  } else {
    return TIGHTNESS_MAP.tight // 時間差距大
  }
}

/**
 * 接機 → 送機：計算銜接緊密度
 * @param arriveAtDest 司機送完客人後到達目的地時間
 * @param sendTime 下一單送機出發時間
 * @returns 銜接緊密度資訊
 */
export function calcTightnessDropoff(arriveAtDest: Date, sendTime: Date): TightnessInfo {
  const diffMs = sendTime.getTime() - arriveAtDest.getTime()
  const bufferMins = diffMs / (1000 * 60)

  if (bufferMins >= 90) {
    return TIGHTNESS_MAP.perfect // 緩衝 >= 90 分鐘
  } else if (bufferMins >= 60) {
    return TIGHTNESS_MAP.reasonable // 60-90 分鐘
  } else {
    return TIGHTNESS_MAP.tight // < 60 分鐘
  }
}

// ─── 工具函數 ─────────────────────────────────────────────

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function formatHHMM(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function formatMDHHMM(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${formatHHMM(date)}`
}

// ─── 情境一：送機後推薦接機單 ──────────────────────────────

export interface PickupRecommendation {
  order: Order
  /** 司機到達機場時間 */
  arriveAtAirport: Date
  /** 航班落地時間 */
  landingTime: Date
  /** 銜接緊密度 */
  tightness: TightnessInfo
  /** 預計等候分鐘數（從落地到司機到機場） */
  waitMinutes: number
  /** 解說文字 */
  explanation: string
}

/**
 * 情境一：司機有一張送機單，推薦可銜接的接機單
 *
 * 邏輯：
 * 1. 計算司機送完客後到達機場時間 = 送機出發時間 + 行車時間
 * 2. 接機單落地時間需滿足：司機到機場時間 - 20分 <= 落地時間 <= 司機到機場時間 + 40分
 */
export function recommendPickupAfterDropoff(
  dropoffOrder: Order,
  availableOrders: Order[]
): PickupRecommendation[] {
  const departTime = new Date(dropoffOrder.scheduledTime)
  const airport = detectAirport(dropoffOrder.dropoffLocation) || 'TPE'

  // 送機目的地是機場，計算司機到機場的時間
  const travelMin = getTravelMinutes('taipei', airport, departTime)
  const arriveAtAirport = addMinutes(departTime, travelMin)

  const minLanding = addMinutes(arriveAtAirport, -20)
  const maxLanding = addMinutes(arriveAtAirport, 40)

  const recommendations: PickupRecommendation[] = []

  for (const order of availableOrders) {
    // 只考慮接機單
    if (order.type !== 'pickup' && order.type !== 'pickup_boat') continue
    // 機場需一致
    const orderAirport = detectAirport(order.pickupLocation)
    if (orderAirport !== airport) continue
    // 只推薦 PUBLISHED
    if (order.status !== 'PUBLISHED') continue

    const landingTime = new Date(order.scheduledTime)

    // 在允許範圍內
    if (landingTime >= minLanding && landingTime <= maxLanding) {
      const waitMs = arriveAtAirport.getTime() - landingTime.getTime()
      const waitMins = Math.round(waitMs / (1000 * 60))
      const tightness = calcTightnessPickup(arriveAtAirport, landingTime)

      // 客人出關時間估算：落地 + 45 分鐘
      const exitTime = addMinutes(landingTime, 45)
      const explanation = `客人預計 ${formatHHMM(exitTime)}-${formatHHMM(addMinutes(exitTime, 30))} 出關`

      recommendations.push({
        order,
        arriveAtAirport,
        landingTime,
        tightness,
        waitMinutes: Math.abs(waitMins),
        explanation,
      })
    }
  }

  // 按等候分鐘數排序（等候時間最短的排前面）
  recommendations.sort((a, b) => a.waitMinutes - b.waitMinutes)
  return recommendations
}

// ─── 情境二：接機後推薦送機單 ─────────────────────────────

export interface DropoffRecommendation {
  order: Order
  /** 司機送完客人後到達目的地時間 */
  arriveAtDest: Date
  /** 送機出發時間 */
  sendTime: Date
  /** 銜接緊密度 */
  tightness: TightnessInfo
  /** 緩衝分鐘數 */
  bufferMinutes: number
  /** 解說文字 */
  explanation: string
}

/**
 * 情境二：司機有一張接機單，推薦可銜接的送機單
 *
 * 邏輯：
 * 1. 計算客人上車時間 = 落地時間 + 45 分鐘
 * 2. 計算送完客人後到達目的地時間 = 上車時間 + 行車時間
 * 3. 送機出發時間需滿足：最早出發 = 到達時間 + 75分（緩衝），最晚 = 到達時間 + 135分
 */
export function recommendDropoffAfterPickup(
  pickupOrder: Order,
  availableOrders: Order[]
): DropoffRecommendation[] {
  const landingTime = new Date(pickupOrder.scheduledTime)
  const airport = detectAirport(pickupOrder.pickupLocation) || 'TPE'

  // 客人出關上車時間 = 落地 + 45 分鐘
  const pickupTime = addMinutes(landingTime, 45)

  // 到達目的地時間（目的地是客人要去的地方）
  const travelMin = getTravelMinutes(airport, 'taipei', pickupTime)
  const arriveAtDest = addMinutes(pickupTime, travelMin)

  // 送機緩衝：75-135 分鐘
  const earliestSend = addMinutes(arriveAtDest, 75)
  const latestSend = addMinutes(arriveAtDest, 135)

  const recommendations: DropoffRecommendation[] = []

  for (const order of availableOrders) {
    // 只考慮送機單
    if (order.type !== 'dropoff' && order.type !== 'dropoff_boat') continue
    // 目的地需是機場
    const destAirport = detectAirport(order.dropoffLocation)
    if (!['TPE', 'TSA', 'KHH', 'RMQ'].includes(destAirport || '')) continue
    // 只推薦 PUBLISHED
    if (order.status !== 'PUBLISHED') continue

    const sendTime = new Date(order.scheduledTime)

    if (sendTime >= earliestSend && sendTime <= latestSend) {
      const bufferMs = sendTime.getTime() - arriveAtDest.getTime()
      const bufferMins = Math.round(bufferMs / (1000 * 60))
      const tightness = calcTightnessDropoff(arriveAtDest, sendTime)

      const explanation = `預計 ${formatHHMM(arriveAtDest)} 到達起點，緩衝約 ${bufferMins} 分鐘`

      recommendations.push({
        order,
        arriveAtDest,
        sendTime,
        tightness,
        bufferMinutes: bufferMins,
        explanation,
      })
    }
  }

  // 按緩衝分鐘數排序（緩衝最少的排前面）
  recommendations.sort((a, b) => a.bufferMinutes - b.bufferMinutes)
  return recommendations
}

// ─── 推薦結果 ─────────────────────────────────────────────

export interface ScheduleRecommendation {
  /** 觸發推薦的原始訂單 */
  triggerOrder: Order
  /** 推薦類型 */
  type: 'pickup' | 'dropoff'
  /** 機場 */
  airport: string
  /** 推薦的接機單列表 */
  pickupRecommendations: PickupRecommendation[]
  /** 推薦的送機單列表 */
  dropoffRecommendations: DropoffRecommendation[]
  /** 排班預覽（包含已選 + 推薦的完整時間軸） */
  timeline: TimelineNode[]
  /** 總收入預估 */
  totalIncome: number
}

export interface TimelineNode {
  time: Date
  label: string
  order?: Order
  isTrigger?: boolean
  waitMinutes?: number
  travelMinutes?: number
  peakLabel?: string
}

/**
 * 根據司機現有行程，產生完整排班推薦
 * @param currentOrders 司機已接的行程（通常是最近一張未完成的）
 * @param availableOrders 接單大廳可接的單
 */
export function getScheduleRecommendations(
  currentOrders: Order[],
  availableOrders: Order[]
): ScheduleRecommendation[] {
  // 只考慮未完成的行程
  const activeOrders = currentOrders.filter(
    (o) => !['COMPLETED', 'CANCELLED'].includes(o.status)
  )

  if (activeOrders.length === 0) return []

  // 按時間排序，取最近的一張
  const sorted = [...activeOrders].sort(
    (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
  )
  const triggerOrder = sorted[sorted.length - 1]

  const isPickup = triggerOrder.type === 'pickup' || triggerOrder.type === 'pickup_boat'
  const airport = detectAirport(
    isPickup ? triggerOrder.pickupLocation : triggerOrder.dropoffLocation
  ) || 'TPE'

  const pickupRecs = recommendPickupAfterDropoff(triggerOrder, availableOrders)
  const dropoffRecs = recommendDropoffAfterPickup(triggerOrder, availableOrders)

  // 建構時間軸
  const timeline = buildTimeline(triggerOrder, isPickup, airport)

  // 總收入：現有行程 + 推薦清單中選中的
  const totalIncome = triggerOrder.price

  return [{
    triggerOrder,
    type: isPickup ? 'pickup' : 'dropoff',
    airport,
    pickupRecommendations: pickupRecs,
    dropoffRecommendations: dropoffRecs,
    timeline,
    totalIncome,
  }]
}

/**
 * 建構排班預覽時間軸
 */
function buildTimeline(
  trigger: Order,
  isPickup: boolean,
  airport: string
): TimelineNode[] {
  const nodes: TimelineNode[] = []
  const triggerTime = new Date(trigger.scheduledTime)

  if (isPickup) {
    // 觸發訂單是接機單：顯示接機 → 送客 → 到達 → 送機銜接
    const landingTime = triggerTime
    const pickupTime = addMinutes(landingTime, 45)
    const travelToDest = getTravelMinutes(airport, 'taipei', pickupTime)
    const arriveDest = addMinutes(pickupTime, travelToDest)

    nodes.push({ time: landingTime, label: `接機 ${trigger.pickupLocation} → ${trigger.dropoffLocation}`, order: trigger, isTrigger: true, peakLabel: isPeakHour(landingTime) ? '尖峰' : '離峰' })
    nodes.push({ time: pickupTime, label: '客人上車', waitMinutes: 45 })
    nodes.push({ time: arriveDest, label: '送達目的地', travelMinutes: travelToDest })

    // 緩衝 75 分鐘
    const bufferStart = addMinutes(arriveDest, 0)
    nodes.push({ time: bufferStart, label: `等候 ${75} 分鐘（緩衝）`, waitMinutes: 75 })
  } else {
    // 觸發訂單是送機單：顯示送機 → 到機場
    const departTime = triggerTime
    const travelToAirport = getTravelMinutes('taipei', airport, departTime)
    const arriveAirport = addMinutes(departTime, travelToAirport)

    nodes.push({ time: departTime, label: `送機 ${trigger.pickupLocation} → ${trigger.dropoffLocation}`, order: trigger, isTrigger: true, peakLabel: isPeakHour(departTime) ? '尖峰' : '離峰' })
    nodes.push({ time: arriveAirport, label: `抵達 ${airport === 'TPE' ? '桃園機場' : airport === 'TSA' ? '松山機場' : airport}`, travelMinutes: travelToAirport })
  }

  return nodes
}

// ─── 格式化工具 ───────────────────────────────────────────

export function formatTightnessLabel(level: Tightness): string {
  const map: Record<Tightness, string> = {
    perfect: '完美銜接',
    reasonable: '需等候',
    tight: '時間較趕',
  }
  return map[level]
}
