// UI Display Constants — 統一全站種類/車型/狀態顯示用常數

import type { OrderType, VehicleType, PlateType } from '@/types'

// ============ 種類標籤 ============
export const TYPE_LABELS: Record<OrderType, string> = {
  pickup: '接機',
  dropoff: '送機',
  pickup_boat: '接船',
  dropoff_boat: '送船',
  transfer: '接駁',
  charter: '包車',
  pending: '待確認',
}

// ============ 車型標籤 ============
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  small: '小車',
  suv: '休旅車',
  van9: '9人座',
  any: '任意車型',
  any_r: '任意R牌',
  pending: '待確認',
}

// ============ 車牌標籤 ============
export const PLATETYPE_LABELS: Record<PlateType, string> = {
  R: 'R牌',
  T: 'T牌',
  any: '任意',
}

// ============ 種類標籤樣式（背景+文字色） ============
export const TYPE_COLORS: Record<OrderType, { bg: string; text: string }> = {
  pickup:       { bg: '#E6F1FB', text: '#0C447C' },
  dropoff:      { bg: '#FFF3E0', text: '#92400E' },
  pickup_boat:  { bg: '#E0F7FA', text: '#006064' },
  dropoff_boat: { bg: '#E0F7FA', text: '#006064' },
  transfer:     { bg: '#F4EFE9', text: '#717171' },
  charter:      { bg: '#F3E8FF', text: '#6B21A8' },
  pending:      { bg: '#F4EFE9', text: '#717171' },
}

// ============ 種類 Badge 樣式（字串 key，用於 type 可能為 string 的場景） ============
export const TYPE_TAG_STYLE: Record<string, string> = {
  pickup:       'bg-[#E6F1FB] text-[#0C447C]',
  dropoff:      'bg-[#FFF3E0] text-[#92400E]',
  pickup_boat:  'bg-[#E0F7FA] text-[#006064]',
  dropoff_boat: 'bg-[#E0F7FA] text-[#006064]',
  transfer:     'bg-[#F4EFE9] text-[#717171]',
  charter:      'bg-[#F3E8FF] text-[#6B21A8]',
  pending:      'bg-[#F4EFE9] text-[#717171]',
}

// ============ 狀態標籤 ============
export const STATUS_LABELS: Record<string, string> = {
  PENDING:     '待接單',
  PUBLISHED:   '待接單',
  ASSIGNED:    '已指派',
  ACCEPTED:    '已接單',
  IN_PROGRESS: '進行中',
  ARRIVED:     '已抵達',
  PICKED_UP:   '乘客已上車',
  COMPLETED:   '已完成',
  CANCELLED:   '已取消',
}

// ============ 狀態 Badge 樣式 ============
export const STATUS_TAG_STYLE: Record<string, string> = {
  PENDING:     'bg-[#FCEBEB] text-[#A32D2D]',
  PUBLISHED:   'bg-[#FCEBEB] text-[#A32D2D]',
  ASSIGNED:    'bg-[#FFF3E0] text-[#B45309]',
  ACCEPTED:    'bg-[#FFF3E0] text-[#B45309]',
  IN_PROGRESS: 'bg-[#E6F1FB] text-[#0C447C]',
  ARRIVED:     'bg-[#E6F1FB] text-[#0C447C]',
  PICKED_UP:   'bg-[#E6F1FB] text-[#0C447C]',
  COMPLETED:   'bg-[#E8F5E8] text-[#008A05]',
  CANCELLED:   'bg-[#FCEBEB] text-[#A32D2D]',
}

// ============ 業務規則常數 ============

/** 平台抽成比率（5%） */
export const PLATFORM_FEE_RATE = 0.05

/** 司機實得比率（1 - 平台抽成 = 95%） */
export const DRIVER_EARNINGS_RATE = 0.95

/** 取消訂單手續費比率（10%） */
export const CANCELLATION_FEE_RATE = 0.1

/** 轉單手續費比率（3%） */
export const TRANSFER_FEE_RATE = 0.03

/** 小隊鎖定小時數（行程前 N 小時鎖定） */
export const TRANSFER_LOCK_HOURS = 1

/** bonus 最低點數 */
export const MIN_BONUS_POINTS = 10

/** 每週結算目標（點數） */
export const WEEKLY_SETTLEMENT_TARGET = 5000

/** 新用戶贈送點數 */
export const NEW_USER_BONUS = 500

/** 訂單預設金額（當無法解析時） */
export const DEFAULT_ORDER_PRICE = 800

/** 最大訂單金額上限 */
export const MAX_ORDER_PRICE = 100000
