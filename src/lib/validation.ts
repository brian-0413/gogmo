// 訂單欄位長度驗證常數
// 用於 orders API routes，防止資料庫欄位溢位

import { MAX_ORDER_PRICE } from './constants'

export const MAX_FIELD_LENGTHS: Record<string, number> = {
  passengerName: 50,
  passengerPhone: 20,
  pickupLocation: 100,
  pickupAddress: 200,
  dropoffLocation: 100,
  dropoffAddress: 200,
  flightNumber: 20,
  note: 500,
  notes: 500,
  rawText: 1000,
}

// Re-export MAX_ORDER_PRICE for consumers that only import from validation
export { MAX_ORDER_PRICE }
