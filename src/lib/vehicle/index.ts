/**
 * gogmo 車型系統統一入口
 *
 * 使用原則：
 * - 所有車型相關邏輯一律從此模組 import
 * - 嚴禁在其他檔案中硬編碼車型字串（'small', '5人座' 等）
 * - 新增車型相關功能時，先在此模組擴充，再供他處使用
 */

// Types & enums
export {
  VehicleType,
  RequirementLevel,
  PlateType,
  ALL_VEHICLE_TYPES,
} from './types'

// Display labels
export {
  VEHICLE_LABELS,
  VEHICLE_LABELS_SHORT,
  REQUIREMENT_LABELS,
  PLATE_LABELS,
  VEHICLE_DROPDOWN_OPTIONS,
} from './labels'

// Specs & capacity
export {
  VEHICLE_SPECS,
  findMinimumVehicleType,
  type VehicleSpec,
} from './capacity'

// Compatibility logic
export {
  isVehicleCompatible,
  getCompatibleVehicleTypes,
} from './compatibility'

// AI parser dictionary
export {
  VEHICLE_PARSER_DICTIONARY,
  UNSPECIFIED_VEHICLE_MARKERS,
} from './parser-dictionary'

// Input normalization
export {
  normalizeVehicleInput,
  normalizeParserOutput,
  type NormalizedVehicle,
} from './normalize'
