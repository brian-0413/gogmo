import { VehicleType, RequirementLevel } from './types'
import { VEHICLE_SPECS } from './capacity'

/**
 * 判斷司機是否可以接這張訂單
 *
 * 規則：
 * - EXACT：司機車型必須完全符合訂單車型
 * - MIN：司機車型 tier 須 >= 訂單車型 tier（例：訂單要 SEDAN_5，SUV_5/MPV_7/VAN_9 都可接）
 * - ANY：任何司機車型都可接（除非訂單指定 CUSTOM，CUSTOM 須由派單方手動指派）
 *
 * CUSTOM 處理：
 * - 訂單為 CUSTOM 時，預設不自動派發（需派單方手動選司機）
 * - 司機為 CUSTOM 時，僅能接 CUSTOM 訂單
 */
export function isVehicleCompatible(
  driverVehicle: VehicleType,
  orderVehicle: VehicleType,
  requirement: RequirementLevel
): boolean {
  // CUSTOM 必須完全相等（不參與升降級邏輯）
  if (driverVehicle === VehicleType.CUSTOM || orderVehicle === VehicleType.CUSTOM) {
    return driverVehicle === orderVehicle
  }

  switch (requirement) {
    case RequirementLevel.EXACT:
      return driverVehicle === orderVehicle

    case RequirementLevel.MIN: {
      const driverTier = VEHICLE_SPECS[driverVehicle]?.tier ?? 0
      const orderTier = VEHICLE_SPECS[orderVehicle]?.tier ?? 0
      return driverTier >= orderTier
    }

    case RequirementLevel.ANY:
      return true

    default:
      return false
  }
}

/**
 * 取得指定訂單可派發給的所有合適車型清單
 * 排程演算法可用此函式快速篩選候選司機
 */
export function getCompatibleVehicleTypes(
  orderVehicle: VehicleType,
  requirement: RequirementLevel
): VehicleType[] {
  return [
    VehicleType.SEDAN_5,
    VehicleType.SUV_5,
    VehicleType.MPV_7,
    VehicleType.VAN_9,
    VehicleType.CUSTOM,
  ].filter((driverType) => isVehicleCompatible(driverType, orderVehicle, requirement))
}
