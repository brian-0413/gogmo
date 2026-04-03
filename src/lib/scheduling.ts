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

// ─── 行政區座標資料 ─────────────────────────────────────

interface District {
  city: string
  dist: string
  lat: number
  lng: number
}

const DISTRICTS: District[] = [
  // 台北市
  { city: '台北市', dist: '中正區', lat: 25.0324, lng: 121.5190 },
  { city: '台北市', dist: '大同區', lat: 25.0631, lng: 121.5131 },
  { city: '台北市', dist: '中山區', lat: 25.0685, lng: 121.5333 },
  { city: '台北市', dist: '萬華區', lat: 25.0354, lng: 121.4997 },
  { city: '台北市', dist: '大安區', lat: 25.0263, lng: 121.5434 },
  { city: '台北市', dist: '松山區', lat: 25.0599, lng: 121.5571 },
  { city: '台北市', dist: '信義區', lat: 25.0287, lng: 121.5705 },
  { city: '台北市', dist: '士林區', lat: 25.0922, lng: 121.5245 },
  { city: '台北市', dist: '北投區', lat: 25.1321, lng: 121.4987 },
  { city: '台北市', dist: '內湖區', lat: 25.0835, lng: 121.5894 },
  { city: '台北市', dist: '南港區', lat: 25.0546, lng: 121.6071 },
  { city: '台北市', dist: '文山區', lat: 24.9897, lng: 121.5586 },
  // 新北市
  { city: '新北市', dist: '板橋區', lat: 25.0113, lng: 121.4618 },
  { city: '新北市', dist: '三重區', lat: 25.0615, lng: 121.4912 },
  { city: '新北市', dist: '中和區', lat: 24.9963, lng: 121.4966 },
  { city: '新北市', dist: '永和區', lat: 25.0076, lng: 121.5143 },
  { city: '新北市', dist: '新莊區', lat: 25.0360, lng: 121.4504 },
  { city: '新北市', dist: '新店區', lat: 24.9675, lng: 121.5411 },
  { city: '新北市', dist: '土城區', lat: 24.9725, lng: 121.4441 },
  { city: '新北市', dist: '蘆洲區', lat: 25.0849, lng: 121.4731 },
  { city: '新北市', dist: '汐止區', lat: 25.0614, lng: 121.6548 },
  { city: '新北市', dist: '樹林區', lat: 24.9907, lng: 121.4243 },
  { city: '新北市', dist: '鶯歌區', lat: 24.9545, lng: 121.3544 },
  { city: '新北市', dist: '三峽區', lat: 24.9352, lng: 121.3735 },
  { city: '新北市', dist: '淡水區', lat: 25.1762, lng: 121.4421 },
  { city: '新北市', dist: '五股區', lat: 25.0844, lng: 121.4376 },
  { city: '新北市', dist: '泰山區', lat: 25.0583, lng: 121.4312 },
  { city: '新北市', dist: '林口區', lat: 25.0775, lng: 121.3916 },
  { city: '新北市', dist: '深坑區', lat: 25.0026, lng: 121.6151 },
  { city: '新北市', dist: '石碇區', lat: 24.9917, lng: 121.6641 },
  { city: '新北市', dist: '坪林區', lat: 24.9372, lng: 121.7114 },
  { city: '新北市', dist: '三芝區', lat: 25.2584, lng: 121.5003 },
  { city: '新北市', dist: '石門區', lat: 25.2904, lng: 121.5684 },
  { city: '新北市', dist: '金山區', lat: 25.2219, lng: 121.6378 },
  { city: '新北市', dist: '萬里區', lat: 25.1748, lng: 121.6888 },
  { city: '新北市', dist: '平溪區', lat: 25.0331, lng: 121.7389 },
  { city: '新北市', dist: '雙溪區', lat: 25.0232, lng: 121.8617 },
  { city: '新北市', dist: '貢寮區', lat: 25.0224, lng: 121.9442 },
  { city: '新北市', dist: '瑞芳區', lat: 25.1088, lng: 121.8058 },
  { city: '新北市', dist: '烏來區', lat: 24.8652, lng: 121.5504 },
  { city: '新北市', dist: '八里區', lat: 25.1466, lng: 121.3995 },
]

/**
 * 從地點字串比對行政區座標
 * 回傳找到的第一個行政區座標，沒找到回傳 null
 */
