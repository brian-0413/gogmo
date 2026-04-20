import { VehicleType, RequirementLevel, PlateType } from './types'

/** 車型中文顯示名稱（給 UI 與通知文字使用） */
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  [VehicleType.SEDAN_5]: '5 人座',
  [VehicleType.SUV_5]: '5 人座休旅',
  [VehicleType.MPV_7]: '7 人座 MPV',
  [VehicleType.VAN_9]: '9 人座',
  [VehicleType.CUSTOM]: '自訂車款',
}

/** 車型簡短顯示（適合空間小的場合，例如卡片角落、列表） */
export const VEHICLE_LABELS_SHORT: Record<VehicleType, string> = {
  [VehicleType.SEDAN_5]: '5 人',
  [VehicleType.SUV_5]: '休旅',
  [VehicleType.MPV_7]: '7 人',
  [VehicleType.VAN_9]: '9 人',
  [VehicleType.CUSTOM]: '自訂',
}

export const REQUIREMENT_LABELS: Record<RequirementLevel, string> = {
  [RequirementLevel.EXACT]: '指定車型',
  [RequirementLevel.MIN]: '最低需求',
  [RequirementLevel.ANY]: '任意車型',
}

export const PLATE_LABELS: Record<PlateType, string> = {
  [PlateType.RENTAL]: 'R 牌（租賃車）',
  [PlateType.TAXI]: 'T 牌（計程車）',
}

/** 派單方下拉選單選項（按 UI 顯示順序） */
export const VEHICLE_DROPDOWN_OPTIONS = [
  { value: VehicleType.SEDAN_5, label: VEHICLE_LABELS[VehicleType.SEDAN_5] },
  { value: VehicleType.SUV_5, label: VEHICLE_LABELS[VehicleType.SUV_5] },
  { value: VehicleType.MPV_7, label: VEHICLE_LABELS[VehicleType.MPV_7] },
  { value: VehicleType.VAN_9, label: VEHICLE_LABELS[VehicleType.VAN_9] },
  { value: 'ANY', label: '任意車型' },
  { value: VehicleType.CUSTOM, label: VEHICLE_LABELS[VehicleType.CUSTOM] },
] as const
