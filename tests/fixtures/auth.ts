/**
 * Auth 測試 Fixtures — 提供可重複使用的 mock user 物件
 *
 * 這些 fixtures 的設計與 prisma/seed.ts 保持一致。
 * 使用 test- 字首避免與真實資料衝突。
 */

import type { UserRole } from '@/types'

// ─── Driver Fixtures ─────────────────────────────────────

export interface DriverFixture {
  driverId: string
  userId: string
  licensePlate: string
  carType: string
  carColor: string
  balance: number
  bankCode: string | null
  bankAccount: string | null
  accountStatus: 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'
  isPremium: boolean
  lastConflictAcceptAt: Date | null
}

export interface UserFixture {
  id: string
  email: string
  name: string
  phone: string
  role: UserRole
  accountStatus: 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'
  rejectReason: string | null
  driver: DriverFixture | null
  dispatcher: DispatcherFixture | null
}

export interface DispatcherFixture {
  id: string
  userId: string
  companyName: string
  commissionRate: number
  taxId: string | null
  contactPhone: string | null
}

// ─── 工廠函式 ───────────────────────────────────────────

/**
 * 建立完整的 driver user（for getUserFromToken mock）
 */
export function createDriverUser(overrides: Partial<{
  driverId: string
  userId: string
  email: string
  name: string
  phone: string
  licensePlate: string
  carType: string
  carColor: string
  balance: number
  bankCode: string
  bankAccount: string
  accountStatus: 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'
  isPremium: boolean
  lastConflictAcceptAt: Date | null
}> = {}): UserFixture {
  const driverId = overrides.driverId ?? 'test-driver-1'
  const userId = overrides.userId ?? 'test-user-driver-1'

  const driverDefaults: DriverFixture = {
    driverId,
    userId,
    licensePlate: 'TEST-1234',
    carType: '轎車',
    carColor: '黑色',
    balance: 500,
    bankCode: '700',
    bankAccount: '3123456789',
    accountStatus: 'ACTIVE',
    isPremium: false,
    lastConflictAcceptAt: null,
  }

  const driver = { ...driverDefaults, ...overrides }

  return {
    id: userId,
    email: overrides.email ?? 'driver1@test.com',
    name: overrides.name ?? '測試司機',
    phone: overrides.phone ?? '0912345678',
    role: 'DRIVER',
    accountStatus: driver.accountStatus,
    rejectReason: null,
    driver,
    dispatcher: null,
  }
}

/**
 * 建立完整的 dispatcher user
 */
export function createDispatcherUser(overrides: Partial<{
  dispatcherId: string
  userId: string
  email: string
  name: string
  phone: string
  companyName: string
  commissionRate: number
  accountStatus: 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'
}> = {}): UserFixture {
  const dispatcherId = overrides.dispatcherId ?? 'test-dispatcher-1'
  const userId = overrides.userId ?? 'test-user-dispatcher-1'

  const dispatcherDefaults: DispatcherFixture = {
    id: dispatcherId,
    userId,
    companyName: '測試派單方',
    commissionRate: 0,
    taxId: null,
    contactPhone: '0223456789',
  }

  const dispatcher = { ...dispatcherDefaults, ...overrides }

  return {
    id: userId,
    email: overrides.email ?? 'dispatcher1@test.com',
    name: overrides.name ?? '測試派單方',
    phone: overrides.phone ?? '0223456789',
    role: 'DISPATCHER',
    accountStatus: (overrides.accountStatus ?? 'ACTIVE') as 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED',
    rejectReason: null,
    driver: null,
    dispatcher,
  }
}

/**
 * 建立 admin user
 */
export function createAdminUser(): UserFixture {
  return {
    id: 'test-admin-1',
    email: 'admin@test.com',
    name: '測試管理員',
    phone: '0911111111',
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
    rejectReason: null,
    driver: null,
    dispatcher: null,
  }
}

// ─── 預設 driver（用於大部分測試）───────────────────────

/** 正常可接單的司機 */
export const defaultDriverUser = createDriverUser()

/** 無銀行帳號的司機（接單門檻失敗） */
export const driverWithoutBank = createDriverUser({
  bankCode: undefined,
  bankAccount: undefined,
})

/** 帳號未啟用的司機 */
export const inactiveDriver = createDriverUser({
  accountStatus: 'PENDING_REVIEW',
})

/** 餘額不足的司機 */
export const lowBalanceDriver = createDriverUser({
  balance: 10, // 小於 5% platform fee
})

/** 有衝突行程的司機（accept 需返回警告）*/
export const driverWithConflict = createDriverUser()

/** Premium 司機 */
export const premiumDriver = createDriverUser({
  isPremium: true,
  balance: 5000,
})

/** 預設派單方 */
export const defaultDispatcherUser = createDispatcherUser()
