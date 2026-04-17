/**
 * 智慧排班系統 v3 — 時間參數與計算函數
 *
 * 規格：docs/smart-scheduling-v3.md
 *
 * 支援：
 * - 雙北 13 個次生活圈（TPE-01 ~ TPE-13）
 * - 四個機場：桃園（TPE）、松山（TSA）、小港（KHH）、清泉崗（RMQ）
 * - 全台長途縣市
 * - 尖峰倍率（分四級）
 */

// ─── Types ──────────────────────────────────────────────────────────────

import type { Order } from '@/types'
import type { VehicleType } from '@/types'

/** 司機車型 → 可承接的訂單車型 */
export type VehicleCompatibility = {
  driverType: VehicleType
  orderType: VehicleType
}

export type TightnessDropoffToPickup = 'perfect' | 'ok' | 'tight'
export type TightnessPickupToDropoff = 'comfortable' | 'reasonable' | 'tight'

export interface TightnessInfo {
  level: TightnessDropoffToPickup | TightnessPickupToDropoff
  label: string
  colorClass: string
  bgClass: string
}

export interface Recommendation {
  order: Order
  waitMinutes?: number
  bufferMinutes?: number
  emptyDriveMinutes?: number
  tightness: TightnessInfo
  explanation: string
}

export interface SmartScheduleResult {
  driverStatus: {
    dailyOrderCount: number
    dailyOrderLimit: number
    canAcceptMore: boolean
  }
  currentOrder: Order | null
  arriveTime: Date | null
  mainRecommendations: Recommendation[]
  standbyRecommendations: Recommendation[]
  nextRecommendations: Recommendation[]
}

// ─── 13 個次生活圈 ────────────────────────────────────────────────────

export type SubregionCode =
  | 'TPE-01' | 'TPE-02' | 'TPE-03' | 'TPE-04' | 'TPE-05'
  | 'TPE-06' | 'TPE-07' | 'TPE-08' | 'TPE-09' | 'TPE-10'
  | 'TPE-11' | 'TPE-12' | 'TPE-13'

export const SUBREGION_LIST: SubregionCode[] = [
  'TPE-01', 'TPE-02', 'TPE-03', 'TPE-04', 'TPE-05',
  'TPE-06', 'TPE-07', 'TPE-08', 'TPE-09', 'TPE-10',
  'TPE-11', 'TPE-12', 'TPE-13',
]

/** 行政區 → 次生活圈代碼 */
const DISTRICT_TO_SUBREGION: Record<string, SubregionCode> = {
  // TPE-01 台北市：中正、大同、中山、松山、信義
  '中正區': 'TPE-01', '大同區': 'TPE-01', '中山區': 'TPE-01', '松山區': 'TPE-01', '信義區': 'TPE-01',
  // TPE-02 內湖汐止
  '內湖區': 'TPE-02', '汐止區': 'TPE-02',
  // TPE-03 南港港湖
  '南港區': 'TPE-03',
  // TPE-04 北投士林
  '北投區': 'TPE-04', '士林區': 'TPE-04',
  // TPE-05 大安文山
  '大安區': 'TPE-05', '萬華區': 'TPE-05', '文山區': 'TPE-05',
  // TPE-06 板橋土城
  '板橋區': 'TPE-06', '土城區': 'TPE-06', '樹林區': 'TPE-06',
  // TPE-07 永和中和
  '中和區': 'TPE-07', '永和區': 'TPE-07',
  // TPE-08 三重蘆洲
  '三重區': 'TPE-08', '蘆洲區': 'TPE-08', '五股區': 'TPE-08',
  // TPE-09 新莊泰山
  '新莊區': 'TPE-09', '泰山區': 'TPE-09',
  // TPE-10 新店
  '新店區': 'TPE-10', '深坑區': 'TPE-10', '石碇區': 'TPE-10', '坪林區': 'TPE-10', '烏來區': 'TPE-10',
  // TPE-11 淡水
  '淡水區': 'TPE-11', '八里區': 'TPE-11', '三芝區': 'TPE-11', '石門區': 'TPE-11',
  // TPE-12 林口
  '林口區': 'TPE-12',
  // TPE-13 三峽鶯歌
  '三峽區': 'TPE-13', '鶯歌區': 'TPE-13',
}

// ─── 次生活圈相鄰關係 ────────────────────────────────────────────────

const ADJACENT_REGIONS: Record<SubregionCode, SubregionCode[]> = {
  'TPE-01': ['TPE-02', 'TPE-03', 'TPE-04', 'TPE-05', 'TPE-08'],
  'TPE-02': ['TPE-01', 'TPE-03'],
  'TPE-03': ['TPE-01', 'TPE-02', 'TPE-05'],
  'TPE-04': ['TPE-01', 'TPE-08', 'TPE-11'],
  'TPE-05': ['TPE-01', 'TPE-03', 'TPE-07', 'TPE-10'],
  'TPE-06': ['TPE-07', 'TPE-09', 'TPE-13'],
  'TPE-07': ['TPE-01', 'TPE-05', 'TPE-06', 'TPE-08'],
  'TPE-08': ['TPE-01', 'TPE-04', 'TPE-07', 'TPE-09'],
  'TPE-09': ['TPE-06', 'TPE-08', 'TPE-12'],
  'TPE-10': ['TPE-05', 'TPE-07'],
  'TPE-11': ['TPE-04'],
  'TPE-12': ['TPE-09'],
  'TPE-13': ['TPE-06'],
}

