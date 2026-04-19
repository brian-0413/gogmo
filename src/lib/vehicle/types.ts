/**
 * 車型代號（單一真理之源）
 *
 * 設計原則：
 * - 大寫 SCREAMING_SNAKE_CASE 與 Prisma enum 一致
 * - 命名包含座位數，未來擴充直觀（例如未來可加 MINIBUS_11）
 * - SUV_5 包含 7 人座 SUV（因 7 人座 SUV 行李空間不足，業務上視為 5 人座）
 * - CUSTOM 用於 VITO / GRANVIA / Alphard 等需自由描述的車款
 */
export const VehicleType = {
  SEDAN_5: 'SEDAN_5',
  SUV_5: 'SUV_5',
  MPV_7: 'MPV_7',
  VAN_9: 'VAN_9',
  CUSTOM: 'CUSTOM',
} as const

export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType]

/** 所有車型的完整列表（按等級由低到高排序） */
export const ALL_VEHICLE_TYPES: readonly VehicleType[] = [
  VehicleType.SEDAN_5,
  VehicleType.SUV_5,
  VehicleType.MPV_7,
  VehicleType.VAN_9,
  VehicleType.CUSTOM,
] as const

/**
 * 派單方對車型的要求嚴格度
 *
 * - EXACT: 必須是這個車型（例：派單 MPV_7，只接受 MPV_7 司機）
 * - MIN:   最低需求，可派更高等級（例：派單 SEDAN_5 但 MIN，SUV_5/MPV_7/VAN_9 都可接）
 * - ANY:   任意車型（最寬鬆，等同於原本的 any）
 */
export const RequirementLevel = {
  EXACT: 'EXACT',
  MIN: 'MIN',
  ANY: 'ANY',
} as const

export type RequirementLevel = (typeof RequirementLevel)[keyof typeof RequirementLevel]

/**
 * 車牌類型
 *
 * - RENTAL: R 牌租賃車（一般情況均派給此類司機）
 * - TAXI:   T 牌計程車（目前法規禁止接機，但保留給未來開放使用；
 *           部分派單方在缺車時會主動勾選接受 T 牌）
 */
export const PlateType = {
  RENTAL: 'RENTAL',
  TAXI: 'TAXI',
} as const

export type PlateType = (typeof PlateType)[keyof typeof PlateType]
