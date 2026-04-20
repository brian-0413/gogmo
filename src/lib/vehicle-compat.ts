/**
 * 向後相容 re-export（Phase 2-3 過渡期使用）
 * 新程式碼請直接從 @/lib/vehicle 或 @/lib/constants import
 */

// 從 constants.ts re-export（OrderCard、DispatcherOrderCard 等需要向後相容）
export { VEHICLE_LABELS, TYPE_COLORS, TYPE_LABELS, STATUS_LABELS, STATUS_TAG_STYLE, TYPE_TAG_STYLE, TRANSFER_FEE_RATE } from '@/lib/constants'

// 從 @/lib/vehicle re-export VehicleType（允許從此檔案 import VehicleType）
export { VehicleType } from '@/lib/vehicle'