// ─── 雙北次生活圈 13×13 行車時間表（離峰，分鐘）─────────────────────

// 來源：運研所《都會旅運調查之路線特性分析》+ gogmo 業務經驗補充
// 格式：SUBREGION_TIMES[from][to] = offPeakMinutes
const SUBREGION_TIMES: Record<SubregionCode, Record<SubregionCode, number>> = {
  'TPE-01': {
    'TPE-01': 15, 'TPE-02': 20, 'TPE-03': 20, 'TPE-04': 25, 'TPE-05': 15,
    'TPE-06': 25, 'TPE-07': 20, 'TPE-08': 20, 'TPE-09': 25, 'TPE-10': 25,
    'TPE-11': 35, 'TPE-12': 35, 'TPE-13': 40,
  },
  'TPE-02': {
    'TPE-01': 20, 'TPE-02': 15, 'TPE-03': 15, 'TPE-04': 25, 'TPE-05': 25,
    'TPE-06': 35, 'TPE-07': 30, 'TPE-08': 25, 'TPE-09': 30, 'TPE-10': 35,
    'TPE-11': 45, 'TPE-12': 40, 'TPE-13': 50,
  },
  'TPE-03': {
    'TPE-01': 20, 'TPE-02': 15, 'TPE-03': 15, 'TPE-04': 30, 'TPE-05': 25,
    'TPE-06': 35, 'TPE-07': 35, 'TPE-08': 30, 'TPE-09': 35, 'TPE-10': 35,
    'TPE-11': 45, 'TPE-12': 45, 'TPE-13': 50,
  },
  'TPE-04': {
    'TPE-01': 25, 'TPE-02': 25, 'TPE-03': 30, 'TPE-04': 15, 'TPE-05': 30,
    'TPE-06': 35, 'TPE-07': 30, 'TPE-08': 25, 'TPE-09': 35, 'TPE-10': 40,
    'TPE-11': 40, 'TPE-12': 40, 'TPE-13': 55,
  },
  'TPE-05': {
    'TPE-01': 15, 'TPE-02': 25, 'TPE-03': 25, 'TPE-04': 30, 'TPE-05': 15,
    'TPE-06': 30, 'TPE-07': 25, 'TPE-08': 25, 'TPE-09': 30, 'TPE-10': 20,
    'TPE-11': 40, 'TPE-12': 40, 'TPE-13': 40,
  },
  'TPE-06': {
    'TPE-01': 25, 'TPE-02': 35, 'TPE-03': 35, 'TPE-04': 35, 'TPE-05': 30,
    'TPE-06': 15, 'TPE-07': 20, 'TPE-08': 20, 'TPE-09': 25, 'TPE-10': 35,
    'TPE-11': 45, 'TPE-12': 30, 'TPE-13': 25,
  },
  'TPE-07': {
    'TPE-01': 20, 'TPE-02': 30, 'TPE-03': 35, 'TPE-04': 30, 'TPE-05': 25,
    'TPE-06': 20, 'TPE-07': 15, 'TPE-08': 20, 'TPE-09': 25, 'TPE-10': 30,
    'TPE-11': 40, 'TPE-12': 35, 'TPE-13': 35,
  },
  'TPE-08': {
    'TPE-01': 20, 'TPE-02': 25, 'TPE-03': 30, 'TPE-04': 25, 'TPE-05': 25,
    'TPE-06': 20, 'TPE-07': 20, 'TPE-08': 15, 'TPE-09': 20, 'TPE-10': 30,
    'TPE-11': 35, 'TPE-12': 25, 'TPE-13': 30,
  },
  'TPE-09': {
    'TPE-01': 25, 'TPE-02': 30, 'TPE-03': 35, 'TPE-04': 35, 'TPE-05': 30,
    'TPE-06': 25, 'TPE-07': 25, 'TPE-08': 20, 'TPE-09': 15, 'TPE-10': 35,
    'TPE-11': 40, 'TPE-12': 20, 'TPE-13': 30,
  },
  'TPE-10': {
    'TPE-01': 25, 'TPE-02': 35, 'TPE-03': 35, 'TPE-04': 40, 'TPE-05': 20,
    'TPE-06': 35, 'TPE-07': 30, 'TPE-08': 30, 'TPE-09': 35, 'TPE-10': 15,
    'TPE-11': 50, 'TPE-12': 45, 'TPE-13': 40,
  },
  'TPE-11': {
    'TPE-01': 35, 'TPE-02': 45, 'TPE-03': 45, 'TPE-04': 40, 'TPE-05': 40,
    'TPE-06': 45, 'TPE-07': 40, 'TPE-08': 35, 'TPE-09': 40, 'TPE-10': 50,
    'TPE-11': 15, 'TPE-12': 40, 'TPE-13': 55,
  },
  'TPE-12': {
    'TPE-01': 35, 'TPE-02': 40, 'TPE-03': 45, 'TPE-04': 40, 'TPE-05': 40,
    'TPE-06': 30, 'TPE-07': 35, 'TPE-08': 25, 'TPE-09': 20, 'TPE-10': 45,
    'TPE-11': 40, 'TPE-12': 15, 'TPE-13': 30,
  },
  'TPE-13': {
    'TPE-01': 40, 'TPE-02': 50, 'TPE-03': 50, 'TPE-04': 55, 'TPE-05': 40,
    'TPE-06': 25, 'TPE-07': 35, 'TPE-08': 30, 'TPE-09': 30, 'TPE-10': 40,
    'TPE-11': 55, 'TPE-12': 30, 'TPE-13': 15,
  },
}

