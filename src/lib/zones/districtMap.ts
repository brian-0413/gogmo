// 行政區 → Zone 對應表
// 涵蓋：台北市 12 區、新北市 29 區、桃園市主要區、基隆市、新竹、苗栗、宜蘭
// 根據 docs/gogmo-zones-matrix.md Zone 定義建立

import type { AnyZone } from './types'

// Key = 行政區名稱（含「區」），Value = ZoneCode
// 台北市
const TPE_EAST_DISTRICTS = ['大安區', '信義區', '松山區']
const TPE_WEST_DISTRICTS = ['中正區', '萬華區', '大同區', '中山區']
const TPE_NORTH_DISTRICTS = ['士林區', '北投區']
// 注意：中山區南段屬 TPE_WEST，北段（大直、劍南路）屬 TPE_NORTH
// 這裡以主要涵蓋範圍為主，split 在 addressToZone 處理
const TPE_NORTHEAST_DISTRICTS = ['內湖區', '南港區']
const TPE_SOUTH_DISTRICTS = ['文山區']

// 新北市
const NTPE_WEST_DISTRICTS = ['板橋區', '中和區', '永和區', '土城區']
const NTPE_NORTHWEST_DISTRICTS = ['三重區', '蘆洲區', '新莊區', '五股區', '泰山區']
const NTPE_NORTHEAST_DISTRICTS = ['汐止區', '深坑區', '石碇區', '平溪區', '雙溪區', '貢寮區']
const NTPE_EAST_DISTRICTS = ['新店區', '烏來區', '坪林區']
const NTPE_WESTEXT_DISTRICTS = ['林口區', '樹林區', '鶯歌區', '三峽區', '八里區']
// 淡水、三芝、石門、金山、萬里、瑞芳歸 NTPE_COASTAL
// 五股區北段歸 NTPE_COASTAL，其餘歸 NTPE_NORTHWEST（這裡以主體為主）
const NTPE_COASTAL_DISTRICTS = ['淡水區', '三芝區', '石門區', '金山區', '萬里區', '瑞芳區']

function districtEntry(district: string, zone: AnyZone): [string, AnyZone] {
  return [district, zone]
}

