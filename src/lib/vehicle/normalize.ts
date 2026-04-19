import { VehicleType, RequirementLevel } from './types'
import {
  VEHICLE_PARSER_DICTIONARY,
  UNSPECIFIED_VEHICLE_MARKERS,
} from './parser-dictionary'

export interface NormalizedVehicle {
  /** 標準車型代號（null = 派單方未指定） */
  vehicleType: VehicleType | null
  /** 派單方要求嚴格度 */
  requirement: RequirementLevel
  /** 若為 CUSTOM，車款描述（由原始輸入字串轉錄） */
  customVehicleNote: string | null
}

/**
 * 將任意輸入字串 normalize 為標準車型結構
 *
 * 處理邏輯：
 * 1. 空字串 / null / undefined → 未指定（ANY）
 * 2. 命中「未指定」標記（any/any_r/pending/任意…） → 未指定（ANY）
 * 3. 命中字典 → 標準代號（CUSTOM 時保留原字串為 customVehicleNote）
 * 4. 都不符合 → 視為 CUSTOM，原字串存入 customVehicleNote
 *
 * 此函式為 idempotent（多次呼叫結果相同）
 */
export function normalizeVehicleInput(input: string | null | undefined): NormalizedVehicle {
  // 空值 → 未指定
  if (!input || input.trim() === '') {
    return { vehicleType: null, requirement: RequirementLevel.ANY, customVehicleNote: null }
  }

  const trimmed = input.trim()

  // 「未指定」標記
  if (UNSPECIFIED_VEHICLE_MARKERS.includes(trimmed as any)) {
    return { vehicleType: null, requirement: RequirementLevel.ANY, customVehicleNote: null }
  }

  // 字典查詢（先精確比對，再嘗試部分比對）
  const exactMatch = VEHICLE_PARSER_DICTIONARY[trimmed]
  if (exactMatch) {
    return {
      vehicleType: exactMatch,
      requirement: RequirementLevel.EXACT,
      customVehicleNote: exactMatch === VehicleType.CUSTOM ? trimmed : null,
    }
  }

  // 部分比對（包含關鍵字）
  for (const [keyword, type] of Object.entries(VEHICLE_PARSER_DICTIONARY)) {
    if (trimmed.includes(keyword)) {
      return {
        vehicleType: type,
        requirement: RequirementLevel.EXACT,
        customVehicleNote: type === VehicleType.CUSTOM ? trimmed : null,
      }
    }
  }

  // 完全不認識 → CUSTOM（保留原字串）
  return {
    vehicleType: VehicleType.CUSTOM,
    requirement: RequirementLevel.EXACT,
    customVehicleNote: trimmed,
  }
}

/**
 * 從 Parser 輸出 normalize 為標準結構
 * （Parser 已輸出結構化資料，此函式做最終驗證與轉換）
 */
export function normalizeParserOutput(parserOutput: {
  vehicle_type?: string | null
}): NormalizedVehicle {
  return normalizeVehicleInput(parserOutput.vehicle_type)
}