// ─── 雙北各區 → 機場行車時間（離峰，分鐘）─────────────────────────

// TPE = 桃園機場, TSA = 松山機場
const SUBREGION_TO_AIRPORT: Record<SubregionCode, Record<string, number>> = {
  'TPE-01': { TPE: 50, TSA: 15 },
  'TPE-02': { TPE: 55, TSA: 15 },
  'TPE-03': { TPE: 55, TSA: 20 },
  'TPE-04': { TPE: 55, TSA: 25 },
  'TPE-05': { TPE: 50, TSA: 20 },
  'TPE-06': { TPE: 40, TSA: 30 },
  'TPE-07': { TPE: 45, TSA: 25 },
  'TPE-08': { TPE: 40, TSA: 25 },
  'TPE-09': { TPE: 35, TSA: 30 },
  'TPE-10': { TPE: 50, TSA: 30 },
  'TPE-11': { TPE: 60, TSA: 35 },
  'TPE-12': { TPE: 20, TSA: 35 },
  'TPE-13': { TPE: 30, TSA: 45 },
}

// ─── 全台長途縣市 → 桃園機場（不分尖峰倍率）──────────────────────

const CITY_TO_TPE: Record<string, number> = {
  '基隆': 90, 'Keelung': 90,
  '桃園': 30, 'Taoyuan': 30,
  '新竹': 80, 'Hsinchu': 80,
  '苗栗': 110, 'Miaoli': 110,
  '台中': 150, 'Taichung': 150,
  '彰化': 180, 'Changhua': 180,
  '雲林': 210, 'Yunlin': 210,
  '嘉義': 240, 'Chiayi': 240,
  '台南': 270, 'Tainan': 270,
  '高雄': 300, 'Kaohsiung': 300,
  '屏東': 330, 'Pingtung': 330,
  '宜蘭': 120, 'Yilan': 120,
  '花蓮': 240, 'Hualien': 240,
  '台東': 420, 'Taitung': 420,
}

// ─── 機場識別 ──────────────────────────────────────────────────────

/** 從地點字串識別機場代碼 */
export function detectAirport(location: string): string | null {
  const loc = location.toUpperCase()
  if (loc.includes('TPE') || loc.includes('桃園')) return 'TPE'
  if (loc.includes('TSA') || loc.includes('松山')) return 'TSA'
  if (loc.includes('KHH') || loc.includes('小港')) return 'KHH'
  if (loc.includes('RMQ') || loc.includes('清泉') || loc.includes('台中')) return 'RMQ'
  return null
}

// ─── 次生活圈推斷 ─────────────────────────────────────────────────

/** 從行政區名稱推斷次生活圈代碼（適用於雙北） */
export function inferSubregion(location: string): SubregionCode | 'OTHER' {
  // 先嘗試精確比對「XX區」
  for (const [district, subregion] of Object.entries(DISTRICT_TO_SUBREGION)) {
    if (location.includes(district) || district.includes(location.replace(/區$/, ''))) {
      return subregion
    }
  }
  // 特殊關鍵字匹配（沒有「區」字的情況）
  const lower = location.toLowerCase()
  if (lower.includes('台北') || lower.includes('台北市') || lower.includes('taipei')) return 'TPE-01'
  if (lower.includes('新北') || lower.includes('新北市')) {
    // 新北市預設回 TP-06（板橋）當作中點
    return 'TPE-06'
  }
  if (lower.includes('板橋') || lower.includes('土城') || lower.includes('樹林')) return 'TPE-06'
  if (lower.includes('中和') || lower.includes('永和')) return 'TPE-07'
  if (lower.includes('三重') || lower.includes('蘆洲') || lower.includes('五股')) return 'TPE-08'
  if (lower.includes('新莊') || lower.includes('泰山')) return 'TPE-09'
  if (lower.includes('新店') || lower.includes('深坑')) return 'TPE-10'
  if (lower.includes('淡水') || lower.includes('八里')) return 'TPE-11'
  if (lower.includes('林口')) return 'TPE-12'
  if (lower.includes('三峽') || lower.includes('鶯歌')) return 'TPE-13'
  if (lower.includes('內湖') || lower.includes('汐止')) return 'TPE-02'
  if (lower.includes('南港')) return 'TPE-03'
  if (lower.includes('北投') || lower.includes('士林')) return 'TPE-04'
  if (lower.includes('大安') || lower.includes('萬華') || lower.includes('文山')) return 'TPE-05'
  if (lower.includes('中正') || lower.includes('大同') || lower.includes('中山') || lower.includes('松山') || lower.includes('信義')) return 'TPE-01'
  // 長途縣市
  for (const city of Object.keys(CITY_TO_TPE)) {
    if (location.includes(city)) return 'OTHER'
  }
  return 'OTHER'
}

