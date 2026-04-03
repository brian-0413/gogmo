/**
 * 智慧排班系統 - 時間參數與計算函數
 *
 * 規格：
 * - 尖峰時段：06:30-09:30 / 16:00-19:00
 * - 行政區行車時間表：docs/雙北次生活圈通勤預估時間.pdf
 */

import type { Order } from '@/types'

// ─── 尖峰時段判斷 ─────────────────────────────────────────

/**
 * 判斷指定時間是否為尖峰時段
 * 早上尖峰：06:30 - 09:30
 * 下午尖峰：16:00 - 19:00
 */
export function isPeakHour(time: Date): boolean {
  const hour = time.getHours()
  const minute = time.getMinutes()
  const totalMinutes = hour * 60 + minute

  // 早上尖峰 06:30 - 09:30
  if (totalMinutes >= 6 * 60 + 30 && totalMinutes <= 9 * 60 + 30) return true
  // 下午尖峰 16:00 - 19:00
  if (totalMinutes >= 16 * 60 && totalMinutes <= 19 * 60) return true

  return false
}

// ─── 次生活圈定義 ─────────────────────────────────────────
// 參考：docs/雙北次生活圈劃分.pdf

type SubCircle =
  | 'slinbeitou' | 'neihunangang' | 'xinyisongshan' | 'daanzhongzheng'
  | 'wanhuazhongshan' | 'zhongheyonghe' | 'banqiaoxinzhuang' | 'sanzhongyanzhou'
  | 'xizxidian' | 'shulinyingtao' | 'danshuisanyuan'

const SUB_CIRCLE_OF: Record<string, SubCircle> = {
  // 士林北投
  '士林區': 'slinbeitou', '北投區': 'slinbeitou',
  // 內湖南港
  '內湖區': 'neihunangang', '南港區': 'neihunangang',
  // 信義松山
  '信義區': 'xinyisongshan', '松山區': 'xinyisongshan',
  // 大安中正
  '大安區': 'daanzhongzheng', '中正區': 'daanzhongzheng',
  // 萬華大同
  '萬華區': 'wanhuazhongshan', '大同區': 'wanhuazhongshan',
  // 板橋新莊
  '板橋區': 'banqiaoxinzhuang', '新莊區': 'banqiaoxinzhuang',
  // 三重蘆洲
  '三重區': 'sanzhongyanzhou', '蘆洲區': 'sanzhongyanzhou',
  // 汐止新店
  '汐止區': 'xizxidian', '新店區': 'xizxidian',
  '深坑區': 'xizxidian', '石碇區': 'xizxidian', '坪林區': 'xizxidian', '烏來區': 'xizxidian',
  // 樹林鶯桃
  '樹林區': 'shulinyingtao', '鶯歌區': 'shulinyingtao',
  '三峽區': 'shulinyingtao', // 歸入樹林鶯桃（地理相近）
  '土城區': 'banqiaoxinzhuang', // 歸入板橋新莊（地理相近）
  // 中和永和
  '中和區': 'zhongheyonghe', '永和區': 'zhongheyonghe',
  // 淡水三元（無 t4 數據，以板橋新莊估）
  '淡水區': 'danshuisanyuan', '三芝區': 'danshuisanyuan', '石門區': 'danshuisanyuan',
  // 泰山林口（無 t4 數據，以三重蘆洲估）
  '泰山區': 'sanzhongyanzhou', '林口區': 'sanzhongyanzhou',
  // 北海岸（無 t4 數據，以淡水三元估）
  '八里區': 'danshuisanyuan',
  '金山區': 'danshuisanyuan', '萬里區': 'danshuisanyuan',
  '平溪區': 'xizxidian', '雙溪區': 'xizxidian', '瑞芳區': 'xizxidian',
}

/**
 * 從行政區名稱取得次生活圈代碼
 */
export function getSubCircle(districtName: string): SubCircle {
  const d = districtName.includes('區') ? districtName : districtName + '區'
  return SUB_CIRCLE_OF[d] || 'banqiaoxinzhuang'
}

// ─── 次生活圈 t4 行車時間表 ───────────────────────────────
// 資料來源：docs/雙北次生活圈通勤預估時間.pdf
// 格式：{ 'src-dest': { peak, offPeak } }

interface SubCircleTimes {
  peak: number
  offPeak: number
}