function getDistrictCoords(location: string): { lat: number; lng: number } | null {
  const loc = location.toUpperCase()
  for (const d of DISTRICTS) {
    const dist = d.dist.toUpperCase()
    // 匹配：「新店」、「新店區」、「新店XX」等
    if (loc.includes(dist) || dist.includes(loc.replace(/區$/, ''))) {
      return { lat: d.lat, lng: d.lng }
    }
  }
  return null
}

/**
 * Haversine 公式計算兩點直線距離（公里）
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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
  /** 直線距離（公里）- 觸發目的地到推薦接機目的地 */
  distanceKm: number
  /** 解說文字 */
  explanation: string
}

/**
 * 情境一：司機有一張送機單（司機確定在桃園機場）
 *
 * 邏輯：
 * 1. 計算司機送完客後到達機場時間 = 送機出發時間 + 行車時間
 * 2. 候選接機單：落地時間需 >= 司機到機場時間（司機已在機場等）
 * 3. 排序：以落地時間排序（最早的航班最推薦）—— 司機已在機場，地理距離無關
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

  // 候選範圍：落地時間 >= 司機到機場時間，上限 +120 分鐘（避免等過久）
  const minLanding = arriveAtAirport
  const maxLanding = addMinutes(arriveAtAirport, 120)

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

    // 在允許範圍內（落地時間 >= 司機到機場時間）
    if (landingTime >= minLanding && landingTime <= maxLanding) {
      const waitMs = arriveAtAirport.getTime() - landingTime.getTime()
      const waitMins = Math.round(waitMs / (1000 * 60))
      const tightness = calcTightnessPickup(arriveAtAirport, landingTime)

      // 司機已在機場，地理距離設為 0（不影響排序）
      const distanceKm = 0

      // 客人出關時間估算：落地 + 45 分鐘
      const exitTime = addMinutes(landingTime, 45)
      const explanation = `客人預計 ${formatHHMM(exitTime)}-${formatHHMM(addMinutes(exitTime, 30))} 出關`

      recommendations.push({
        order,
        arriveAtAirport,
        landingTime,
        tightness,
        waitMinutes: Math.abs(waitMins),
        distanceKm,
        explanation,
      })
    }
  }

  // 排序：落地時間優先（最早的航班最推薦）
  recommendations.sort((a, b) => {
    return a.landingTime.getTime() - b.landingTime.getTime()
  })

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
  /** 直線距離（公里）- 觸發目的地到送機起點 */
  distanceKm: number
  /** 解說文字 */
  explanation: string
}

/**
 * 情境二：司機有一張接機單（司機要去接送機的地點，目的地行政區未知）
 *
 * 邏輯：
 * 1. 落地時間 T1 = scheduledTime
 * 2. 候選送機單：scheduledTime > T1 + 120 分鐘（60行李+60行車 = 固定門檻）
 * 3. 排序：地理距離為主（從接機目的地行政區到送機上車行政區）、緩衝時間為次
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

  // 固定門檻：T1落地 + 120 分鐘（60行李+60行車）
  const earliestSend = addMinutes(landingTime, 120)

  // 觸發目的地（接機的終點，司機送客人的地點）
  const triggerCoords = getDistrictCoords(pickupOrder.dropoffLocation)

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

    // 固定門檻：scheduledTime > T1落地 + 120分鐘
    if (sendTime > earliestSend) {
      const bufferMs = sendTime.getTime() - arriveAtDest.getTime()
      const bufferMins = Math.round(bufferMs / (1000 * 60))
      const tightness = calcTightnessDropoff(arriveAtDest, sendTime)

      // 計算直線距離：接機目的地 → 送機上車地點
      let distanceKm = 999 // 預設大距離
      if (triggerCoords) {
        const pickupCoords = getDistrictCoords(order.pickupLocation)
        if (pickupCoords) {
          distanceKm = getDistance(
            triggerCoords.lat, triggerCoords.lng,
            pickupCoords.lat, pickupCoords.lng
          )
        }
      }

      const explanation = `落地 +${120}分，預計 ${formatHHMM(arriveAtDest)} 到達起點，緩衝 ${bufferMins} 分鐘`

      recommendations.push({
        order,
        arriveAtDest,
        sendTime,
        tightness,
        bufferMinutes: bufferMins,
        distanceKm,
        explanation,
      })
    }
  }

  // 排序：地理距離優先（近的排前面）
  recommendations.sort((a, b) => {
    if (Math.abs(a.distanceKm - b.distanceKm) > 1) {
      return a.distanceKm - b.distanceKm
    }
    // 距離差距 < 1km 時，以緩衝時間排序
    return a.bufferMinutes - b.bufferMinutes
  })

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