// ─── 尖峰時段 ──────────────────────────────────────────────────────

/**
 * 判斷是否為尖峰時段
 * 早上尖峰：06:30 - 09:00
 * 下午尖峰：16:00 - 19:00
 */
export function isPeakHour(time: Date): boolean {
  const totalMinutes = time.getHours() * 60 + time.getMinutes()
  if (totalMinutes >= 390 && totalMinutes < 540) return true  // 06:30-09:00
  if (totalMinutes >= 960 && totalMinutes <= 1140) return true  // 16:00-19:00
  return false
}

// ─── 尖峰倍率 ────────────────────────────────────────────────────

/**
 * 根據離峰時間回傳尖峰倍率
 * ≤15 分鐘（同區）→ ×1.3
 * 16-25 分鐘（鄰近）→ ×1.5
 * 26-35 分鐘（中距離）→ ×1.6
 * ≥36 分鐘（跨區）→ ×1.7
 */
export function getPeakMultiplier(offPeakMinutes: number): number {
  if (offPeakMinutes <= 15) return 1.3
  if (offPeakMinutes <= 25) return 1.5
  if (offPeakMinutes <= 35) return 1.6
  return 1.7
}

/** 套用尖峰倍率（非尖峰時段回傳原值） */
export function applyPeakMultiplier(offPeakMinutes: number, isPeak: boolean): number {
  if (!isPeak) return offPeakMinutes
  return Math.round(offPeakMinutes * getPeakMultiplier(offPeakMinutes))
}

// ─── 行車時間查詢 ────────────────────────────────────────────────

/**
 * 查詢兩地點之間的行車時間（分鐘）
 * 支援：次生活圈↔次生活圈、次生活圈↔機場、長途縣市↔桃園
 * 雙北內部與雙北↔機場套用尖峰倍率，長途不套用
 */
export function getTravelMinutes(
  from: string,
  to: string,
  departTime: Date
): number {
  const isPeak = isPeakHour(departTime)

  // 推斷 from / to 的次生活圈
  const fromRegion = inferSubregion(from)
  const toRegion = inferSubregion(to)

  // 機場識別
  const toAirport = detectAirport(to)
  const fromAirport = detectAirport(from)

  // 機場代碼正規化（from/to 都可能是機場）
  const isAirport = (code: string | null) => code !== null
  const airportCode = (code: string | null) => code

  // 雙北次生活圈 ↔ 機場
  if (fromRegion !== 'OTHER' && isAirport(toAirport)) {
    const offPeak = SUBREGION_TO_AIRPORT[fromRegion]?.[toAirport ?? ''] ?? 60
    return applyPeakMultiplier(offPeak, isPeak)
  }
  if (isAirport(fromAirport) && toRegion !== 'OTHER') {
    const offPeak = SUBREGION_TO_AIRPORT[toRegion]?.[fromAirport ?? ''] ?? 60
    return applyPeakMultiplier(offPeak, isPeak)
  }

  // 雙北次生活圈內部
  if (fromRegion !== 'OTHER' && toRegion !== 'OTHER') {
    const offPeak = SUBREGION_TIMES[fromRegion]?.[toRegion] ??
                     SUBREGION_TIMES[toRegion]?.[fromRegion] ??
                     40
    return applyPeakMultiplier(offPeak, isPeak)
  }

  // 雙北 ↔ 機場（粗略 fallback）
  if (fromRegion !== 'OTHER' && !isAirport(toAirport) && !isAirport(fromAirport)) {
    // 雙北到非機場用預設 40 分鐘
    return applyPeakMultiplier(40, isPeak)
  }

  // 長途縣市 → 桃園（不套倍率）
  if (fromRegion === 'OTHER' && toAirport === 'TPE') {
    const city = Object.keys(CITY_TO_TPE).find(c => from.includes(c))
    return CITY_TO_TPE[city ?? ''] ?? 180
  }

  // 桃園 → 長途縣市（不套倍率，用相同時間）
  if (fromAirport === 'TPE' && toRegion === 'OTHER') {
    const city = Object.keys(CITY_TO_TPE).find(c => to.includes(c))
    return CITY_TO_TPE[city ?? ''] ?? 180
  }

  // 預設值
  return applyPeakMultiplier(60, isPeak)
}

