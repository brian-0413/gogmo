import { VehicleType } from './types'

/**
 * 車型基本規格
 *
 * 注意：CUSTOM 為自訂車款，無法預先得知座位數
 *       （派單方在 Order.customVehicleNote 中自行註明）
 */
export interface VehicleSpec {
  /** 標準座位數 */
  seats: number
  /** 滿座時可載行李數（27 吋大行李箱） */
  luggage: number
  /** 排程演算法用的「車型等級」(數字越大代表越高階) */
  tier: number
}

export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec | null> = {
  [VehicleType.SEDAN_5]: { seats: 5, luggage: 2, tier: 1 },
  [VehicleType.SUV_5]: { seats: 5, luggage: 3, tier: 2 },
  [VehicleType.MPV_7]: { seats: 7, luggage: 4, tier: 3 },
  [VehicleType.VAN_9]: { seats: 9, luggage: 6, tier: 4 },
  [VehicleType.CUSTOM]: null, // 由派單方自填
}

/**
 * 根據人數與行李數，找出可承載的最低車型
 * 排程演算法可呼叫此函式做車型推薦
 */
export function findMinimumVehicleType(
  passengerCount: number,
  luggageCount: number
): VehicleType | null {
  for (const type of [
    VehicleType.SEDAN_5,
    VehicleType.SUV_5,
    VehicleType.MPV_7,
    VehicleType.VAN_9,
  ]) {
    const spec = VEHICLE_SPECS[type]
    if (spec && spec.seats >= passengerCount && spec.luggage >= luggageCount) {
      return type
    }
  }
  return null // 沒有任何車型能容納，需走 CUSTOM
}