const T4_TIMES: Record<string, SubCircleTimes> = {
  'slinbeitou-neihunangang':     { peak: 35, offPeak: 25 },
  'slinbeitou-xinyisongshan':    { peak: 30, offPeak: 20 },
  'slinbeitou-daanzhongzheng':    { peak: 35, offPeak: 25 },
  'slinbeitou-wanhuazhongshan':  { peak: 35, offPeak: 25 },
  'slinbeitou-zhongheyonghe':    { peak: 45, offPeak: 35 },
  'slinbeitou-banqiaoxinzhuang': { peak: 60, offPeak: 45 },
  'slinbeitou-sanzhongyanzhou':   { peak: 60, offPeak: 45 },
  'slinbeitou-xizxidian':        { peak: 50, offPeak: 40 },
  'slinbeitou-shulinyingtao':    { peak: 70, offPeak: 55 },
  'neihunangang-xinyisongshan':  { peak: 25, offPeak: 20 },
  'neihunangang-daanzhongzheng':  { peak: 30, offPeak: 25 },
  'neihunangang-wanhuazhongshan':{ peak: 40, offPeak: 30 },
  'neihunangang-zhongheyonghe':  { peak: 40, offPeak: 30 },
  'neihunangang-banqiaoxinzhuang':{ peak: 60, offPeak: 45 },
  'neihunangang-sanzhongyanzhou': { peak: 60, offPeak: 45 },
  'neihunangang-xizxidian':      { peak: 35, offPeak: 30 },
  'neihunangang-shulinyingtao':  { peak: 65, offPeak: 50 },
  'xinyisongshan-daanzhongzheng': { peak: 20, offPeak: 15 },
  'xinyisongshan-wanhuazhongshan':{ peak: 30, offPeak: 20 },
  'xinyisongshan-zhongheyonghe':  { peak: 30, offPeak: 20 },
  'xinyisongshan-banqiaoxinzhuang':{ peak: 50, offPeak: 40 },
  'xinyisongshan-sanzhongyanzhou':{ peak: 50, offPeak: 40 },
  'xinyisongshan-xizxidian':     { peak: 40, offPeak: 30 },
  'xinyisongshan-shulinyingtao':  { peak: 60, offPeak: 45 },
  'daanzhongzheng-wanhuazhongshan':{ peak: 25, offPeak: 15 },
  'daanzhongzheng-zhongheyonghe':  { peak: 25, offPeak: 20 },
  'daanzhongzheng-banqiaoxinzhuang':{ peak: 45, offPeak: 35 },
  'daanzhongzheng-sanzhongyanzhou':{ peak: 45, offPeak: 35 },
  'daanzhongzheng-xizxidian':    { peak: 35, offPeak: 30 },
  'daanzhongzheng-shulinyingtao': { peak: 55, offPeak: 40 },
  'wanhuazhongshan-zhongheyonghe':  { peak: 30, offPeak: 20 },
  'wanhuazhongshan-banqiaoxinzhuang':{ peak: 40, offPeak: 30 },
  'wanhuazhongshan-sanzhongyanzhou':{ peak: 40, offPeak: 30 },
  'wanhuazhongshan-xizxidian':    { peak: 40, offPeak: 30 },
  'wanhuazhongshan-shulinyingtao': { peak: 50, offPeak: 40 },
  'zhongheyonghe-banqiaoxinzhuang': { peak: 30, offPeak: 20 },
  'zhongheyonghe-sanzhongyanzhou': { peak: 30, offPeak: 20 },
  'zhongheyonghe-xizxidian':     { peak: 30, offPeak: 25 },
  'zhongheyonghe-shulinyingtao': { peak: 40, offPeak: 30 },
  'banqiaoxinzhuang-sanzhongyanzhou': { peak: 35, offPeak: 25 },
  'banqiaoxinzhuang-xizxidian':  { peak: 40, offPeak: 30 },
  'banqiaoxinzhuang-shulinyingtao':{ peak: 30, offPeak: 25 },
  'sanzhongyanzhou-xizxidian':   { peak: 45, offPeak: 35 },
  'sanzhongyanzhou-shulinyingtao':{ peak: 35, offPeak: 25 },
  'xizxidian-shulinyingtao':      { peak: 50, offPeak: 40 },
}

/**
 * 兩行政區之間的行車分鐘數（t4）
 * @param from 起始行政區
 * @param to 目的地行政區
 * @param departTime 出發時間（用來判斷尖峰/離峰）
 */
export function getInterDistrictTravelMinutes(
  from: string,
  to: string,
  departTime: Date
): number {
  const a = getSubCircle(from)
  const b = getSubCircle(to)
  if (a === b) return 15 // 同區域，預估 15 分鐘

  const times1 = T4_TIMES[`${a}-${b}`]
  const times2 = T4_TIMES[`${b}-${a}`]
  const times = times1 || times2
  if (!times) return 40 // 無數據時預設 40 分鐘

  return isPeakHour(departTime) ? times.peak : times.offPeak
}

// ─── 機場行車時間表 ────────────────────────────────────────