// ─── 緩衝時間 ────────────────────────────────────────────────────

/**
 * 計算接機→送機的緩衝時間
 * 同次生活圈 → 60 分鐘 × 尖峰倍率
 * 相鄰次生活圈 → 75 分鐘 × 尖峰倍率
 * 跨區（非相鄰）→ 90 分鐘 × 尖峰倍率
 */
export function getBufferMinutes(
  regionA: string,
  regionB: string,
  time: Date
): number {
  const regA = inferSubregion(regionA)
  const regB = inferSubregion(regionB)
  const isPeak = isPeakHour(time)

  let baseBuffer: number

  if (regA === 'OTHER' || regB === 'OTHER') {
    // 至少有一方不在雙北次生活圈，保守估 90 分鐘
    baseBuffer = 90
  } else if (regA === regB) {
    baseBuffer = 60
  } else if (isAdjacentRegion(regA, regB)) {
    baseBuffer = 75
  } else {
    baseBuffer = 90
  }

  return applyPeakMultiplier(baseBuffer, isPeak)
}

/** 兩區是否相鄰 */
export function isAdjacentRegion(
  a: SubregionCode,
  b: SubregionCode
): boolean {
  return ADJACENT_REGIONS[a]?.includes(b) ?? false
}

// ─── 車型相容 ────────────────────────────────────────────────────

/**
 * 判斷司機車型是否可承接該訂單
 * 大車可接小車的單，小車不能接大車的單
 */
export function isVehicleCompatible(
  driverType: VehicleType,
  orderType: VehicleType
): boolean {
  // pending 和 any 都可以
  if (orderType === 'pending' || orderType === 'any' || orderType === 'any_r') return true
  if (driverType === 'pending' || driverType === 'any' || driverType === 'any_r') return true

  if (driverType === 'small') return orderType === 'small'
  if (driverType === 'suv') return orderType === 'small' || orderType === 'suv'
  if (driverType === 'van9') return true  // 9人座可接所有

  return false
}

// ─── 銜接緊密度 ────────────────────────────────────────────────

export const TIGHTNESS_DROPOFF_PICKUP: Record<TightnessDropoffToPickup, TightnessInfo> = {
  perfect: { level: 'perfect', label: '幾乎無縫', colorClass: 'text-green-700', bgClass: 'bg-green-50' },
  ok:       { level: 'ok',       label: '需等候', colorClass: 'text-blue-700', bgClass: 'bg-blue-50' },
  tight:    { level: 'tight',    label: '時間較趕', colorClass: 'text-red-700', bgClass: 'bg-red-50' },
}

export const TIGHTNESS_PICKUP_DROPOFF: Record<TightnessPickupToDropoff, TightnessInfo> = {
  comfortable: { level: 'comfortable', label: '時間充裕', colorClass: 'text-green-700', bgClass: 'bg-green-50' },
  reasonable:   { level: 'reasonable',   label: '時間合理', colorClass: 'text-blue-700', bgClass: 'bg-blue-50' },
  tight:        { level: 'tight',         label: '時間較趕', colorClass: 'text-red-700', bgClass: 'bg-red-50' },
}

/**
 * 情境一（送機→接機）：計算銜接緊密度
 * arriveAtAirport：司機預計到達機場時間
 * landingTime：航班落地時間
 *
 * 標籤：
 * - 幾乎無縫：司機到機場時，客人預計 0-30 分鐘內出關
 * - 需等候：司機需等 30-60 分鐘
 * - 時間較趕：客人可能比司機早出關
 */
export function calculateDropoffToPickupTightness(
  arriveAtAirport: Date,
  landingTime: Date
): TightnessInfo {
  const diffMinutes = (arriveAtAirport.getTime() - landingTime.getTime()) / (1000 * 60)
  // diff > 0：司機比落地晚（需要等客人）；diff < 0：司機比落地早（客人要等司機）

  if (diffMinutes >= -30 && diffMinutes <= 30) {
    return TIGHTNESS_DROPOFF_PICKUP.perfect  // 幾乎無縫
  } else if (diffMinutes > 30 && diffMinutes <= 60) {
    return TIGHTNESS_DROPOFF_PICKUP.ok  // 需等候
  } else {
    return TIGHTNESS_DROPOFF_PICKUP.tight  // 時間較趕或客人比司機早
  }
}

/**
 * 情境二（接機→送機）：計算銜接緊密度
 * bufferMinutes：司機抵達送機上車點後到客人上車的緩衝時間
 *
 * 標籤：
 * - 時間充裕：緩衝 ≥ 90 分鐘
 * - 時間合理：緩衝 60-90 分鐘
 * - 時間較趕：緩衝 < 60 分鐘
 */
