// Travel Time Matrix v1.0
// 根據 docs/gogmo-zones-matrix.md Zone 定義建立
// 單位：分鐘（平日非尖峰基準）

import type { AnyZone } from './types'

// 11×11 雙北 zone 內部 matrix（對稱矩陣）
// 順序：TPE_EAST, TPE_WEST, TPE_NORTH, TPE_NORTHEAST, TPE_SOUTH,
//       NTPE_WEST, NTPE_NORTHWEST, NTPE_NORTHEAST, NTPE_EAST,
//       NTPE_WESTEXT, NTPE_COASTAL
const INTERNAL_MATRIX: Record<string, Record<string, number>> = {
  TPE_EAST: {
    TPE_EAST: 10,
    TPE_WEST: 15,
    TPE_NORTH: 20,
    TPE_NORTHEAST: 20,
    TPE_SOUTH: 25,
    NTPE_WEST: 25,
    NTPE_NORTHWEST: 20,
    NTPE_NORTHEAST: 30,
    NTPE_EAST: 30,
    NTPE_WESTEXT: 40,
    NTPE_COASTAL: 45,
  },
  TPE_WEST: {
    TPE_EAST: 15,
    TPE_WEST: 10,
    TPE_NORTH: 20,
    TPE_NORTHEAST: 25,
    TPE_SOUTH: 25,
    NTPE_WEST: 20,
    NTPE_NORTHWEST: 15,
    NTPE_NORTHEAST: 35,
    NTPE_EAST: 30,
    NTPE_WESTEXT: 35,
    NTPE_COASTAL: 40,
  },
  TPE_NORTH: {
    TPE_EAST: 20,
    TPE_WEST: 20,
    TPE_NORTH: 10,
    TPE_NORTHEAST: 25,
    TPE_SOUTH: 35,
    NTPE_WEST: 30,
    NTPE_NORTHWEST: 20,
    NTPE_NORTHEAST: 35,
    NTPE_EAST: 40,
    NTPE_WESTEXT: 35,
    NTPE_COASTAL: 35,
  },
  TPE_NORTHEAST: {
    TPE_EAST: 20,
    TPE_WEST: 25,
    TPE_NORTH: 25,
    TPE_NORTHEAST: 10,
    TPE_SOUTH: 35,
    NTPE_WEST: 35,
    NTPE_NORTHWEST: 30,
    NTPE_NORTHEAST: 20,
    NTPE_EAST: 40,
    NTPE_WESTEXT: 50,
    NTPE_COASTAL: 50,
  },
  TPE_SOUTH: {
    TPE_EAST: 25,
    TPE_WEST: 25,
    TPE_NORTH: 35,
    TPE_NORTHEAST: 35,
    TPE_SOUTH: 10,
    NTPE_WEST: 25,
    NTPE_NORTHWEST: 30,
    NTPE_NORTHEAST: 40,
    NTPE_EAST: 20,
    NTPE_WESTEXT: 45,
    NTPE_COASTAL: 55,
  },
  NTPE_WEST: {
    TPE_EAST: 25,
    TPE_WEST: 20,
    TPE_NORTH: 30,
    TPE_NORTHEAST: 35,
    TPE_SOUTH: 25,
    NTPE_WEST: 10,
    NTPE_NORTHWEST: 20,
    NTPE_NORTHEAST: 40,
    NTPE_EAST: 25,
    NTPE_WESTEXT: 25,
    NTPE_COASTAL: 45,
  },
  NTPE_NORTHWEST: {
    TPE_EAST: 20,
    TPE_WEST: 15,
    TPE_NORTH: 20,
    TPE_NORTHEAST: 30,
    TPE_SOUTH: 30,
    NTPE_WEST: 20,
    NTPE_NORTHWEST: 10,
    NTPE_NORTHEAST: 35,
    NTPE_EAST: 30,
    NTPE_WESTEXT: 30,
    NTPE_COASTAL: 40,
  },
  NTPE_NORTHEAST: {
    TPE_EAST: 30,
    TPE_WEST: 35,
    TPE_NORTH: 35,
    TPE_NORTHEAST: 20,
    TPE_SOUTH: 40,
    NTPE_WEST: 40,
    NTPE_NORTHWEST: 35,
    NTPE_NORTHEAST: 10,
    NTPE_EAST: 45,
    NTPE_WESTEXT: 55,
    NTPE_COASTAL: 55,
  },
  NTPE_EAST: {
    TPE_EAST: 30,
    TPE_WEST: 30,
    TPE_NORTH: 40,
    TPE_NORTHEAST: 40,
    TPE_SOUTH: 20,
    NTPE_WEST: 25,
    NTPE_NORTHWEST: 30,
    NTPE_NORTHEAST: 45,
    NTPE_EAST: 10,
    NTPE_WESTEXT: 40,
    NTPE_COASTAL: 60,
  },
  NTPE_WESTEXT: {
    TPE_EAST: 40,
    TPE_WEST: 35,
    TPE_NORTH: 35,
    TPE_NORTHEAST: 50,
    TPE_SOUTH: 45,
    NTPE_WEST: 25,
    NTPE_NORTHWEST: 30,
    NTPE_NORTHEAST: 55,
    NTPE_EAST: 40,
    NTPE_WESTEXT: 10,
    NTPE_COASTAL: 50,
  },
  NTPE_COASTAL: {
    TPE_EAST: 45,
    TPE_WEST: 40,
    TPE_NORTH: 35,
    TPE_NORTHEAST: 50,
    TPE_SOUTH: 55,
    NTPE_WEST: 45,
    NTPE_NORTHWEST: 40,
    NTPE_NORTHEAST: 55,
    NTPE_EAST: 60,
    NTPE_WESTEXT: 50,
    NTPE_COASTAL: 10,
  },
}

