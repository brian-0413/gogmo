/**
 * POST /api/orders/[id]/accept — 司機接單 API 整合測試
 *
 * 測試覆蓋：
 * 1. 正常接單（PUBLISHED）
 * 2. 正常接單（ASSIGNED → 自己）
 * 3. 衝突警告返回（未 skipWarning，有時間衝突）
 * 4. 衝突冷卻中 → 429
 * 5. 衝突冷卻已過 → 成功接單
 * 6. 點數不足 → 400
 * 7. 帳號未啟用 → 403
 * 8. 無銀行帳號 → 400
 * 9. 訂單不存在 → 404
 * 10. 訂單已指派給他人 → 400
 * 11. 訂單狀態非可接單 → 400
 * 12. 非司機角色 → 403
 * 13. 未授權 → 401
 * 14. 接單後扣 5% 平台費（floor）
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── vi.hoisted — 建立所有 mock 函式（確保 vi.mock 可參照）───

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  orderFindUnique: vi.fn(),
  orderFindMany: vi.fn(),
  orderUpdate: vi.fn(),
  driverFindUnique: vi.fn(),
  driverUpdate: vi.fn(),
  transactionCreate: vi.fn(),
  $transaction: vi.fn(),
  checkRateLimit: vi.fn(() => null),
  broadcastSquadEvent: vi.fn(),
  broadcastDispatcherEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: mocks.orderFindUnique,
      findMany: mocks.orderFindMany,
      update: mocks.orderUpdate,
    },
    driver: {
      findUnique: mocks.driverFindUnique,
      update: mocks.driverUpdate,
    },
    transaction: {
      create: mocks.transactionCreate,
    },
    $transaction: mocks.$transaction,
  },
  default: {
    order: { findUnique: mocks.orderFindUnique, findMany: mocks.orderFindMany, update: mocks.orderUpdate },
    driver: { findUnique: mocks.driverFindUnique, update: mocks.driverUpdate },
    transaction: { create: mocks.transactionCreate },
    $transaction: mocks.$transaction,
  },
}))

vi.mock('@/lib/auth', () => ({
  getUserFromToken: mocks.getUser,
}))

vi.mock('@/lib/api-utils', () => ({
  checkRateLimit: mocks.checkRateLimit,
}))

vi.mock('@/lib/sse-emitter', () => ({
  broadcastSquadEvent: mocks.broadcastSquadEvent,
  broadcastDispatcherEvent: mocks.broadcastDispatcherEvent,
  globalEmitter: { emit: vi.fn() },
}))

// ─── 動態 import（在 mock 之後）───

import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as {
  order: {
    findUnique: typeof mocks.orderFindUnique
    findMany: typeof mocks.orderFindMany
    update: typeof mocks.orderUpdate
  }
  driver: {
    findUnique: typeof mocks.driverFindUnique
    update: typeof mocks.driverUpdate
  }
  transaction: { create: typeof mocks.transactionCreate }
  $transaction: typeof mocks.$transaction
}

const mockGetUser = mocks.getUser

// ─── 工具函式 ────────────────────────────────────────────

function makeAcceptRequest(orderId: string, body: object = {}, token = 'valid-token'): NextRequest {
  return new NextRequest(`http://localhost:3000/api/orders/${orderId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.$transaction.mockReset()
})

// ─── 測試資料工廠 ───────────────────────────────────────

function makeDriver(overrides: Partial<{
  driverId: string
  userId: string
  balance: number
  bankCode: string | null
  bankAccount: string | null
  accountStatus: string
  lastConflictAcceptAt: Date | null
}> = {}) {
  const driverId = overrides.driverId ?? 'driver-1'
  const userId = overrides.userId ?? 'user-1'
  return {
    id: userId,
    email: 'driver@test.com',
    name: '測試司機',
    phone: '0912345678',
    role: 'DRIVER' as const,
    accountStatus: (overrides.accountStatus ?? 'ACTIVE') as 'PENDING_REVIEW' | 'ACTIVE',
    rejectReason: null,
    driver: {
      id: driverId,
      userId,
      licensePlate: 'TEST-1234',
      carType: '轎車',
      carColor: '黑色',
      balance: overrides.balance ?? 500,
      bankCode: overrides.bankCode ?? '700',
      bankAccount: overrides.bankAccount ?? '3123456789',
      accountStatus: (overrides.accountStatus ?? 'ACTIVE') as 'PENDING_REVIEW' | 'ACTIVE',
      isPremium: false,
      lastConflictAcceptAt: overrides.lastConflictAcceptAt ?? null,
    },
    dispatcher: null,
  }
}

function makeOrder(overrides: Partial<{
  id: string
  driverId: string | null
  status: string
  price: number
  type: string
  hoursFromNow: number
}> = {}) {
  const hoursFromNow = overrides.hoursFromNow ?? (7 * 24) // 預設 7 天後
  return {
    id: overrides.id ?? 'order-1',
    dispatcherId: 'disp-1',
    driverId: overrides.driverId ?? null,
    status: overrides.status ?? 'PUBLISHED',
    passengerName: '測試乘客',
    passengerPhone: '0912345678',
    pickupLocation: '桃園國際機場',
    dropoffLocation: '台北市信義區',
    scheduledTime: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
    price: overrides.price ?? 1200,
    type: overrides.type ?? 'pickup',
    vehicle: 'small',
    plateType: 'any',
    kenichiRequired: false,
    isSelfPublish: false,
    isLocked: false,
    transferStatus: 'pending',
  }
}

function makeConflictOrder(newOrderTime: Date) {
  // 衝突：30 分鐘後（與新單差距 30 分鐘 < 60 分鐘門檻）
  const conflictTime = new Date(newOrderTime.getTime() - 30 * 60 * 1000)
  return {
    id: 'conflict-existing',
    dispatcherId: 'disp-1',
    driverId: 'existing-driver',
    status: 'ACCEPTED',
    passengerName: '衝突乘客',
    passengerPhone: '0987654321',
    pickupLocation: 'x',
    dropoffLocation: 'y',
    scheduledTime: conflictTime,
    price: 800,
    type: 'dropoff',
    vehicle: 'small',
    plateType: 'any',
    kenichiRequired: false,
    isSelfPublish: false,
    isLocked: false,
    transferStatus: 'pending',
  }
}

// ─── 正常接單 ────────────────────────────────────────────

describe('POST /api/orders/[id]/accept — 正常接單', () => {
  it('1. PUBLISHED 訂單正常接單成功', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    const order = makeOrder()

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([]) // 無衝突

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => {
      mockPrisma.driver.findUnique.mockResolvedValue({ ...driver.driver, balance: 495 })
      mockPrisma.order.update.mockResolvedValue({
        ...order,
        status: 'ACCEPTED',
        driverId: 'driver-1',
        driver: { ...driver.driver, balance: 495 }, // include driver relation
      })
      return callback(mockPrisma)
    })

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.order.status).toBe('ACCEPTED')
    expect(json.data.platformFee).toBe(60) // floor(1200 * 0.05)
    expect(json.data.newBalance).toBe(495)
  })

  it('2. ASSIGNED 訂單由被指派司機接單成功', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    const order = makeOrder({
      driverId: 'driver-1',
      status: 'ASSIGNED',
      price: 800,
    })

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([])

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => {
      mockPrisma.driver.findUnique.mockResolvedValue({ ...driver.driver, balance: 460 })
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'ACCEPTED' })
      return callback(mockPrisma)
    })

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.order.status).toBe('ACCEPTED')
  })

  it('3. 接單後平台費為 price * 5%（floor）', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    const order = makeOrder({ price: 1000 })

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([])

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => {
      mockPrisma.driver.findUnique.mockResolvedValue({ ...driver.driver, balance: 450 })
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'ACCEPTED' })
      return callback(mockPrisma)
    })

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    const json = await res.json()
    expect(json.data.platformFee).toBe(50) // floor(1000 * 0.05)
  })

  it('4. price=19 時 floor(19*0.05)=0', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    const order = makeOrder({ price: 19 })

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([])

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => {
      mockPrisma.driver.findUnique.mockResolvedValue({ ...driver.driver, balance: 500 })
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'ACCEPTED' })
      return callback(mockPrisma)
    })

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    const json = await res.json()
    expect(json.data.platformFee).toBe(0) // floor(19 * 0.05) = 0
  })
})

// ─── 衝突警告 ────────────────────────────────────────────

describe('POST /api/orders/[id]/accept — 衝突警告', () => {
  it('5. 有衝突且 skipWarning=false → 返回 warning，不更新訂單', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    // 新單 1 小時後，衝突單 30 分鐘後 → 差距 30 分鐘 < 60 分鐘 = 衝突
    const order = makeOrder({ hoursFromNow: 1 })
    const conflictOrder = makeConflictOrder(order.scheduledTime)

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([conflictOrder])
    mockPrisma.driver.findUnique.mockResolvedValue({ ...driver.driver, balance: 500 })

    const req = makeAcceptRequest(order.id, {})
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.warning).toBeDefined()
    expect(json.data.warning).toContain('時間接近')
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  it('6. 有衝突且 skipWarning=true + 冷卻中（< 10s）→ 429', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const recentCooldown = new Date(Date.now() - 5 * 1000) // 5 秒前
    const driver = makeDriver()
    const order = makeOrder({ hoursFromNow: 1 })
    const conflictOrder = makeConflictOrder(order.scheduledTime)

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([conflictOrder])
    mockPrisma.driver.findUnique.mockResolvedValue({
      ...driver.driver,
      balance: 500,
      lastConflictAcceptAt: recentCooldown,
    })

    const req = makeAcceptRequest(order.id, { skipWarning: true })
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toContain('冷卻中')
    expect(json.error).toMatch(/\d+/)
  })

  it('7. 有衝突且 skipWarning=true + 冷卻已過（> 10s）→ 成功接單', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const oldCooldown = new Date(Date.now() - 15 * 1000) // 15 秒前
    const driver = makeDriver()
    const order = makeOrder({ hoursFromNow: 1 })
    const conflictOrder = makeConflictOrder(order.scheduledTime)

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([conflictOrder])

    // 冷卻檢查在 transaction 外，需要獨立的 driver.findUnique mock
    mockPrisma.driver.findUnique.mockResolvedValue({
      ...driver.driver,
      balance: 440,
      lastConflictAcceptAt: oldCooldown,
    })

    // 冷卻已過，直接接單
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => {
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'ACCEPTED' })
      return callback(mockPrisma)
    })

    const req = makeAcceptRequest(order.id, { skipWarning: true })
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.warning).toBeUndefined()
  })

  it('8. 無衝突行程 → 直接接單，不返回 warning', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    const order = makeOrder()

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([]) // 無衝突

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => {
      mockPrisma.driver.findUnique.mockResolvedValue({ ...driver.driver, balance: 460 })
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'ACCEPTED' })
      return callback(mockPrisma)
    })

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.warning).toBeUndefined()
  })
})

// ─── 失敗場景 ────────────────────────────────────────────

describe('POST /api/orders/[id]/accept — 失敗場景', () => {
  it('9. 點數不足（平台費 > 餘額）→ 400', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver({ balance: 10 })
    const order = makeOrder({ price: 10000 })

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([])

    mockPrisma.$transaction.mockImplementation(async () => {
      throw new Error('點數不足，需要 500 點')
    })

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('點數不足')
  })

  it('10. 帳號未啟用（PENDING_REVIEW）→ 403', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver({ accountStatus: 'PENDING_REVIEW' })
    const order = makeOrder()

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([])

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('審核')
  })

  it('11. 無銀行帳號（bankAccount=null）→ 400', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    driver.driver.bankAccount = null  // 直接覆寫繞過 ?? 運算
    const order = makeOrder()
    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([])

    // 交易內的 driver.findUnique（不影響銀行帳號檢查，純交易用途）
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => {
      mockPrisma.driver.findUnique.mockResolvedValue({ ...driver.driver, balance: 500 })
      mockPrisma.order.update.mockResolvedValue({ ...order, status: 'ACCEPTED' })
      return callback(mockPrisma)
    })

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('銀行帳號')
  })

  it('12. 訂單不存在 → 404', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const req = makeAcceptRequest('nonexistent-order-id')
    const res = await POST(req, { params: Promise.resolve({ id: 'nonexistent-order-id' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('找不到')
  })

  it('13. ASSIGNED 訂單但 driverId != 自己 → 400', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    const order = makeOrder({
      driverId: 'other-driver-999',
      status: 'ASSIGNED',
    })

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)
    mockPrisma.order.findMany.mockResolvedValue([])

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('指派給其他司機')
  })

  it('14. 訂單狀態為 ACCEPTED（非 PUBLISHED/ASSIGNED）→ 400', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const driver = makeDriver()
    const order = makeOrder({
      driverId: 'driver-1',
      status: 'ACCEPTED',
    })

    mockGetUser.mockResolvedValue(driver)
    mockPrisma.order.findUnique.mockResolvedValue(order)

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('無法接單')
  })

  it('15. 派單方（非司機）嘗試接單 → 403', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    const dispatcher = {
      id: 'disp-1',
      email: 'dispatcher@test.com',
      name: '派單方',
      phone: '0912345678',
      role: 'DISPATCHER' as const,
      accountStatus: 'ACTIVE' as const,
      rejectReason: null,
      driver: null,
      dispatcher: {
        id: 'disp-1',
        userId: 'user-disp',
        companyName: 'Co',
        commissionRate: 0,
        taxId: null,
        contactPhone: null,
      },
    }
    const order = makeOrder()

    mockGetUser.mockResolvedValue(dispatcher)
    mockPrisma.order.findUnique.mockResolvedValue(order)

    const req = makeAcceptRequest(order.id)
    const res = await POST(req, { params: Promise.resolve({ id: order.id }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('司機')
  })

  it('16. 未授權（無 token）→ 401', async () => {
    const { POST } = await import('@/app/api/orders/[id]/accept/route')

    mockGetUser.mockResolvedValue(null)

    const req = new NextRequest('http://localhost:3000/api/orders/test/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'test' }) })
    expect(res.status).toBe(401)
  })
})
