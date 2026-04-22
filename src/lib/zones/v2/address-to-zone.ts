// 地址 → Zone 對應表（v2，25 Zone 系統）
// 匹配優先順序：機場關鍵字 → 行政區關鍵字

import { ZoneCode } from './distance-matrix'

const ADDRESS_TO_ZONE_MAP: Record<string, ZoneCode> = {
  // ========== 機場關鍵字（優先匹配） ==========
  '桃園機場': 'TPE_AIRPORT',
  '桃園國際機場': 'TPE_AIRPORT',
  '桃機': 'TPE_AIRPORT',
  'TPE': 'TPE_AIRPORT',
  '第一航廈': 'TPE_AIRPORT',
  '第二航廈': 'TPE_AIRPORT',
  '第三航廈': 'TPE_AIRPORT',
  'T1': 'TPE_AIRPORT',
  'T2': 'TPE_AIRPORT',
  'T3': 'TPE_AIRPORT',
  '桃園機場第一航廈': 'TPE_AIRPORT',
  '桃園機場第二航廈': 'TPE_AIRPORT',
  '大園': 'TPE_AIRPORT',
  '大園區': 'TPE_AIRPORT',
  '松山機場': 'TSA_AIRPORT',
  '松機': 'TSA_AIRPORT',
  'TSA': 'TSA_AIRPORT',
  '松山國際機場': 'TSA_AIRPORT',

  // ========== 台北市（7區） ==========
  // TPE-01 台北西區
  '中正區': 'TPE-01',
  '大同區': 'TPE-01',
  '萬華區': 'TPE-01',
  '中正': 'TPE-01',
  '大同': 'TPE-01',
  '萬華': 'TPE-01',
  // TPE-02 台北中區
  '中山區': 'TPE-02',
  '松山區': 'TPE-02',
  '中山': 'TPE-02',
  '松山': 'TPE-02',
  // TPE-03 台北東區
  '信義區': 'TPE-03',
  '信義': 'TPE-03',
  // TPE-04 大安文山
  '大安區': 'TPE-04',
  '文山區': 'TPE-04',
  '大安': 'TPE-04',
  '文山': 'TPE-04',
  // TPE-05 內湖汐止
  '內湖區': 'TPE-05',
  '內湖': 'TPE-05',
  '汐止區': 'TPE-05',
  '汐止': 'TPE-05',
  // TPE-06 南港港湖
  '南港區': 'TPE-06',
  '南港': 'TPE-06',
  '港湖': 'TPE-06',
  // TPE-07 北投士林
  '北投區': 'TPE-07',
  '士林區': 'TPE-07',
  '北投': 'TPE-07',
  '士林': 'TPE-07',

  // ========== 新北市（10區） ==========
  // TPE-08 板橋土城
  '板橋區': 'TPE-08',
  '土城區': 'TPE-08',
  '板橋': 'TPE-08',
  '土城': 'TPE-08',
  // TPE-09 永和中和
  '永和區': 'TPE-09',
  '中和區': 'TPE-09',
  '永和': 'TPE-09',
  '中和': 'TPE-09',
  // TPE-10 三重蘆洲
  '三重區': 'TPE-10',
  '蘆洲區': 'TPE-10',
  '三重': 'TPE-10',
  '蘆洲': 'TPE-10',
  // TPE-11 新莊泰山
  '新莊區': 'TPE-11',
  '泰山區': 'TPE-11',
  '新莊': 'TPE-11',
  '泰山': 'TPE-11',
  // TPE-12 新店烏來
  '新店區': 'TPE-12',
  '烏來區': 'TPE-12',
  '新店': 'TPE-12',
  '烏來': 'TPE-12',
  '深坑區': 'TPE-12',
  '深坑': 'TPE-12',
  '石碇區': 'TPE-12',
  '石碇': 'TPE-12',
  '坪林區': 'TPE-12',
  '坪林': 'TPE-12',
  // TPE-13 淡水
  '淡水區': 'TPE-13',
  '淡水': 'TPE-13',
  // TPE-14 林口五股八里
  '林口區': 'TPE-14',
  '林口': 'TPE-14',
  '五股區': 'TPE-14',
  '五股': 'TPE-14',
  '八里區': 'TPE-14',
  '八里': 'TPE-14',
  // TPE-15 三峽鶯歌樹林
  '三峽區': 'TPE-15',
  '三峽': 'TPE-15',
  '鶯歌區': 'TPE-15',
  '鶯歌': 'TPE-15',
  '樹林區': 'TPE-15',
  '樹林': 'TPE-15',
  // TPE-16 北海岸
  '三芝區': 'TPE-16',
  '三芝': 'TPE-16',
  '石門區': 'TPE-16',
  '石門': 'TPE-16',
  '金山區': 'TPE-16',
  '金山': 'TPE-16',
  '萬里區': 'TPE-16',
  '萬里': 'TPE-16',
  // TPE-17 東北角
  '瑞芳區': 'TPE-17',
  '瑞芳': 'TPE-17',
  '平溪區': 'TPE-17',
  '平溪': 'TPE-17',
  '雙溪區': 'TPE-17',
  '雙溪': 'TPE-17',
  '貢寮區': 'TPE-17',
  '貢寮': 'TPE-17',

  // 基隆市（1區）— 只留不重複的 district names（與台北重疊的中正區/信義區/中山區已由 TPE 優先匹配）
  '基隆': 'KEE-01',
  '基隆市': 'KEE-01',
  '七堵區': 'KEE-01',
  '七堵': 'KEE-01',
  '暖暖區': 'KEE-01',
  '暖暖': 'KEE-01',
  '安樂區': 'KEE-01',
  '安樂': 'KEE-01',
  // 中正區/信義區/中山區在台北也有同名，台北優先（第一 match 原則），基隆的版本保留給完整地址含「基隆市」的情境

  // ========== 桃園市（5區） ==========
  // TAO-01 桃園市區
  '桃園區': 'TAO-01',
  '桃園市': 'TAO-01',
  '桃園': 'TAO-01',
  '八德區': 'TAO-01',
  '八德': 'TAO-01',
  // TAO-02 中壢平鎮
  '中壢區': 'TAO-02',
  '中壢': 'TAO-02',
  '平鎮區': 'TAO-02',
  '平鎮': 'TAO-02',
  // TAO-03 南桃園
  '楊梅區': 'TAO-03',
  '楊梅': 'TAO-03',
  '龍潭區': 'TAO-03',
  '龍潭': 'TAO-03',
  '新屋區': 'TAO-03',
  '新屋': 'TAO-03',
  '觀音區': 'TAO-03',
  '觀音': 'TAO-03',
  // TAO-04 林口龜山
  '龜山區': 'TAO-04',
  '龜山': 'TAO-04',
  // TAO-05 大溪復興
  '大溪區': 'TAO-05',
  '大溪': 'TAO-05',
  '復興區': 'TAO-05',
  '復興': 'TAO-05',
}

