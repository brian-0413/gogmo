// 地址 → Zone 正規化工具
// 將五花八門的地址格式正規化為 AnyZone

import { DISTRICT_TO_ZONE } from './districtMap'
import type { AnyZone } from './types'

/**
 * 將任意地址字串正規化為 AnyZone
 *
 * 邏輯：
 * 1. 機場關鍵字優先（桃園機場、桃機、TPE、松機、TSA 等）
 * 2. 用正則取出「XX區」「XX縣」「XX市」等行政區關鍵字
 * 3. 查 DISTRICT_TO_ZONE 對應 zone
 * 4. 嘗試移除城市前綴（台北市、新北市）再查
 * 5. 若仍查不到，回傳 null
 */
export function addressToZone(address: string): AnyZone | null {
  if (!address) return null
  const normalized = address.trim()

  // === Step 1：機場關鍵字 ===
  if (containsAirport(normalized)) {
    return detectAirport(normalized)
  }

  // === Step 2：取出行政區關鍵字 ===
  const district = extractDistrict(normalized)
  if (!district) {
    // 查不到行政區，試最後一招：直接查 DISTRICT_TO_ZONE（以防是「板橋」這種簡寫）
    const direct = DISTRICT_TO_ZONE[normalized]
    if (direct) return direct
    return null
  }

  // === Step 3：查 DISTRICT_TO_ZONE ===
  // 基隆市有重名行政區（中正區、的信區），需先轉換
  const normalizedDistrict = normalizeDistrict(district, normalized)
  const zone = DISTRICT_TO_ZONE[normalizedDistrict]
  if (zone) return zone

  // === Step 4：移除城市前綴後再查 ===
  const withoutCity = stripCityPrefix(district)
  if (withoutCity !== district) {
    const zone2 = DISTRICT_TO_ZONE[withoutCity]
    if (zone2) return zone2
  }

  // === Step 5：查不到，回傳 null ===
  return null
}

/**
 * 檢查是否為機場關鍵字
 */
function containsAirport(addr: string): boolean {
  const LOWER = addr.toLowerCase()
  return (
    LOWER.includes('桃園國際機場') ||
    LOWER.includes('桃園機場') ||
    LOWER.includes('桃機') ||
    LOWER.includes('tpe') ||
    LOWER.includes('大園機場') ||
    LOWER.includes('桃園機場第一航廈') ||
    LOWER.includes('桃園機場第二航廈') ||
    LOWER.includes('第一航廈') ||
    LOWER.includes('第二航廈') ||
    LOWER.includes('松山機場') ||
    LOWER.includes('松機') ||
    LOWER.includes('tsa') ||
    LOWER.includes('清泉崗') ||
    LOWER.includes('台中機場') ||
    LOWER.includes('rmq') ||
    LOWER.includes('小港機場') ||
    LOWER.includes('高雄機場') ||
    LOWER.includes('khh')
  )
}

/**
 * 從地址中取出行政區關鍵字
 * 優先順序：區 → 縣 → 市（因為「XX區」才是最精確的行政區單位）
 */
function extractDistrict(addr: string): string | null {
  // 配對「XX區」（最精確）
  const match = addr.match(/([一-龯]+區)/)
  if (match) return match[1]

  // 配對「XX縣」時，需排除「市」在同一行政區的情況（如「宜蘭縣」單獨出現時）
  const countyMatch = addr.match(/([一-龯]+縣)/)
  if (countyMatch) return countyMatch[1]

  // 配對「XX市」（新竹市、苗栗市等，鄉鎮市區層級的市）
  const cityMatch = addr.match(/([一-龯]+市)$/)
  if (cityMatch) return cityMatch[1]

  return null
}

/**
 * 處理重名行政區（台北市與基隆市都有中正區、信義區、中山區）
 * 根據地址中是否包含基隆關鍵字來判斷
 */
function normalizeDistrict(district: string, fullAddress: string): string {
  const LOWER = fullAddress.toLowerCase()
  const HAS_KEEELING = (
    LOWER.includes('基隆') ||
    LOWER.includes('暖暖') ||
    LOWER.includes('七堵') ||
    LOWER.includes('安樂')
  )

  if (HAS_KEEELING) {
    // district 可能含城市前綴（如「基隆市中正區」），需先移除
    const stripped = stripCityPrefix(district)
    // 再嘗試 _基隆 後綴
    const keelingDistrict = stripped.replace('_基隆', '')
    const keelingKey = `${keelingDistrict}_基隆`
    if (keelingKey in DISTRICT_TO_ZONE) return keelingKey
    // 基隆市特殊行政區：暖暖、七堵、安樂、仁愛（這些不重名，直接通過）
    return stripped
  }
  return district
}

/**
 * 偵測是哪個機場
 */
function detectAirport(addr: string): AnyZone {
  const LOWER = addr.toLowerCase()
  if (
    LOWER.includes('桃園國際機場') ||
    LOWER.includes('桃園機場') ||
    LOWER.includes('桃機') ||
    LOWER.includes('tpe') ||
    LOWER.includes('大園機場') ||
    LOWER.includes('第一航廈') ||
    LOWER.includes('第二航廈')
  ) {
    return 'AIRPORT_TPE'
  }
  if (LOWER.includes('松山機場') || LOWER.includes('松機') || LOWER.includes('tsa')) {
    return 'AIRPORT_TSA'
  }
  if (LOWER.includes('清泉崗') || LOWER.includes('台中機場') || LOWER.includes('rmq')) {
    return 'AIRPORT_RMQ'
  }
  if (LOWER.includes('小港機場') || LOWER.includes('高雄機場') || LOWER.includes('khh')) {
    return 'AIRPORT_KHH'
  }
  return 'OTHER'
}

/**
 * 移除城市前綴，保留行政區
 * 「新北市板橋區」→「板橋區」
 * 「台北市大安區」→「大安區」
 */
function stripCityPrefix(district: string): string {
  return district
    .replace(/^(台北市|新北市|桃園市|台中市|台南市|高雄市|基隆市|新竹市|新竹縣)/, '')
    .replace(/^(宜蘭縣|花蓮縣|台東縣|苗栗縣|彰化縣|雲林縣|南投縣|嘉義市|嘉義縣)/, '')
    .replace(/^(屏東縣|澎湖縣|金門縣|連江縣)/, '')
}
