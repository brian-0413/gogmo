// Zone 基礎建設型別
// 根據 docs/gogmo-zones-matrix.md 定義

export type ZoneCode =
  | 'TPE_EAST'    // 台北核心東區
  | 'TPE_WEST'    // 台北核心西區
  | 'TPE_NORTH'   // 台北北區
  | 'TPE_NORTHEAST' // 台北東北（內湖南港）
  | 'TPE_SOUTH'   // 台北南區（文山）
  | 'NTPE_WEST'    // 新北西南（板橋中永和）
  | 'NTPE_NORTHWEST' // 新北西北（三重蘆洲新莊）
  | 'NTPE_NORTHEAST' // 新北東北（汐止深坑）
  | 'NTPE_EAST'   // 新北東部（新店烏來）
  | 'NTPE_WESTEXT' // 新北西部延伸（林口樹林鶯歌三峽）
  | 'NTPE_COASTAL' // 新北北海岸（淡水金山瑞芳）

export type AirportCode =
  | 'AIRPORT_TPE'  // 桃園國際機場
  | 'AIRPORT_TSA'  // 松山機場
  | 'AIRPORT_RMQ'  // 台中清泉崗機場
  | 'AIRPORT_KHH'  // 高雄小港機場

export type ExternalZoneCode =
  | 'TAOYUAN_CORE'   // 桃園市核心區
  | 'TAOYUAN_NORTH'  // 桃園市北區
  | 'TAOYUAN_SOUTH'  // 桃園市南區
  | 'HSINCHU'        // 新竹
  | 'MIAOLI'         // 苗栗
  | 'YILAN_NORTH'    // 宜蘭北
  | 'YILAN_SOUTH'    // 宜蘭南

export type AnyZone = ZoneCode | AirportCode | ExternalZoneCode | 'OTHER'

export interface DistrictMapping {
  district: string    // 例：「板橋區」
  city: string        // 例：「新北市」
  zone: AnyZone       // 例：'NTPE_WEST'
}

export interface TravelTimeEntry {
  from: AnyZone
  to: AnyZone
  minutes: number     // 平日非尖峰基準
}

export interface TravelTimeOptions {
  time?: Date
  isWeekend?: boolean
  isTouristZone?: boolean // 觀光區（淡水、九份等）額外加成
}
