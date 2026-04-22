// 25 Zone 距離矩陣 v1.0（根據 docs/北北基桃次生活圈距離表_地理推估初版.md）
// 單位：分鐘（平時非尖峰開車時間，含上下車緩衝）

export const ZONES = [
  // 台北市 7 區
  'TPE-01', 'TPE-02', 'TPE-03', 'TPE-04', 'TPE-05', 'TPE-06', 'TPE-07',
  // 新北市 10 區
  'TPE-08', 'TPE-09', 'TPE-10', 'TPE-11', 'TPE-12', 'TPE-13', 'TPE-14', 'TPE-15', 'TPE-16', 'TPE-17',
  // 基隆 1 區
  'KEE-01',
  // 桃園 5 區
  'TAO-01', 'TAO-02', 'TAO-03', 'TAO-04', 'TAO-05',
  // 機場 2 節點
  'TPE_AIRPORT', 'TSA_AIRPORT',
] as const

export type ZoneCode = typeof ZONES[number]

export const ZONE_NAMES: Record<ZoneCode, string> = {
  'TPE-01': '台北西區',
  'TPE-02': '台北中區',
  'TPE-03': '台北東區',
  'TPE-04': '大安文山',
  'TPE-05': '內湖汐止',
  'TPE-06': '南港港湖',
  'TPE-07': '北投士林',
  'TPE-08': '板橋土城',
  'TPE-09': '永和中和',
  'TPE-10': '三重蘆洲',
  'TPE-11': '新莊泰山',
  'TPE-12': '新店烏來',
  'TPE-13': '淡水',
  'TPE-14': '林口五股八里',
  'TPE-15': '三峽鶯歌樹林',
  'TPE-16': '北海岸',
  'TPE-17': '東北角',
  'KEE-01': '基隆',
  'TAO-01': '桃園市區',
  'TAO-02': '中壢平鎮',
  'TAO-03': '南桃園',
  'TAO-04': '林口龜山',
  'TAO-05': '大溪復興',
  'TPE_AIRPORT': '桃園機場',
  'TSA_AIRPORT': '松山機場',
}

// 25×25 完整對稱矩陣
// 對角線（同區域內部）= 15 分鐘（已含區內移動+上下車）
// 未知組合 = 999（極遠 fallback）
type MatrixRow = Record<ZoneCode, number>

