/** 地點關鍵字 → 區域代號 mapping（不區分大小寫） */
export const DISTRICT_REGION_MAP: Record<string, string> = {
  // === TPE-01 台北市中心 ===
  '中正': 'TPE-01',
  '大同': 'TPE-01',
  '中山': 'TPE-01',
  '松山': 'TPE-01',
  '信義': 'TPE-01',
  // === TPE-02 內湖汐止 ===
  '內湖': 'TPE-02',
  '汐止': 'TPE-02',
  // === TPE-03 南港港湖 ===
  '南港': 'TPE-03',
  // === TPE-04 北投士林 ===
  '北投': 'TPE-04',
  '士林': 'TPE-04',
  // === TPE-05 大安文山 ===
  '大安': 'TPE-05',
  '萬華': 'TPE-05',
  '文山': 'TPE-05',
  // === TPE-06 板橋土城 ===
  '板橋': 'TPE-06',
  '土城': 'TPE-06',
  '樹林': 'TPE-06',
  // === TPE-07 永和中和 ===
  '永和': 'TPE-07',
  '中和': 'TPE-07',
  // === TPE-08 三重蘆洲 ===
  '三重': 'TPE-08',
  '蘆洲': 'TPE-08',
  '五股': 'TPE-08',
  // === TPE-09 新莊泰山 ===
  '新莊': 'TPE-09',
  '泰山': 'TPE-09',
  // === TPE-10 新店深坑 ===
  '新店': 'TPE-10',
  '深坑': 'TPE-10',
  '石碇': 'TPE-10',
  '坪林': 'TPE-10',
  '烏來': 'TPE-10',
  // === TPE-11 淡水三芝 ===
  '淡水': 'TPE-11',
  '三芝': 'TPE-11',
  '石門': 'TPE-11',
  '八里': 'TPE-11',
  // === TPE-12 林口 ===
  '林口': 'TPE-12',
  // === TPE-13 三峽鶯歌 ===
  '三峽': 'TPE-13',
  '鶯歌': 'TPE-13',
  // === TPE-14 東北角 ===
  '瑞芳': 'TPE-14',
  '貢寮': 'TPE-14',
  '雙溪': 'TPE-14',
  '平溪': 'TPE-14',
  // === TPE-15 北海岸東 ===
  '金山': 'TPE-15',
  '萬里': 'TPE-15',
  // === KEE-01 基隆市區 ===
  '仁愛': 'KEE-01',
  '安樂': 'KEE-01',
  // === KEE-02 基隆東南 ===
  '暖暖': 'KEE-02',
  '七堵': 'KEE-02',
  // === TAO-01 桃園市區 ===
  '桃園': 'TAO-01',
  '八德': 'TAO-01',
  // === TAO-02 中壢平鎮 ===
  '中壢': 'TAO-02',
  '平鎮': 'TAO-02',
  // === TAO-03 南桃園 ===
  '楊梅': 'TAO-03',
  '新屋': 'TAO-03',
  '觀音': 'TAO-03',
  // === TAO-04 蘆竹大園 ===
  '蘆竹': 'TAO-04',
  '大園': 'TAO-04',
  // === TAO-05 龜山 ===
  '龜山': 'TAO-05',
  // === TAO-06 大溪龍潭 ===
  '大溪': 'TAO-06',
  '龍潭': 'TAO-06',
  '復興': 'TAO-06',
  // === 機場關鍵字 ===
  '桃機': 'TAO-04',
  'tpe': 'TAO-04',
  '桃園機場': 'TAO-04',
  '松機': 'TPE-01',
  'tsa': 'TPE-01',
  '松山機場': 'TPE-01',
  '基隆港': 'KEE-01',
}

/** 預設區域（解析不到時） */
export const DEFAULT_REGION = 'TPE-01'

/**
 * 從任意地點字串解析出區域代號。
 * 優先精確匹配，越後面的越寬鬆。
 */