export function calculatePickupToDropoffTightness(
  bufferMinutes: number
): TightnessInfo {
  if (bufferMinutes >= 90) {
    return TIGHTNESS_PICKUP_DROPOFF.comfortable
  } else if (bufferMinutes >= 60) {
    return TIGHTNESS_PICKUP_DROPOFF.reasonable
  } else {
    return TIGHTNESS_PICKUP_DROPOFF.tight
  }
}

// ─── 工具函數 ────────────────────────────────────────────────────

/** 時間加分鐘 */
export function addMinutes(time: Date, minutes: number): Date {
  return new Date(time.getTime() + minutes * 60 * 1000)
}

/** 兩時間差（分鐘） */
export function diffMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60))
}

/** 格式化 HH:MM */
export function formatHHMM(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// ─── 情境一：送機→接機推薦 ────────────────────────────────────────

/**
 * 情境一：司機有一張送機單，推薦可銜接的接機單
 *
 * 計算：司機到機場時間 T_arrive = T_depart + 行車時間
 * 推薦：落地時間 T_land ∈ [T_arrive - 30min, T_arrive + 15min]
 * 額外條件：同機場（含不同航廈）
 */
export function recommendPickupAfterDropoff(
  dropoffOrder: Order,
  availableOrders: Order[]
): Recommendation[] {
  const departTime = new Date(dropoffOrder.scheduledTime)
  const dropoffLocation = dropoffOrder.pickupLocation  // 送機：from
  const toAirport = detectAirport(dropoffOrder.dropoffLocation) ?? 'TPE'

  // 司機到機場時間
  const travelMin = getTravelMinutes(dropoffLocation, toAirport, departTime)
  const arriveAtAirport = addMinutes(departTime, travelMin)

  // 推薦範圍：落地時間在 arriveAtAirport-30 到 arriveAtAirport+15
  const minLanding = addMinutes(arriveAtAirport, -30)
  const maxLanding = addMinutes(arriveAtAirport, 15)

  const recs: Recommendation[] = []

  for (const order of availableOrders) {
    // 只考慮接機單、且是 PUBLISHED
    if (order.type !== 'pickup' && order.type !== 'pickup_boat') continue
    if (order.status !== 'PUBLISHED') continue

    const orderAirport = detectAirport(order.pickupLocation)
    // 同機場（含 T1↔T2 可接駁）
    if (orderAirport !== toAirport) continue

    const landingTime = new Date(order.scheduledTime)
    if (landingTime < minLanding || landingTime > maxLanding) continue

    // 車型相容
    if (!isVehicleCompatible(dropoffOrder.vehicle, order.vehicle)) continue

    // 銜接緊密度
    const tightness = calculateDropoffToPickupTightness(arriveAtAirport, landingTime)

    // 等候分鐘（落地到司機到機場，負數表示司機要等，正數表示客人要等）
    const waitMins = diffMinutes(landingTime, arriveAtAirport)
    // 客人出關時間估算
    const exitMin = addMinutes(landingTime, 30)
    const exitMax = addMinutes(landingTime, 60)

    let explanation: string
    if (waitMins < 0) {
      explanation = `你 ${formatHHMM(arriveAtAirport)} 到，客人約 ${formatHHMM(exitMin)}-${formatHHMM(exitMax)} 出關，需等候 ${Math.abs(waitMins)} 分鐘`
    } else {
      explanation = `你 ${formatHHMM(arriveAtAirport)} 到，客人預計 ${formatHHMM(exitMin)}-${formatHHMM(exitMax)} 出關（客人比你晚到 ${waitMins} 分鐘）`
    }

    recs.push({
      order,
      waitMinutes: waitMins,
      tightness,
      explanation,
    })
  }

  // 排序：等候時間最短的排前面
  recs.sort((a, b) => Math.abs(a.waitMinutes ?? 0) - Math.abs(b.waitMinutes ?? 0))
  return recs.slice(0, 5)
}

// ─── 情境二：接機→送機推薦 ────────────────────────────────────────

/**
 * 情境二：司機有一張接機單，推薦可銜接的送機單
 *
 * 計算：
 * - T_pickup = T_land + 45分（出關）
 * - 到達接機目的地 = T_pickup + 行車時間
 * - T_next = 到達目的地 + t2(跨區) + 緩衝時間
 * 推薦：送機出發時間 T_send ∈ [T_next, T_next + 60min]
 */
export function recommendDropoffAfterPickup(
  pickupOrder: Order,
  availableOrders: Order[]
): Recommendation[] {
  const landingTime = new Date(pickupOrder.scheduledTime)
  const fromAirport = detectAirport(pickupOrder.pickupLocation) ?? 'TPE'
  const pickupDest = pickupOrder.dropoffLocation

  // 客人出關時間（取 45 分鐘中間值）
  const tPickup = addMinutes(landingTime, 45)
  // 到達接機目的地時間
  const t1 = getTravelMinutes(fromAirport, pickupDest, tPickup)
  const arriveAtDest = addMinutes(tPickup, t1)

  const recs: Recommendation[] = []

  for (const order of availableOrders) {
    if (order.type !== 'dropoff' && order.type !== 'dropoff_boat') continue
    if (order.status !== 'PUBLISHED') continue

    // 目的地需是機場
    const destAirport = detectAirport(order.dropoffLocation)
    if (!destAirport) continue

    // 車型相容
    if (!isVehicleCompatible(pickupOrder.vehicle, order.vehicle)) continue

    const sendTime = new Date(order.scheduledTime)

    // t2：接機目的地 → 送機上車點
    const t2 = getTravelMinutes(pickupDest, order.pickupLocation, arriveAtDest)
    // 司機抵達送機上車點時間
    const driverArriveAtPickup = addMinutes(arriveAtDest, t2)
    // 送機出發時間需在司機抵達之後
    if (sendTime < driverArriveAtPickup) continue  // 來不及
    // 送機出發時間需在「抵達 + 行車時間 + 緩衝」之前（即必須在安全窗口內）
    const buffer = getBufferMinutes(pickupDest, order.pickupLocation, driverArriveAtPickup)
    if (sendTime > addMinutes(driverArriveAtPickup, t2 + buffer)) continue  // 超出安全窗口

    const bufferMins = diffMinutes(sendTime, driverArriveAtPickup)
    const tightness = calculatePickupToDropoffTightness(bufferMins)

    const explanation =
      `${formatHHMM(landingTime)} 落地 +45分出關 +${t1}分行車 +${t2}分跨區 ` +
      `= ${formatHHMM(driverArriveAtPickup)} 抵達「${order.pickupLocation}」，` +
      `緩衝 ${bufferMins} 分鐘`

    recs.push({
      order,
      bufferMinutes: bufferMins,
      tightness,
      explanation,
    })
  }

  // 排序：緩衝時間最短的排前面
  recs.sort((a, b) => (a.bufferMinutes ?? 0) - (b.bufferMinutes ?? 0))
  return recs.slice(0, 5)
}

// ─── 情境五：空車順路單推薦 ───────────────────────────────────────

/**
 * 情境五：司機完成一單後，下一單尚有一段空檔，
 * 但空檔期間有順路的單可以接
 *
 * 條件：
 * 1. 空車回程時間 ≤ 60 分鐘
 * 2. 司機抵達下一單上車點後，距離下一單出發時間 ≥ 30 分鐘緩衝
 * 3. 不與其他已排訂單衝突
 */
export function recommendEmptyDriveOrders(
  driver: { carType: VehicleType },
  currentOrder: Order,
  availableOrders: Order[]
): Recommendation[] {
  // 從 currentOrder 推斷司機當前位置
  const currentDest = currentOrder.type === 'dropoff' || currentOrder.type === 'dropoff_boat'
    ? currentOrder.dropoffLocation  // 送機完後在機場
    : currentOrder.dropoffLocation  // 接機完後在目的地

  const nextAirport = detectAirport(currentDest) ?? 'TPE'

  const recs: Recommendation[] = []

  for (const order of availableOrders) {
    if (order.status !== 'PUBLISHED') continue

    // 只推薦送機單（空車從機場回程接單）
    if (order.type !== 'dropoff' && order.type !== 'dropoff_boat') continue

    // 車型相容
    if (!isVehicleCompatible(driver.carType, order.vehicle)) continue

    // 空車回程時間
    const emptyDriveMin = getTravelMinutes(currentDest, order.pickupLocation, new Date())
    if (emptyDriveMin > 60) continue  // 超過 60 分鐘不推薦

    // 司機抵達送機上車點的時間
    const driverArrive = addMinutes(new Date(), emptyDriveMin)
    // 與下一單的緩衝
    const sendTime = new Date(order.scheduledTime)
    const buffer = diffMinutes(sendTime, driverArrive)
    if (buffer < 30) continue  // 緩衝不足 30 分鐘

    const explanation =
      `空車回程約 ${emptyDriveMin} 分鐘，` +
      `預計 ${formatHHMM(driverArrive)} 抵達「${order.pickupLocation}」，` +
      `距離 ${formatHHMM(sendTime)} 出發緩衝 ${buffer} 分鐘`

    recs.push({
      order,
      emptyDriveMinutes: emptyDriveMin,
      bufferMinutes: buffer,
      tightness: calculatePickupToDropoffTightness(buffer),
      explanation,
    })
  }

  // 排序：空車時間最短的排前面
  recs.sort((a, b) => (a.emptyDriveMinutes ?? 0) - (b.emptyDriveMinutes ?? 0))
  return recs.slice(0, 3)
}

// ─── 情境零：無已接單推薦 ─────────────────────────────────────────

/**
 * 情境零：司機目前無已接訂單
 * 直接從接單大廳中列出未來 3 小時內可執行的單，按時間排序
 * @param now 基準時間（預設 new Date()，供測試控制）
 */
export function recommendForEmptyDriver(
  availableOrders: Order[],
  now?: Date
): Recommendation[] {
  const refTime = now ?? new Date()
  const threeHoursLater = addMinutes(refTime, 180)

  const recs: Recommendation[] = []

  for (const order of availableOrders) {
    if (order.status !== 'PUBLISHED') continue

    const orderTime = new Date(order.scheduledTime)
    if (orderTime < refTime || orderTime > threeHoursLater) continue

    const airport = detectAirport(order.pickupLocation) ?? detectAirport(order.dropoffLocation)
    const airportLabel = airport ? `@${airport}` : ''

    recs.push({
      order,
      tightness: { level: 'reasonable', label: '可接', colorClass: 'text-gray-600', bgClass: 'bg-gray-50' },
      explanation: `${airportLabel} ${formatHHMM(orderTime)} 出發，${order.pickupLocation} → ${order.dropoffLocation}，$${order.price.toLocaleString()}`,
    })
  }

  // 按時間排序（最近的在前）
  recs.sort((a, b) =>
    new Date(a.order.scheduledTime).getTime() - new Date(b.order.scheduledTime).getTime()
  )

  return recs.slice(0, 10)
}

// ─── 主推薦函數 ─────────────────────────────────────────────────

export interface ScheduleContext {
  driver: {
    id: string
    carType: VehicleType
    acceptedOrderCount: number
    dailyOrderLimit?: number
  }
  acceptedOrders: Order[]
  availableOrders: Order[]
  startOrderId?: string
}

/**
 * 智慧排班主推薦函數
 * 根據司機狀態自動選擇情境
 */
export function getSmartScheduleRecommendations(
  ctx: ScheduleContext
): SmartScheduleResult {
  const { driver, acceptedOrders, availableOrders, startOrderId } = ctx
  const limit = driver.dailyOrderLimit ?? 6

  // 每日上限檢查
  if (driver.acceptedOrderCount >= limit) {
    return {
      driverStatus: {
        dailyOrderCount: driver.acceptedOrderCount,
        dailyOrderLimit: limit,
        canAcceptMore: false,
      },
      currentOrder: null,
      arriveTime: null,
      mainRecommendations: [],
      standbyRecommendations: [],
      nextRecommendations: [],
    }
  }

  // 情境零：無已接單
  if (acceptedOrders.length === 0) {
    const recs = recommendForEmptyDriver(availableOrders)
    return {
      driverStatus: {
        dailyOrderCount: 0,
        dailyOrderLimit: limit,
        canAcceptMore: true,
      },
      currentOrder: null,
      arriveTime: null,
      mainRecommendations: recs,
      standbyRecommendations: [],
      nextRecommendations: [],
    }
  }

  // 取最近的一張已接單作為起點
  const activeOrders = acceptedOrders.filter(
    o => !['COMPLETED', 'CANCELLED'].includes(o.status)
  )
  if (activeOrders.length === 0) {
    return {
      driverStatus: { dailyOrderCount: acceptedOrders.length, dailyOrderLimit: limit, canAcceptMore: true },
      currentOrder: null,
      arriveTime: null,
      mainRecommendations: recommendForEmptyDriver(availableOrders),
      standbyRecommendations: [],
      nextRecommendations: [],
    }
  }

  const sorted = [...activeOrders].sort(
    (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
  )
  // 如果有指定 startOrderId，用那一張；否則用最近的一張
  const startOrder = startOrderId
    ? sorted.find(o => o.id === startOrderId) ?? sorted[sorted.length - 1]
    : sorted[sorted.length - 1]

  const isPickup = startOrder.type === 'pickup' || startOrder.type === 'pickup_boat'

  let arriveTime: Date | null = null
  let mainRecs: Recommendation[] = []
  let nextRecs: Recommendation[] = []

  if (isPickup) {
    // 情境二：接機→送機
    const fromAirport = detectAirport(startOrder.pickupLocation) ?? 'TPE'
    const landingTime = new Date(startOrder.scheduledTime)
    const tPickup = addMinutes(landingTime, 45)
    const t1 = getTravelMinutes(fromAirport, startOrder.dropoffLocation, tPickup)
    arriveTime = addMinutes(tPickup, t1)
    mainRecs = recommendDropoffAfterPickup(startOrder, availableOrders)
  } else {
    // 情境一：送機→接機
    const toAirport = detectAirport(startOrder.dropoffLocation) ?? 'TPE'
    const departTime = new Date(startOrder.scheduledTime)
    const travelMin = getTravelMinutes(startOrder.pickupLocation, toAirport, departTime)
    arriveTime = addMinutes(departTime, travelMin)
    mainRecs = recommendPickupAfterDropoff(startOrder, availableOrders)
  }

  // 情境五：空車順路單
  const standbyRecs = recommendEmptyDriveOrders(driver, startOrder, availableOrders)

  return {
    driverStatus: {
      dailyOrderCount: driver.acceptedOrderCount,
      dailyOrderLimit: limit,
      canAcceptMore: driver.acceptedOrderCount < limit,
    },
    currentOrder: startOrder,
    arriveTime,
    mainRecommendations: mainRecs,
    standbyRecommendations: standbyRecs,
    nextRecommendations: nextRecs,
  }
}