export const DISTRICT_TO_ZONE: Record<string, AnyZone> = {
  // === 台北市 ===
  // TPE_EAST
  ...Object.fromEntries(TPE_EAST_DISTRICTS.map(d => districtEntry(d, 'TPE_EAST'))),
  // TPE_WEST
  ...Object.fromEntries(TPE_WEST_DISTRICTS.map(d => districtEntry(d, 'TPE_WEST'))),
  // 中山區：南段（中山、雙連站）→ TPE_WEST；北段（大直、劍南路）→ TPE_NORTH
  // 以「中山區」主要覆蓋給 TPE_WEST，split logic 在 addressToZone 處理
  '中山區': 'TPE_WEST',
  // TPE_NORTH
  ...Object.fromEntries(TPE_NORTH_DISTRICTS.map(d => districtEntry(d, 'TPE_NORTH'))),
  // TPE_NORTHEAST
  ...Object.fromEntries(TPE_NORTHEAST_DISTRICTS.map(d => districtEntry(d, 'TPE_NORTHEAST'))),
  // TPE_SOUTH
  ...Object.fromEntries(TPE_SOUTH_DISTRICTS.map(d => districtEntry(d, 'TPE_SOUTH'))),

  // === 新北市 ===
  // NTPE_WEST
  ...Object.fromEntries(NTPE_WEST_DISTRICTS.map(d => districtEntry(d, 'NTPE_WEST'))),
  // NTPE_NORTHWEST
  ...Object.fromEntries(NTPE_NORTHWEST_DISTRICTS.map(d => districtEntry(d, 'NTPE_NORTHWEST'))),
  // NTPE_NORTHEAST
  ...Object.fromEntries(NTPE_NORTHEAST_DISTRICTS.map(d => districtEntry(d, 'NTPE_NORTHEAST'))),
  // NTPE_EAST
  ...Object.fromEntries(NTPE_EAST_DISTRICTS.map(d => districtEntry(d, 'NTPE_EAST'))),
  // NTPE_WESTEXT
  ...Object.fromEntries(NTPE_WESTEXT_DISTRICTS.map(d => districtEntry(d, 'NTPE_WESTEXT'))),
  // NTPE_COASTAL
  ...Object.fromEntries(NTPE_COASTAL_DISTRICTS.map(d => districtEntry(d, 'NTPE_COASTAL'))),

  // === 桃園市 ===
  // TAOYUAN_CORE：桃園區、中壢區、平鎮區、八德區
  '桃園區': 'TAOYUAN_CORE',
  '中壢區': 'TAOYUAN_CORE',
  '平鎮區': 'TAOYUAN_CORE',
  '八德區': 'TAOYUAN_CORE',
  // TAOYUAN_NORTH：蘆竹區、大園區、龜山區、觀音區、新屋區
  '蘆竹區': 'TAOYUAN_NORTH',
  '大園區': 'TAOYUAN_NORTH',
  '龜山區': 'TAOYUAN_NORTH',
  '觀音區': 'TAOYUAN_NORTH',
  '新屋區': 'TAOYUAN_NORTH',
  // TAOYUAN_SOUTH：龍潭區、大溪區、復興區、楊梅區
  '龍潭區': 'TAOYUAN_SOUTH',
  '大溪區': 'TAOYUAN_SOUTH',
  '復興區': 'TAOYUAN_SOUTH',
  '楊梅區': 'TAOYUAN_SOUTH',

  // === 基隆市 → NTPE_COASTAL ===
  // 基隆市與台北市的「中正區」「中山區」「信義區」重名
  // districtMap 以台北市為主；基隆市的查詢透過 addressToZone 的城市 context 處理
  '仁愛區': 'NTPE_COASTAL',
  '中正區_基隆': 'NTPE_COASTAL',
  '信義區_基隆': 'NTPE_COASTAL',
  '中山區_基隆': 'NTPE_COASTAL',
  '安樂區': 'NTPE_COASTAL',
  '暖暖區': 'NTPE_COASTAL',
  '七堵區': 'NTPE_COASTAL',

  // === 新竹市、新竹縣 → HSINCHU ===
  '新竹市': 'HSINCHU',
  '東區': 'HSINCHU',
  '北區': 'HSINCHU',
  '香山區': 'HSINCHU',
  '竹北市': 'HSINCHU',
  '竹東鎮': 'HSINCHU',
  '新埔鎮': 'HSINCHU',
  '關西鎮': 'HSINCHU',
  '湖口鄉': 'HSINCHU',
  '新豐鄉': 'HSINCHU',
  '峨眉鄉': 'HSINCHU',
  '寶山鄉': 'HSINCHU',
  '北埔鄉': 'HSINCHU',
  '芎林鄉': 'HSINCHU',
  '橫山鄉': 'HSINCHU',

  // === 苗栗縣 → MIAOLI ===
  '苗栗市': 'MIAOLI',
  '苑裡鎮': 'MIAOLI',
  '通霄鎮': 'MIAOLI',
  '竹南鎮': 'MIAOLI',
  '頭份市': 'MIAOLI',
  '後龍鎮': 'MIAOLI',
  '卓蘭鎮': 'MIAOLI',
  '大湖鄉': 'MIAOLI',
  '公館鄉': 'MIAOLI',
  '銅鑼鄉': 'MIAOLI',
  '南庄鄉': 'MIAOLI',
  '頭屋鄉': 'MIAOLI',
  '三義鄉': 'MIAOLI',
  '西湖鄉': 'MIAOLI',
  '造橋鄉': 'MIAOLI',
  '龍坑鄉': 'MIAOLI',
  '三灣鄉': 'MIAOLI',
  '獅潭鄉': 'MIAOLI',
  '泰安鄉': 'MIAOLI',

  // === 宜蘭縣 ===
  // YILAN_NORTH：頭城、礁溪、宜蘭市、壯圍
  '頭城鎮': 'YILAN_NORTH',
  '礁溪鄉': 'YILAN_NORTH',
  '宜蘭市': 'YILAN_NORTH',
  '壯圍鄉': 'YILAN_NORTH',
  // YILAN_SOUTH：羅東、冬山、蘇澳、三星
  '羅東鎮': 'YILAN_SOUTH',
  '冬山鄉': 'YILAN_SOUTH',
  '蘇澳鎮': 'YILAN_SOUTH',
  '三星鄉': 'YILAN_SOUTH',
  '大同鄉': 'YILAN_SOUTH',
  '五結鄉': 'YILAN_SOUTH',
  '員山鄉': 'YILAN_SOUTH',
}

// Zone 中文字標籤（用於 UI 顯示）
export const ZONE_LABELS: Record<string, string> = {
  TPE_EAST: '台北東區',
  TPE_WEST: '台北西區',
  TPE_NORTH: '台北北區',
  TPE_NORTHEAST: '台北東北',
  TPE_SOUTH: '台北南區',
  NTPE_WEST: '新北西南',
  NTPE_NORTHWEST: '新北西北',
  NTPE_NORTHEAST: '新北東北',
  NTPE_EAST: '新北東區',
  NTPE_WESTEXT: '新北西延伸',
  NTPE_COASTAL: '北海岸',
  AIRPORT_TPE: '桃園機場',
  AIRPORT_TSA: '松山機場',
  AIRPORT_RMQ: '清泉崗機場',
  AIRPORT_KHH: '小港機場',
  TAOYUAN_CORE: '桃園核心',
  TAOYUAN_NORTH: '桃園北區',
  TAOYUAN_SOUTH: '桃園南區',
  HSINCHU: '新竹',
  MIAOLI: '苗栗',
  YILAN_NORTH: '宜蘭北',
  YILAN_SOUTH: '宜蘭南',
  OTHER: '其他區域',
}
