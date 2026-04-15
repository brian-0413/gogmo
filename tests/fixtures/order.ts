/**
 * Order 測試 Fixtures — 訂單相關的 mock 資料
 */

import type { OrderType, VehicleType } from '@/types'

export interface OrderFixture {
  id: string
  dispatcherId: string
  driverId: string | null
  status: 'PENDING' | 'PUBLISHED' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED'
  passengerName: string
  passengerPhone: string
  pickupLocation: string
  dropoffLocation: string
  scheduledTime: Date
  price: number
  type: OrderType
  vehicle: VehicleType
  plateType: 'R' | 'T' | 'any'
  kenichiRequired: boolean
  isSelfPublish: boolean
  isLocked: boolean
  transferStatus: string
}

/**
 * 建立可接單的 PUBLISHED 訂單
 */
export function createPublishedOrder(overrides: Partial<OrderFixture> = {}): OrderFixture {
  return {
    id: 'test-order-1',
    dispatcherId: 'test-dispatcher-1',
    driverId: null,
    status: 'PUBLISHED',
    passengerName: '測試乘客',
    passengerPhone: '0912345678',
    pickupLocation: '桃園國際機場',
    dropoffLocation: '台北市信義區',
    scheduledTime: futureDate(3),
    price: 1200,
    type: 'pickup',
    vehicle: 'small',
    plateType: 'any',
    kenichiRequired: false,
    isSelfPublish: false,
    isLocked: false,
    transferStatus: 'pending',
    ...overrides,
  }
}

/**
 * 建立司機已接單的 ACCEPTED 訂單
 */
export function createAcceptedOrder(driverId: string, overrides: Partial<OrderFixture> = {}): OrderFixture {
  return createPublishedOrder({
    driverId,
    status: 'ACCEPTED',
    ...overrides,
  })
}

/**
 * 建立 ASSIGNED 訂單（指派給特定司機）
 */
export function createAssignedOrder(driverId: string, overrides: Partial<OrderFixture> = {}): OrderFixture {
  return createPublishedOrder({
    driverId,
    status: 'ASSIGNED',
    ...overrides,
  })
}

/**
 * 建立衝突行程（用於 accept conflict 測試）
 */
export function createConflictOrder(overrides: Partial<OrderFixture> = {}): OrderFixture {
  // 3 小時後的訂單（新單如果 2 小時後，則 < 60 分鐘差 = 衝突）
  const now = new Date()
  const conflictTime = new Date(now.getTime() + 3 * 60 * 60 * 1000) // 3 小時後
  return createAcceptedOrder('conflict-driver-1', {
    id: 'conflict-order-1',
    scheduledTime: conflictTime,
    type: 'dropoff',
    ...overrides,
  })
}

// ─── 時間輔助 ───────────────────────────────────────────

function futureDate(daysFromNow: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d
}

/**
 * 行程前 6 小時（可退單）
 */
export function sixHoursFromNowDate(): Date {
  const d = new Date()
  d.setHours(d.getHours() + 6)
  return d
}

/**
 * 行程前 30 分鐘（鎖定期）
 */
export function thirtyMinsFromNowDate(): Date {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  return d
}