export function parseRegion(location: string): string {
  if (!location) return DEFAULT_REGION
  const text = location.trim()

  // 1. 機場關鍵字（最優先）
  if (/桃機|tpe|桃園機場/i.test(text)) return 'TAO-04'
  if (/松機|tsa|松山機場/i.test(text)) return 'TPE-01'
  if (/基隆港/i.test(text)) return 'KEE-01'

  // 2. 基隆市行政區（台北也有「信義」「中正」「中山」）
  if (/基隆/i.test(text) || /暖暖|七堵/i.test(text)) {
    if (/暖暖/i.test(text)) return 'KEE-02'
    if (/七堵/i.test(text)) return 'KEE-02'
    return 'KEE-01'
  }

  // 3. 桃園行政區
  if (/桃園|八德|中壢|平鎮|楊梅|新屋|觀音|蘆竹|大園|龜山|大溪|龍潭|復興/i.test(text)) {
    if (/楊梅|新屋|觀音/i.test(text)) return 'TAO-03'
    if (/蘆竹|大園/i.test(text)) return 'TAO-04'
    if (/龜山/i.test(text)) return 'TAO-05'
    if (/大溪|龍潭|復興/i.test(text)) return 'TAO-06'
    if (/中壢|平鎮/i.test(text)) return 'TAO-02'
    if (/桃園|八德/i.test(text)) return 'TAO-01'
  }

  // 4. 新北行政區
  if (/三重|蘆洲|五股/i.test(text)) return 'TPE-08'
  if (/新莊|泰山/i.test(text)) return 'TPE-09'
  if (/板橋|土城|樹林/i.test(text)) return 'TPE-06'
  if (/永和|中和/i.test(text)) return 'TPE-07'
  if (/新店|深坑|石碇|坪林|烏來/i.test(text)) return 'TPE-10'
  if (/淡水|三芝|石門|八里/i.test(text)) return 'TPE-11'
  if (/林口/i.test(text)) return 'TPE-12'
  if (/三峽|鶯歌/i.test(text)) return 'TPE-13'
  if (/瑞芳|貢寮|雙溪|平溪/i.test(text)) return 'TPE-14'
  if (/金山|萬里/i.test(text)) return 'TPE-15'
  if (/內湖|汐止/i.test(text)) return 'TPE-02'
  if (/南港/i.test(text)) return 'TPE-03'
  if (/北投|士林/i.test(text)) return 'TPE-04'
  if (/大安|萬華|文山/i.test(text)) return 'TPE-05'
  if (/中正|大同|中山|松山|信義/i.test(text)) return 'TPE-01'

  return DEFAULT_REGION
}

/** 次生活圈相鄰關係表（用於緩衝時間計算） */
export const ADJACENT_REGIONS: Record<string, string[]> = {
  'TPE-01': ['TPE-02', 'TPE-03', 'TPE-04', 'TPE-05', 'TPE-08'],
  'TPE-02': ['TPE-01', 'TPE-03', 'KEE-02'],
  'TPE-03': ['TPE-01', 'TPE-02', 'TPE-05'],
  'TPE-04': ['TPE-01', 'TPE-08', 'TPE-11'],
  'TPE-05': ['TPE-01', 'TPE-03', 'TPE-07', 'TPE-10'],
  'TPE-06': ['TPE-07', 'TPE-09', 'TPE-13'],
  'TPE-07': ['TPE-01', 'TPE-05', 'TPE-06', 'TPE-08'],
  'TPE-08': ['TPE-01', 'TPE-04', 'TPE-07', 'TPE-09'],
  'TPE-09': ['TPE-06', 'TPE-08', 'TPE-12'],
  'TPE-10': ['TPE-05', 'TPE-07'],
  'TPE-11': ['TPE-04', 'TPE-15'],
  'TPE-12': ['TPE-09', 'TAO-01', 'TAO-04', 'TAO-05'],
  'TPE-13': ['TPE-06', 'TAO-01', 'TAO-06'],
  'TPE-14': ['KEE-01', 'KEE-02', 'TPE-15'],
  'TPE-15': ['TPE-11', 'TPE-14', 'KEE-01'],
  'KEE-01': ['KEE-02', 'TPE-14', 'TPE-15'],
  'KEE-02': ['KEE-01', 'TPE-02', 'TPE-14'],
  'TAO-01': ['TAO-02', 'TAO-04', 'TAO-05', 'TAO-06', 'TPE-12', 'TPE-13'],
  'TAO-02': ['TAO-01', 'TAO-03', 'TAO-06'],
  'TAO-03': ['TAO-02', 'TAO-04'],
  'TAO-04': ['TAO-01', 'TAO-03', 'TAO-05', 'TPE-12'],
  'TAO-05': ['TAO-01', 'TAO-04', 'TPE-12'],
  'TAO-06': ['TAO-01', 'TAO-02', 'TPE-13'],
}

/** 標籤名稱 */
export const REGION_LABELS: Record<string, string> = {
  'TPE-01': '台北市中心',
  'TPE-02': '內湖汐止',
  'TPE-03': '南港港湖',
  'TPE-04': '北投士林',
  'TPE-05': '大安文山',
  'TPE-06': '板橋土城',
  'TPE-07': '永和中和',
  'TPE-08': '三重蘆洲',
  'TPE-09': '新莊泰山',
  'TPE-10': '新店深坑',
  'TPE-11': '淡水三芝',
  'TPE-12': '林口',
  'TPE-13': '三峽鶯歌',
  'TPE-14': '東北角',
  'TPE-15': '北海岸東',
  'KEE-01': '基隆市區',
  'KEE-02': '基隆東南',
  'TAO-01': '桃園市區',
  'TAO-02': '中壢平鎮',
  'TAO-03': '南桃園',
  'TAO-04': '蘆竹大園',
  'TAO-05': '龜山',
  'TAO-06': '大溪龍潭',
}