export const ZONE_DISTANCE_MATRIX: Record<ZoneCode, MatrixRow> = {
  // ========== TPE-01 台北西區 ==========
  'TPE-01': {
    'TPE-01': 15, 'TPE-02': 15, 'TPE-03': 20, 'TPE-04': 20, 'TPE-05': 25, 'TPE-06': 25, 'TPE-07': 25,
    'TPE-08': 20, 'TPE-09': 20, 'TPE-10': 15, 'TPE-11': 25, 'TPE-12': 30, 'TPE-13': 35, 'TPE-14': 35,
    'TPE-15': 30, 'TPE-16': 50, 'TPE-17': 60,
    'KEE-01': 50,
    'TAO-01': 45, 'TAO-02': 60, 'TAO-03': 75, 'TAO-04': 35, 'TAO-05': 60,
    'TPE_AIRPORT': 50, 'TSA_AIRPORT': 20,
  },

  // ========== TPE-02 台北中區 ==========
  'TPE-02': {
    'TPE-01': 15, 'TPE-02': 15, 'TPE-03': 15, 'TPE-04': 15, 'TPE-05': 20, 'TPE-06': 20, 'TPE-07': 25,
    'TPE-08': 25, 'TPE-09': 25, 'TPE-10': 20, 'TPE-11': 30, 'TPE-12': 30, 'TPE-13': 35, 'TPE-14': 40,
    'TPE-15': 35, 'TPE-16': 50, 'TPE-17': 60,
    'KEE-01': 45,
    'TAO-01': 50, 'TAO-02': 60, 'TAO-03': 75, 'TAO-04': 40, 'TAO-05': 65,
    'TPE_AIRPORT': 55, 'TSA_AIRPORT': 10,
  },

  // ========== TPE-03 台北東區 ==========
  'TPE-03': {
    'TPE-01': 20, 'TPE-02': 15, 'TPE-03': 15, 'TPE-04': 15, 'TPE-05': 20, 'TPE-06': 15, 'TPE-07': 30,
    'TPE-08': 30, 'TPE-09': 25, 'TPE-10': 25, 'TPE-11': 35, 'TPE-12': 25, 'TPE-13': 45, 'TPE-14': 45,
    'TPE-15': 35, 'TPE-16': 55, 'TPE-17': 60,
    'KEE-01': 45,
    'TAO-01': 55, 'TAO-02': 65, 'TAO-03': 80, 'TAO-04': 45, 'TAO-05': 65,
    'TPE_AIRPORT': 60, 'TSA_AIRPORT': 15,
  },

  // ========== TPE-04 大安文山 ==========
  'TPE-04': {
    'TPE-01': 20, 'TPE-02': 15, 'TPE-03': 15, 'TPE-04': 15, 'TPE-05': 25, 'TPE-06': 25, 'TPE-07': 30,
    'TPE-08': 30, 'TPE-09': 25, 'TPE-10': 25, 'TPE-11': 30, 'TPE-12': 20, 'TPE-13': 40, 'TPE-14': 45,
    'TPE-15': 30, 'TPE-16': 60, 'TPE-17': 70,
    'KEE-01': 50,
    'TAO-01': 55, 'TAO-02': 65, 'TAO-03': 80, 'TAO-04': 45, 'TAO-05': 65,
    'TPE_AIRPORT': 60, 'TSA_AIRPORT': 20,
  },

  // ========== TPE-05 內湖汐止 ==========
  'TPE-05': {
    'TPE-01': 25, 'TPE-02': 20, 'TPE-03': 20, 'TPE-04': 25, 'TPE-05': 15, 'TPE-06': 15, 'TPE-07': 25,
    'TPE-08': 35, 'TPE-09': 30, 'TPE-10': 25, 'TPE-11': 30, 'TPE-12': 35, 'TPE-13': 45, 'TPE-14': 50,
    'TPE-15': 45, 'TPE-16': 50, 'TPE-17': 50,
    'KEE-01': 30,
    'TAO-01': 60, 'TAO-02': 70, 'TAO-03': 90, 'TAO-04': 50, 'TAO-05': 75,
    'TPE_AIRPORT': 65, 'TSA_AIRPORT': 20,
  },

  // ========== TPE-06 南港港湖 ==========
  'TPE-06': {
    'TPE-01': 25, 'TPE-02': 20, 'TPE-03': 15, 'TPE-04': 25, 'TPE-05': 15, 'TPE-06': 15, 'TPE-07': 30,
    'TPE-08': 35, 'TPE-09': 35, 'TPE-10': 30, 'TPE-11': 35, 'TPE-12': 35, 'TPE-13': 45, 'TPE-14': 50,
    'TPE-15': 45, 'TPE-16': 55, 'TPE-17': 55,
    'KEE-01': 35,
    'TAO-01': 60, 'TAO-02': 70, 'TAO-03': 90, 'TAO-04': 50, 'TAO-05': 75,
    'TPE_AIRPORT': 65, 'TSA_AIRPORT': 20,
  },

  // ========== TPE-07 北投士林 ==========
  'TPE-07': {
    'TPE-01': 25, 'TPE-02': 25, 'TPE-03': 30, 'TPE-04': 30, 'TPE-05': 25, 'TPE-06': 30, 'TPE-07': 15,
    'TPE-08': 35, 'TPE-09': 30, 'TPE-10': 25, 'TPE-11': 35, 'TPE-12': 40, 'TPE-13': 25, 'TPE-14': 30,
    'TPE-15': 40, 'TPE-16': 35, 'TPE-17': 65,
    'KEE-01': 55,
    'TAO-01': 55, 'TAO-02': 70, 'TAO-03': 85, 'TAO-04': 40, 'TAO-05': 70,
    'TPE_AIRPORT': 60, 'TSA_AIRPORT': 25,
  },

  // ========== TPE-08 板橋土城 ==========
  'TPE-08': {
    'TPE-01': 20, 'TPE-02': 25, 'TPE-03': 30, 'TPE-04': 30, 'TPE-05': 35, 'TPE-06': 35, 'TPE-07': 35,
    'TPE-08': 15, 'TPE-09': 20, 'TPE-10': 20, 'TPE-11': 25, 'TPE-12': 35, 'TPE-13': 45, 'TPE-14': 30,
    'TPE-15': 20, 'TPE-16': 70, 'TPE-17': 75,
    'KEE-01': 60,
    'TAO-01': 40, 'TAO-02': 50, 'TAO-03': 70, 'TAO-04': 35, 'TAO-05': 50,
    'TPE_AIRPORT': 45, 'TSA_AIRPORT': 30,
  },

  // ========== TPE-09 永和中和 ==========
  'TPE-09': {
    'TPE-01': 20, 'TPE-02': 25, 'TPE-03': 25, 'TPE-04': 25, 'TPE-05': 30, 'TPE-06': 35, 'TPE-07': 30,
    'TPE-08': 20, 'TPE-09': 15, 'TPE-10': 20, 'TPE-11': 25, 'TPE-12': 30, 'TPE-13': 40, 'TPE-14': 35,
    'TPE-15': 30, 'TPE-16': 65, 'TPE-17': 70,
    'KEE-01': 55,
    'TAO-01': 45, 'TAO-02': 55, 'TAO-03': 75, 'TAO-04': 40, 'TAO-05': 55,
    'TPE_AIRPORT': 50, 'TSA_AIRPORT': 25,
  },

  // ========== TPE-10 三重蘆洲 ==========
  'TPE-10': {
    'TPE-01': 15, 'TPE-02': 20, 'TPE-03': 25, 'TPE-04': 25, 'TPE-05': 25, 'TPE-06': 30, 'TPE-07': 25,
    'TPE-08': 20, 'TPE-09': 20, 'TPE-10': 15, 'TPE-11': 20, 'TPE-12': 30, 'TPE-13': 35, 'TPE-14': 25,
    'TPE-15': 30, 'TPE-16': 50, 'TPE-17': 65,
    'KEE-01': 55,
    'TAO-01': 40, 'TAO-02': 55, 'TAO-03': 75, 'TAO-04': 30, 'TAO-05': 55,
    'TPE_AIRPORT': 45, 'TSA_AIRPORT': 25,
  },

  // ========== TPE-11 新莊泰山 ==========
  'TPE-11': {
    'TPE-01': 25, 'TPE-02': 30, 'TPE-03': 35, 'TPE-04': 30, 'TPE-05': 30, 'TPE-06': 35, 'TPE-07': 35,
    'TPE-08': 25, 'TPE-09': 25, 'TPE-10': 20, 'TPE-11': 15, 'TPE-12': 35, 'TPE-13': 40, 'TPE-14': 20,
    'TPE-15': 25, 'TPE-16': 55, 'TPE-17': 75,
    'KEE-01': 60,
    'TAO-01': 35, 'TAO-02': 50, 'TAO-03': 70, 'TAO-04': 25, 'TAO-05': 50,
    'TPE_AIRPORT': 40, 'TSA_AIRPORT': 35,
  },

  // ========== TPE-12 新店烏來 ==========
  'TPE-12': {
    'TPE-01': 30, 'TPE-02': 30, 'TPE-03': 25, 'TPE-04': 20, 'TPE-05': 35, 'TPE-06': 35, 'TPE-07': 40,
    'TPE-08': 35, 'TPE-09': 30, 'TPE-10': 30, 'TPE-11': 35, 'TPE-12': 15, 'TPE-13': 50, 'TPE-14': 55,
    'TPE-15': 35, 'TPE-16': 70, 'TPE-17': 80,
    'KEE-01': 65,
    'TAO-01': 60, 'TAO-02': 65, 'TAO-03': 80, 'TAO-04': 50, 'TAO-05': 60,
    'TPE_AIRPORT': 65, 'TSA_AIRPORT': 30,
  },

  // ========== TPE-13 淡水 ==========
  'TPE-13': {
    'TPE-01': 35, 'TPE-02': 35, 'TPE-03': 45, 'TPE-04': 40, 'TPE-05': 45, 'TPE-06': 45, 'TPE-07': 25,
    'TPE-08': 45, 'TPE-09': 40, 'TPE-10': 35, 'TPE-11': 40, 'TPE-12': 50, 'TPE-13': 15, 'TPE-14': 30,
    'TPE-15': 50, 'TPE-16': 35, 'TPE-17': 75,
    'KEE-01': 70,
    'TAO-01': 60, 'TAO-02': 75, 'TAO-03': 90, 'TAO-04': 50, 'TAO-05': 80,
    'TPE_AIRPORT': 65, 'TSA_AIRPORT': 40,
  },

  // ========== TPE-14 林口五股八里 ==========
  'TPE-14': {
    'TPE-01': 35, 'TPE-02': 40, 'TPE-03': 45, 'TPE-04': 45, 'TPE-05': 50, 'TPE-06': 50, 'TPE-07': 30,
    'TPE-08': 30, 'TPE-09': 35, 'TPE-10': 25, 'TPE-11': 20, 'TPE-12': 55, 'TPE-13': 30, 'TPE-14': 15,
    'TPE-15': 30, 'TPE-16': 45, 'TPE-17': 80,
    'KEE-01': 70,
    'TAO-01': 30, 'TAO-02': 45, 'TAO-03': 60, 'TAO-04': 15, 'TAO-05': 45,
    'TPE_AIRPORT': 25, 'TSA_AIRPORT': 45,
  },

  // ========== TPE-15 三峽鶯歌樹林 ==========
  'TPE-15': {
    'TPE-01': 30, 'TPE-02': 35, 'TPE-03': 35, 'TPE-04': 30, 'TPE-05': 45, 'TPE-06': 45, 'TPE-07': 40,
    'TPE-08': 20, 'TPE-09': 30, 'TPE-10': 30, 'TPE-11': 25, 'TPE-12': 35, 'TPE-13': 50, 'TPE-14': 30,
    'TPE-15': 15, 'TPE-16': 80, 'TPE-17': 90,
    'KEE-01': 75,
    'TAO-01': 30, 'TAO-02': 35, 'TAO-03': 55, 'TAO-04': 30, 'TAO-05': 30,
    'TPE_AIRPORT': 35, 'TSA_AIRPORT': 40,
  },

  // ========== TPE-16 北海岸 ==========
  'TPE-16': {
    'TPE-01': 50, 'TPE-02': 50, 'TPE-03': 55, 'TPE-04': 60, 'TPE-05': 50, 'TPE-06': 55, 'TPE-07': 35,
    'TPE-08': 70, 'TPE-09': 65, 'TPE-10': 50, 'TPE-11': 55, 'TPE-12': 70, 'TPE-13': 35, 'TPE-14': 45,
    'TPE-15': 80, 'TPE-16': 15, 'TPE-17': 60,
    'KEE-01': 40,
    'TAO-01': 80, 'TAO-02': 95, 'TAO-03': 110, 'TAO-04': 70, 'TAO-05': 100,
    'TPE_AIRPORT': 85, 'TSA_AIRPORT': 55,
  },

  // ========== TPE-17 東北角 ==========
  'TPE-17': {
    'TPE-01': 60, 'TPE-02': 60, 'TPE-03': 60, 'TPE-04': 70, 'TPE-05': 50, 'TPE-06': 55, 'TPE-07': 65,
    'TPE-08': 75, 'TPE-09': 70, 'TPE-10': 65, 'TPE-11': 75, 'TPE-12': 80, 'TPE-13': 75, 'TPE-14': 80,
    'TPE-15': 90, 'TPE-16': 60, 'TPE-17': 15,
    'KEE-01': 35,
    'TAO-01': 100, 'TAO-02': 110, 'TAO-03': 125, 'TAO-04': 90, 'TAO-05': 115,
    'TPE_AIRPORT': 105, 'TSA_AIRPORT': 60,
  },

  // ========== KEE-01 基隆 ==========
  'KEE-01': {
    'TPE-01': 50, 'TPE-02': 45, 'TPE-03': 45, 'TPE-04': 50, 'TPE-05': 30, 'TPE-06': 35, 'TPE-07': 55,
    'TPE-08': 60, 'TPE-09': 55, 'TPE-10': 55, 'TPE-11': 60, 'TPE-12': 65, 'TPE-13': 70, 'TPE-14': 70,
    'TPE-15': 75, 'TPE-16': 40, 'TPE-17': 35,
    'KEE-01': 15,
    'TAO-01': 75, 'TAO-02': 85, 'TAO-03': 100, 'TAO-04': 70, 'TAO-05': 95,
    'TPE_AIRPORT': 80, 'TSA_AIRPORT': 45,
  },

  // ========== TAO-01 桃園市區 ==========
  'TAO-01': {
    'TPE-01': 45, 'TPE-02': 50, 'TPE-03': 55, 'TPE-04': 55, 'TPE-05': 60, 'TPE-06': 60, 'TPE-07': 55,
    'TPE-08': 40, 'TPE-09': 45, 'TPE-10': 40, 'TPE-11': 35, 'TPE-12': 60, 'TPE-13': 60, 'TPE-14': 30,
    'TPE-15': 30, 'TPE-16': 80, 'TPE-17': 100,
    'KEE-01': 75,
    'TAO-01': 15, 'TAO-02': 20, 'TAO-03': 35, 'TAO-04': 15, 'TAO-05': 30,
    'TPE_AIRPORT': 25, 'TSA_AIRPORT': 50,
  },

  // ========== TAO-02 中壢平鎮 ==========
  'TAO-02': {
    'TPE-01': 60, 'TPE-02': 60, 'TPE-03': 65, 'TPE-04': 65, 'TPE-05': 70, 'TPE-06': 70, 'TPE-07': 70,
    'TPE-08': 50, 'TPE-09': 55, 'TPE-10': 55, 'TPE-11': 50, 'TPE-12': 65, 'TPE-13': 75, 'TPE-14': 45,
    'TPE-15': 35, 'TPE-16': 95, 'TPE-17': 110,
    'KEE-01': 85,
    'TAO-01': 20, 'TAO-02': 15, 'TAO-03': 20, 'TAO-04': 30, 'TAO-05': 25,
    'TPE_AIRPORT': 30, 'TSA_AIRPORT': 60,
  },

  // ========== TAO-03 南桃園 ==========
  'TAO-03': {
    'TPE-01': 75, 'TPE-02': 75, 'TPE-03': 80, 'TPE-04': 80, 'TPE-05': 90, 'TPE-06': 90, 'TPE-07': 85,
    'TPE-08': 70, 'TPE-09': 75, 'TPE-10': 75, 'TPE-11': 70, 'TPE-12': 80, 'TPE-13': 90, 'TPE-14': 60,
    'TPE-15': 55, 'TPE-16': 110, 'TPE-17': 125,
    'KEE-01': 100,
    'TAO-01': 35, 'TAO-02': 20, 'TAO-03': 15, 'TAO-04': 45, 'TAO-05': 35,
    'TPE_AIRPORT': 35, 'TSA_AIRPORT': 75,
  },

  // ========== TAO-04 林口龜山 ==========
  'TAO-04': {
    'TPE-01': 35, 'TPE-02': 40, 'TPE-03': 45, 'TPE-04': 45, 'TPE-05': 50, 'TPE-06': 50, 'TPE-07': 40,
    'TPE-08': 35, 'TPE-09': 40, 'TPE-10': 30, 'TPE-11': 25, 'TPE-12': 50, 'TPE-13': 50, 'TPE-14': 15,
    'TPE-15': 30, 'TPE-16': 70, 'TPE-17': 90,
    'KEE-01': 70,
    'TAO-01': 15, 'TAO-02': 30, 'TAO-03': 45, 'TAO-04': 15, 'TAO-05': 30,
    'TPE_AIRPORT': 20, 'TSA_AIRPORT': 45,
  },

  // ========== TAO-05 大溪復興 ==========
  'TAO-05': {
    'TPE-01': 60, 'TPE-02': 65, 'TPE-03': 65, 'TPE-04': 65, 'TPE-05': 75, 'TPE-06': 75, 'TPE-07': 70,
    'TPE-08': 50, 'TPE-09': 55, 'TPE-10': 55, 'TPE-11': 50, 'TPE-12': 60, 'TPE-13': 80, 'TPE-14': 45,
    'TPE-15': 30, 'TPE-16': 100, 'TPE-17': 115,
    'KEE-01': 95,
    'TAO-01': 30, 'TAO-02': 25, 'TAO-03': 35, 'TAO-04': 30, 'TAO-05': 15,
    'TPE_AIRPORT': 40, 'TSA_AIRPORT': 65,
  },

  // ========== TPE_AIRPORT 桃園機場 ==========
  'TPE_AIRPORT': {
    'TPE-01': 50, 'TPE-02': 55, 'TPE-03': 60, 'TPE-04': 60, 'TPE-05': 65, 'TPE-06': 65, 'TPE-07': 60,
    'TPE-08': 45, 'TPE-09': 50, 'TPE-10': 45, 'TPE-11': 40, 'TPE-12': 65, 'TPE-13': 65, 'TPE-14': 25,
    'TPE-15': 35, 'TPE-16': 85, 'TPE-17': 105,
    'KEE-01': 80,
    'TAO-01': 25, 'TAO-02': 30, 'TAO-03': 35, 'TAO-04': 20, 'TAO-05': 40,
    'TPE_AIRPORT': 15, 'TSA_AIRPORT': 55,
  },

  // ========== TSA_AIRPORT 松山機場 ==========
  'TSA_AIRPORT': {
    'TPE-01': 20, 'TPE-02': 10, 'TPE-03': 15, 'TPE-04': 20, 'TPE-05': 20, 'TPE-06': 20, 'TPE-07': 25,
    'TPE-08': 30, 'TPE-09': 25, 'TPE-10': 25, 'TPE-11': 35, 'TPE-12': 30, 'TPE-13': 40, 'TPE-14': 45,
    'TPE-15': 40, 'TPE-16': 55, 'TPE-17': 60,
    'KEE-01': 45,
    'TAO-01': 50, 'TAO-02': 60, 'TAO-03': 75, 'TAO-04': 45, 'TAO-05': 65,
    'TPE_AIRPORT': 55, 'TSA_AIRPORT': 15,
  },
}

/**
 * 取得兩 Zone 之間的預估時間（分鐘）
 * @param from 起點 ZoneCode
 * @param to 終點 ZoneCode
 * @param peakMultiplier 尖峰加成（預設 1.0；尖峰 1.3；深夜 0.85）
 */
export function getZoneTravelTime(from: ZoneCode, to: ZoneCode, peakMultiplier = 1.0): number {
  if (from === to) return 15
  const base = ZONE_DISTANCE_MATRIX[from]?.[to]
  if (base === undefined) return 999
  return Math.round(base * peakMultiplier)
}

/**
 * 兩 Zone 是否「鄰近」（車程 ≤ 30 分鐘）
 */
export function isNearby(from: ZoneCode, to: ZoneCode): boolean {
  return getZoneTravelTime(from, to) <= 30
}

/**
 * 兩 Zone 是否「機場相關」（任一端是機場節點）
 */
export function isAirportZone(zone: ZoneCode): boolean {
  return zone === 'TPE_AIRPORT' || zone === 'TSA_AIRPORT'
}