const AIRPORT_TRAVEL_TIMES: Record<string, SubCircleTimes> = {
  'taipei-TPE':  { peak: 75, offPeak: 50 },
  'TPE-taipei':  { peak: 75, offPeak: 50 },
  'taipei-TSA':  { peak: 50, offPeak: 30 },
  'TSA-taipei':  { peak: 50, offPeak: 30 },
}

/**
 * 根據出發時間的尖峰/離峰狀態，回傳行車分鐘數
 * 用於：雙北 ↔ 桃園/松山機場
 */
export function getTravelMinutes(from: string, to: string, departTime: Date): number {
  const key = `${from}-${to}`
  const times = AIRPORT_TRAVEL_TIMES[key]
  if (!times) return isPeakHour(departTime) ? 75 : 60
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
 * 情境二：接機後推薦送機單（司機目的地未知）
 *
 * 接機單執行時間鏈：
 * - t1 = 落地時間（scheduledTime）
 * - t2 = 客人出關緩衝（固定 60 分鐘）
 * - t3 = 機場 → 目的地行車時間（尖峰 75 分 / 離峰 60 分，根據 t1 判斷）
 * - t4 = 目的地行政區 → 送機上車行政區行車時間（查表）
 *
 * 篩選原則：
 * - 原則一（時間）：t1 + t2 + t3 + t4 之後才可出發 → 但 t4 取決於候選單地點，
 *   所以先以 t1 + t2 + t3 為基準，過濾 t1 + 3 小時內的所有送機單
 * - 原則二（地理）：地理距離（接機目的地 → 送機上車地點）最近的優先
 * - 原則三（種類）：只推薦送機單
 * - 上限：取 3 張
 */
export function recommendDropoffAfterPickup(
  pickupOrder: Order,
  availableOrders: Order[]
): DropoffRecommendation[] {
  const t1 = new Date(pickupOrder.scheduledTime)
  const airport = detectAirport(pickupOrder.pickupLocation) || 'TPE'

  // t2：客人出關緩衝（固定 60 分鐘）
  const T2 = 60

  // t3：機場 → 目的地行車時間（根據落地時間 t1 的尖峰/離峰）
  const t3Travel = getTravelMinutes(airport, 'taipei', t1)

  // 到達目的地時間（司機送完客人的時間）
  const arriveAtDest = addMinutes(addMinutes(t1, T2), t3Travel)

  // 篩選範圍：落地時間 t1 起，3 小時內的所有送機單
  const maxSendTime = addMinutes(t1, 3 * 60)

  // 觸發目的地座標（用於 Haversine 地理距離計算）
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

    // 原則一：送機單時間必須在 3 小時內（t1 + 3小時）
    if (sendTime > maxSendTime) continue

    // 原則一（動態 t4）：計算這張候選單的 t4，並驗證是否來得及
    const orderT4 = getInterDistrictTravelMinutes(
      pickupOrder.dropoffLocation,
      order.pickupLocation,
      arriveAtDest
    )
    const orderEarliestSend = addMinutes(arriveAtDest, orderT4)

    // 候選單的 scheduledTime 必須 > 司機實際可出發時間（t1+t2+t3+t4）
    if (sendTime < orderEarliestSend) continue

    // 計算緩衝時間
    const bufferMs = sendTime.getTime() - arriveAtDest.getTime()
    const bufferMins = Math.round(bufferMs / (1000 * 60))
    const tightness = calcTightnessDropoff(arriveAtDest, sendTime)

    // 原則二：地理距離（接機目的地 → 送機上車行政區）
    let distanceKm = 999
    if (triggerCoords) {
      const pickupCoords = getDistrictCoords(order.pickupLocation)
      if (pickupCoords) {
        distanceKm = getDistance(
          triggerCoords.lat, triggerCoords.lng,
          pickupCoords.lat, pickupCoords.lng
        )
      }
    }

    // 解說文字
    const explanation =
      `落地 ${formatHHMM(t1)} + ${T2}分(出關) + ${t3Travel}分(行車) + ${orderT4}分(行政區) ` +
      `= ${formatHHMM(orderEarliestSend)} 後可出發，` +
      `預計 ${formatHHMM(arriveAtDest)} 到達「${pickupOrder.dropoffLocation}」，緩衝 ${bufferMins} 分鐘`

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

  // 原則二：地理距離優先排序，取最近的 3 張
  recommendations.sort((a, b) => {
    if (Math.abs(a.distanceKm - b.distanceKm) > 1) {
      return a.distanceKm - b.distanceKm
    }
    return a.bufferMinutes - b.bufferMinutes
  })

  return recommendations.slice(0, 3)
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