/**
 * 將地址字串轉換為 ZoneCode
 * @param address 地址或地點名稱
 * @returns ZoneCode 或 null（無法分類時）
 */
export function addressToZone(address: string): ZoneCode | null {
  if (!address) return null

  const normalized = address.trim()

  // 機場關鍵字優先（最精確）
  for (const [keyword, zone] of Object.entries(ADDRESS_TO_ZONE_MAP)) {
    if (normalized.includes(keyword) && (keyword.includes('機場') || keyword === 'TPE' || keyword === 'TSA' || keyword === 'T1' || keyword === 'T2' || keyword === 'T3')) {
      return zone
    }
  }

  // 行政區關鍵字（次精確）
  for (const [keyword, zone] of Object.entries(ADDRESS_TO_ZONE_MAP)) {
    if (normalized.includes(keyword)) {
      return zone
    }
  }

  return null
}

/**
 * 檢查地址是否包含機場關鍵字
 */
export function containsAirport(address: string): boolean {
  const airportKeywords = ['桃園', '桃機', 'TPE', 'T1', 'T2', 'T3', '松山', '松機', 'TSA']
  return airportKeywords.some(k => address.includes(k))
}

/**
 * 解析機場種類
 * @returns 'TPE_AIRPORT' | 'TSA_AIRPORT' | null
 */
export function parseAirport(address: string): ZoneCode | null {
  const upper = address.toUpperCase()
  if (upper.includes('桃園') || upper.includes('桃機') || upper.includes('TPE') || upper.includes('T1') || upper.includes('T2') || upper.includes('T3')) {
    return 'TPE_AIRPORT'
  }
  if (upper.includes('松山') || upper.includes('松機') || upper.includes('TSA')) {
    return 'TSA_AIRPORT'
  }
  return null
}