// 機場 → Zone travel time（桃園、松山）
const AIRPORT_TO_ZONE: Record<string, Record<string, number>> = {
  AIRPORT_TPE: {
    TPE_EAST: 50,
    TPE_WEST: 45,
    TPE_NORTH: 55,
    TPE_NORTHEAST: 55,
    TPE_SOUTH: 55,
    NTPE_WEST: 40,
    NTPE_NORTHWEST: 35,
    NTPE_NORTHEAST: 60,
    NTPE_EAST: 50,
    NTPE_WESTEXT: 20,
    NTPE_COASTAL: 70,
  },
  AIRPORT_TSA: {
    TPE_EAST: 15,
    TPE_WEST: 20,
    TPE_NORTH: 20,
    TPE_NORTHEAST: 25,
    TPE_SOUTH: 30,
    NTPE_WEST: 30,
    NTPE_NORTHWEST: 25,
    NTPE_NORTHEAST: 30,
    NTPE_EAST: 35,
    NTPE_WESTEXT: 45,
    NTPE_COASTAL: 50,
  },
}

// Zone → 機場（用同一組值，對稱）
const ZONE_TO_AIRPORT: Record<string, Record<string, number>> = {
  TPE_EAST: { AIRPORT_TPE: 50, AIRPORT_TSA: 15 },
  TPE_WEST: { AIRPORT_TPE: 45, AIRPORT_TSA: 20 },
  TPE_NORTH: { AIRPORT_TPE: 55, AIRPORT_TSA: 20 },
  TPE_NORTHEAST: { AIRPORT_TPE: 55, AIRPORT_TSA: 25 },
  TPE_SOUTH: { AIRPORT_TPE: 55, AIRPORT_TSA: 30 },
  NTPE_WEST: { AIRPORT_TPE: 40, AIRPORT_TSA: 30 },
  NTPE_NORTHWEST: { AIRPORT_TPE: 35, AIRPORT_TSA: 25 },
  NTPE_NORTHEAST: { AIRPORT_TPE: 60, AIRPORT_TSA: 30 },
  NTPE_EAST: { AIRPORT_TPE: 50, AIRPORT_TSA: 35 },
  NTPE_WESTEXT: { AIRPORT_TPE: 20, AIRPORT_TSA: 45 },
  NTPE_COASTAL: { AIRPORT_TPE: 70, AIRPORT_TSA: 50 },
}

// 外縣市 → 桃園機場（長途，無尖峰加成）
const LONG_DISTANCE_TO_TPE: Record<string, number> = {
  TAOYUAN_CORE: 30,
  TAOYUAN_NORTH: 45,
  TAOYUAN_SOUTH: 60,
  HSINCHU: 80,
  MIAOLI: 110,
  YILAN_NORTH: 120,
  YILAN_SOUTH: 150,
}

// 完整的 Travel Time Matrix
export const TRAVEL_TIME_MATRIX: Record<string, Partial<Record<string, number>>> = {
  // 11 zone 內部
  ...INTERNAL_MATRIX,
  // 機場 → zone
  ...AIRPORT_TO_ZONE,
  // zone → 機場
  ...ZONE_TO_AIRPORT,
  // 外縣市 → 桃園機場
  ...Object.fromEntries(['TAOYUAN_CORE', 'TAOYUAN_NORTH', 'TAOYUAN_SOUTH', 'HSINCHU', 'MIAOLI', 'YILAN_NORTH', 'YILAN_SOUTH'].map(
    zone => [zone, { AIRPORT_TPE: LONG_DISTANCE_TO_TPE[zone] }]
  )),
}

// 取得矩陣值（帶時段倍率）
export function getTravelTimeEntry(from: string, to: string): number | undefined {
  return TRAVEL_TIME_MATRIX[from]?.[to]
}

// 根據車程時間取得距離分數（0-100）
export function getDistanceScore(travelMinutes: number): number {
  if (travelMinutes <= 10) return 100
  if (travelMinutes <= 20) return 85
  if (travelMinutes <= 35) return 65
  if (travelMinutes <= 50) return 35
  return 10
}
