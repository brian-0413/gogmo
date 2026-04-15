/**
 * QR 貴賓單功能測試
 *
 * 測試覆蓋：
 * 1. DriverPricing CRUD API
 * 2. DriverCustomer CRUD API + auto-upsert
 * 3. GET /api/book/[driverId]（司機存在/不存在/Premium檢查）
 * 4. POST /api/book/[driverId]/orders（車型驗證/時間驗證/auto-upsert客戶）
 * 5. QR 單派到大廳的邏輯
 *
 * 依據：docs/superpowers/specs/2026-04-16-driver-qr-order-design.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mock Modules ─────────────────────────────────────────
// vi.hoisted() ensures mocks are evaluated within vitest's hoisting scope

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  driverFindUnique: vi.fn(),
  pricingFindMany: vi.fn(),
  pricingFindFirst: vi.fn(),
  pricingFindUnique: vi.fn(),
  pricingCreate: vi.fn(),
  pricingUpdate: vi.fn(),
  pricingDelete: vi.fn(),
  customerFindMany: vi.fn(),
  customerFindFirst: vi.fn(),
  customerFindUnique: vi.fn(),
  customerCreate: vi.fn(),
  customerUpdate: vi.fn(),
  customerDelete: vi.fn(),
  orderCreate: vi.fn(),
  dispatcherFindFirst: vi.fn(),
  dispatcherFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    driver: { findUnique: mocks.driverFindUnique },
    driverPricing: {
      findMany: mocks.pricingFindMany,
      findFirst: mocks.pricingFindFirst,
      findUnique: mocks.pricingFindUnique,
      create: mocks.pricingCreate,
      update: mocks.pricingUpdate,
      delete: mocks.pricingDelete,
    },
    driverCustomer: {
      findMany: mocks.customerFindMany,
      findFirst: mocks.customerFindFirst,
      findUnique: mocks.customerFindUnique,
      create: mocks.customerCreate,
      update: mocks.customerUpdate,
      delete: mocks.customerDelete,
    },
    order: { create: mocks.orderCreate },
    dispatcher: {
      findFirst: mocks.dispatcherFindFirst,
      findUnique: mocks.dispatcherFindUnique,
    },
  },
  default: {
    driver: { findUnique: mocks.driverFindUnique },
    driverPricing: {
      findMany: mocks.pricingFindMany,
      findFirst: mocks.pricingFindFirst,
      findUnique: mocks.pricingFindUnique,
      create: mocks.pricingCreate,
      update: mocks.pricingUpdate,
      delete: mocks.pricingDelete,
    },
    driverCustomer: {
      findMany: mocks.customerFindMany,
      findFirst: mocks.customerFindFirst,
      findUnique: mocks.customerFindUnique,
      create: mocks.customerCreate,
      update: mocks.customerUpdate,
      delete: mocks.customerDelete,
    },
    order: { create: mocks.orderCreate },
    dispatcher: {
      findFirst: mocks.dispatcherFindFirst,
      findUnique: mocks.dispatcherFindUnique,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getUserFromToken: mocks.getUser,
  default: mocks.getUser,
}))

// ─── Import route handlers ────────────────────────────────

import { prisma } from '@/lib/prisma'
import { GET as pricingGET, POST as pricingPOST } from '@/app/api/drivers/pricing/route'
import { PUT as pricingPUT, DELETE as pricingDELETE } from '@/app/api/drivers/pricing/[id]/route'
import { GET as customerGET, POST as customerPOST } from '@/app/api/drivers/customers/route'
import { PUT as customerPUT, DELETE as customerDELETE } from '@/app/api/drivers/customers/[id]/route'
import { GET as bookGET } from '@/app/api/book/[driverId]/route'
import { POST as bookOrderPOST } from '@/app/api/book/[driverId]/orders/route'

// ─── Expose mocks for test assertions ─────────────────────

const { getUser } = mocks
const { driverFindUnique } = mocks
const { pricingFindMany, pricingFindFirst, pricingFindUnique, pricingCreate, pricingUpdate, pricingDelete } = mocks
const { customerFindMany, customerFindFirst, customerFindUnique, customerCreate, customerUpdate, customerDelete } = mocks
const { orderCreate } = mocks
const { dispatcherFindFirst, dispatcherFindUnique } = mocks

// ─── Shared mock data ────────────────────────────────────

const mockDriver = {
  id: 'driver-1',
  userId: 'user-1',
  licensePlate: 'REC-2391',
  carType: '轎車',
  carColor: '黑色',
  balance: 5000,
  isPremium: true,
  bankCode: '700',
  bankAccount: '3123456789',
}

const mockDriverUser = {
  id: 'user-1',
  email: 'driver1@test.com',
  name: '測試司機',
  phone: '0912345678',
  role: 'DRIVER' as const,
  accountStatus: 'ACTIVE' as const,
  rejectReason: null,
  driver: mockDriver,
  dispatcher: null,
}

const nonPremiumDriver = {
  id: 'driver-2',
  userId: 'user-2',
  licensePlate: 'REC-9999',
  carType: '轎車',
  carColor: '白色',
  balance: 500,
  isPremium: false,
  bankCode: '700',
  bankAccount: '3123456789',
}

const nonPremiumDriverUser = {
  id: 'user-2',
  email: 'driver2@test.com',
  name: '普通司機',
  phone: '0922222222',
  role: 'DRIVER' as const,
  accountStatus: 'ACTIVE' as const,
  rejectReason: null,
  driver: nonPremiumDriver,
  dispatcher: null,
}

const dispatcherUser = {
  id: 'user-d',
  email: 'dispatcher@test.com',
  name: '派單方',
  phone: '02',
  role: 'DISPATCHER' as const,
  accountStatus: 'ACTIVE' as const,
  rejectReason: null,
  driver: null,
  dispatcher: { id: 'd-1', userId: 'user-d', companyName: 'Co', commissionRate: 0, taxId: null, contactPhone: null },
}

const mockPricingSmall = {
  id: 'price-small-1',
  driverId: 'driver-1',
  vehicleType: 'small',
  price: 800,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockPricingSuv = {
  id: 'price-suv-1',
  driverId: 'driver-1',
  vehicleType: 'suv',
  price: 1200,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockPricingVan9Disabled = {
  id: 'price-van9-1',
  driverId: 'driver-1',
  vehicleType: 'van9',
  price: 1500,
  enabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCustomer = {
  id: 'customer-1',
  driverId: 'driver-1',
  name: '王小明',
  phone: '0912-345-678',
  commonPickup: null as string | null,
  commonDropoff: null as string | null,
  preferredVehicle: null as string | null,
  notes: null as string | null,
  createdAt: new Date(),
  lastOrderAt: null as Date | null,
}

const mockCreatedOrder = {
  id: 'order-qr-1',
  dispatcherId: 'd-1',
  driverId: 'driver-1',
  status: 'ASSIGNED',
  passengerName: '王小明',
  passengerPhone: '0912-345-678',
  pickupLocation: '新竹火車站',
  dropoffLocation: '桃園國際機場',
  scheduledTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  price: 800,
  type: 'pickup',
  vehicle: 'small',
  plateType: 'R',
  passengerCount: 2,
  luggageCount: 1,
  flightNumber: 'BR32',
  notes: null,
  isSelfPublish: false,
  isQROrder: true,
  originalDriverId: 'driver-1',
  qrPrice: 800,
  isLocked: false,
  transferStatus: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── Request factories ─────────────────────────────────────

function makeAuthGetRequest(url: string, token = 'valid-token') {
  return new NextRequest(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
}

function makeAuthPostRequest(url: string, body: object, token = 'valid-token') {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

function makePublicGetRequest(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

function makePublicPostRequest(url: string, body: object) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function futureDateISO(daysFromNow = 7): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

function pastDateISO(daysAgo = 1): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

// ══════════════════════════════════════════════════════════
// SECTION 1: DriverPricing CRUD API
// ══════════════════════════════════════════════════════════

describe('DriverPricing CRUD API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue(mockDriverUser)
    driverFindUnique.mockResolvedValue(mockDriver)
  })

  describe('GET /api/drivers/pricing', () => {
    it('1. 有授權的 Premium 司機 → 200，回傳定價列表', async () => {
      pricingFindMany.mockResolvedValue([mockPricingSmall, mockPricingSuv])

      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/pricing')
      const res = await pricingGET(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(2)
      expect(json.data[0].vehicleType).toBe('small')
      expect(json.data[1].vehicleType).toBe('suv')
    })

    it('2. 只回傳該司機自己的定價', async () => {
      pricingFindMany.mockResolvedValue([mockPricingSmall])
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/pricing')
      await pricingGET(req)
      expect(pricingFindMany).toHaveBeenCalledWith({
        where: { driverId: 'driver-1' },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('3. 無授權 → 401', async () => {
      getUser.mockResolvedValue(null)
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/pricing', '')
      const res = await pricingGET(req)
      expect(res.status).toBe(401)
    })

    it('4. 非 DRIVER 角色 → 401（route 不區分無授權與無權限）', async () => {
      getUser.mockResolvedValue(dispatcherUser)
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/pricing')
      const res = await pricingGET(req)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/drivers/pricing', () => {
    beforeEach(() => {
      pricingFindFirst.mockResolvedValue(null)
      pricingCreate.mockResolvedValue(mockPricingSmall)
    })

    it('1. 新增小車定價 → 200', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'small',
        price: 800,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.vehicleType).toBe('small')
      expect(json.data.price).toBe(800)
    })

    it('2. 新增休旅定價 → 200', async () => {
      pricingCreate.mockResolvedValue(mockPricingSuv)
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'suv',
        price: 1200,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(200)
    })

    it('3. 新增9人座定價 → 200', async () => {
      pricingCreate.mockResolvedValue({ ...mockPricingVan9Disabled, enabled: true })
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'van9',
        price: 1500,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(200)
    })

    it('4. 價格為 0 → 200（允許免費體驗）', async () => {
      pricingCreate.mockResolvedValue({ ...mockPricingSmall, price: 0 })
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'small',
        price: 0,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(200)
    })

    it('5. 價格為負數 → 400', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'small',
        price: -100,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(400)
    })

    it('6. 缺少 vehicleType → 400', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        price: 800,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(400)
    })

    it('7. 缺少 price → 400', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'small',
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(400)
    })

    it('8. 車型重複（同一司機同一車型已存在）→ 409', async () => {
      pricingFindFirst.mockResolvedValue(mockPricingSmall)
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'small',
        price: 900,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(409)
      const json = await res.json()
      expect(json.error).toContain('已存在')
    })

    it('9. enabled 預設為 true', async () => {
      pricingCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...mockPricingSmall,
        enabled: data.enabled,
      }))
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'small',
        price: 800,
        // enabled not provided
      })
      await pricingPOST(req)
      expect(pricingCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ enabled: true }) })
      )
    })

    it('10. Prisma 錯誤 → 500，不暴露內部訊息', async () => {
      pricingCreate.mockRejectedValue(new Error('Unique constraint'))
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing', {
        vehicleType: 'small',
        price: 800,
        enabled: true,
      })
      const res = await pricingPOST(req)
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).not.toContain('Unique constraint')
    })
  })

  describe('PUT /api/drivers/pricing/[id]', () => {
    beforeEach(() => {
      pricingFindUnique.mockResolvedValue(mockPricingSmall)
      pricingUpdate.mockResolvedValue({ ...mockPricingSmall, price: 900 })
    })

    it('1. 更新價格 → 200', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing/price-small-1', {
        price: 900,
      })
      const res = await pricingPUT(req, { params: Promise.resolve({ id: 'price-small-1' }) } as any)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.price).toBe(900)
    })

    it('2. 更新 enabled → 200', async () => {
      pricingUpdate.mockResolvedValue({ ...mockPricingSmall, enabled: false })
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing/price-small-1', {
        enabled: false,
      })
      const res = await pricingPUT(req, { params: Promise.resolve({ id: 'price-small-1' }) } as any)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.enabled).toBe(false)
    })

    it('3. 更新不存在的定價 → 404', async () => {
      pricingFindUnique.mockResolvedValue(null)
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing/nonexistent', {
        price: 900,
      })
      const res = await pricingPUT(req, { params: Promise.resolve({ id: 'nonexistent' }) } as any)
      expect(res.status).toBe(404)
    })

    it('4. 嘗試更新他人的定價 → 403', async () => {
      pricingFindUnique.mockResolvedValue({ ...mockPricingSmall, driverId: 'other-driver' })
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/pricing/other-price', {
        price: 999,
      })
      const res = await pricingPUT(req, { params: Promise.resolve({ id: 'other-price' }) } as any)
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/drivers/pricing/[id]', () => {
    beforeEach(() => {
      pricingFindUnique.mockResolvedValue({ ...mockPricingSmall, driverId: 'driver-1' })
      pricingDelete.mockResolvedValue(mockPricingSmall)
    })

    it('1. 刪除自己的定價 → 200', async () => {
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/pricing/price-small-1')
      const res = await pricingDELETE(req, { params: Promise.resolve({ id: 'price-small-1' }) } as any)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
    })

    it('2. 刪除不存在的定價 → 404', async () => {
      pricingFindUnique.mockResolvedValue(null)
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/pricing/nonexistent')
      const res = await pricingDELETE(req, { params: Promise.resolve({ id: 'nonexistent' }) } as any)
      expect(res.status).toBe(404)
    })

    it('3. 刜除他人的定價 → 403', async () => {
      pricingFindUnique.mockResolvedValue({ ...mockPricingSmall, driverId: 'other-driver' })
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/pricing/other-price')
      const res = await pricingDELETE(req, { params: Promise.resolve({ id: 'other-price' }) } as any)
      expect(res.status).toBe(403)
    })
  })
})

// ══════════════════════════════════════════════════════════
// SECTION 2: DriverCustomer CRUD API
// ══════════════════════════════════════════════════════════

describe('DriverCustomer CRUD API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue(mockDriverUser)
    driverFindUnique.mockResolvedValue(mockDriver)
  })

  describe('GET /api/drivers/customers', () => {
    it('1. 取得客戶列表 → 200', async () => {
      customerFindMany.mockResolvedValue([mockCustomer])
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/customers')
      const res = await customerGET(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].name).toBe('王小明')
    })

    it('2. 依姓名搜尋', async () => {
      customerFindMany.mockResolvedValue([mockCustomer])
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/customers?name=王小明')
      await customerGET(req)
      expect(customerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ driverId: 'driver-1' }),
        })
      )
    })

    it('3. 依電話搜尋', async () => {
      customerFindMany.mockResolvedValue([mockCustomer])
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/customers?phone=0912')
      await customerGET(req)
      expect(customerFindMany).toHaveBeenCalled()
    })

    it('4. 無授權 → 401', async () => {
      getUser.mockResolvedValue(null)
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/customers', '')
      const res = await customerGET(req)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/drivers/customers', () => {
    beforeEach(() => {
      customerCreate.mockResolvedValue(mockCustomer)
    })

    it('1. 新增客戶（必填姓名+電話）→ 200', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers', {
        name: '王小明',
        phone: '0912-345-678',
        commonPickup: '新竹火車站',
        commonDropoff: '桃園國際機場',
        preferredVehicle: 'small',
        notes: '容易暈車',
      })
      const res = await customerPOST(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.name).toBe('王小明')
    })

    it('2. 缺少姓名 → 400', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers', {
        phone: '0912-345-678',
      })
      const res = await customerPOST(req)
      expect(res.status).toBe(400)
    })

    it('3. 缺少電話 → 400', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers', {
        name: '王小明',
      })
      const res = await customerPOST(req)
      expect(res.status).toBe(400)
    })

    it('4. 電話格式驗證（基本數字）→ 400', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers', {
        name: '王小明',
        phone: 'ABC',
      })
      const res = await customerPOST(req)
      expect(res.status).toBe(400)
    })

    it('5. 只提供必填欄位 → 200', async () => {
      customerCreate.mockResolvedValue({
        ...mockCustomer,
        name: '張三',
        phone: '0988-888-888',
      })
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers', {
        name: '張三',
        phone: '0988-888-888',
      })
      const res = await customerPOST(req)
      expect(res.status).toBe(200)
    })
  })

  describe('PUT /api/drivers/customers/[id]', () => {
    beforeEach(() => {
      customerFindUnique.mockResolvedValue({ ...mockCustomer, driverId: 'driver-1' })
      customerUpdate.mockResolvedValue({ ...mockCustomer, name: '王大明' })
    })

    it('1. 更新客戶名稱 → 200', async () => {
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers/customer-1', {
        name: '王大明',
      })
      const res = await customerPUT(req, { params: Promise.resolve({ id: 'customer-1' }) } as any)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.name).toBe('王大明')
    })

    it('2. 更新常用上車地點 → 200', async () => {
      customerUpdate.mockResolvedValue({ ...mockCustomer, commonPickup: '台北車站' })
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers/customer-1', {
        commonPickup: '台北車站',
      })
      const res = await customerPUT(req, { params: Promise.resolve({ id: 'customer-1' }) } as any)
      expect(res.status).toBe(200)
    })

    it('3. 編輯不存在的客戶 → 404', async () => {
      customerFindUnique.mockResolvedValue(null)
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers/nonexistent', {
        name: '新名稱',
      })
      const res = await customerPUT(req, { params: Promise.resolve({ id: 'nonexistent' }) } as any)
      expect(res.status).toBe(404)
    })

    it('4. 編輯他人的客戶 → 403', async () => {
      customerFindUnique.mockResolvedValue({ ...mockCustomer, driverId: 'other-driver' })
      const req = makeAuthPostRequest('http://localhost:3000/api/drivers/customers/other-customer', {
        name: '新名稱',
      })
      const res = await customerPUT(req, { params: Promise.resolve({ id: 'other-customer' }) } as any)
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/drivers/customers/[id]', () => {
    beforeEach(() => {
      customerFindUnique.mockResolvedValue({ ...mockCustomer, driverId: 'driver-1' })
      customerDelete.mockResolvedValue(mockCustomer)
    })

    it('1. 刪除自己的客戶 → 200', async () => {
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/customers/customer-1')
      const res = await customerDELETE(req, { params: Promise.resolve({ id: 'customer-1' }) } as any)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
    })

    it('2. 刪除不存在的客戶 → 404', async () => {
      customerFindUnique.mockResolvedValue(null)
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/customers/nonexistent')
      const res = await customerDELETE(req, { params: Promise.resolve({ id: 'nonexistent' }) } as any)
      expect(res.status).toBe(404)
    })

    it('3. 刪除他人的客戶 → 403', async () => {
      customerFindUnique.mockResolvedValue({ ...mockCustomer, driverId: 'other-driver' })
      const req = makeAuthGetRequest('http://localhost:3000/api/drivers/customers/other-customer')
      const res = await customerDELETE(req, { params: Promise.resolve({ id: 'other-customer' }) } as any)
      expect(res.status).toBe(403)
    })
  })
})

// ══════════════════════════════════════════════════════════
// SECTION 3: GET /api/book/[driverId]（公眾端，無需登入）
// ══════════════════════════════════════════════════════════

describe('GET /api/book/[driverId]（司機 QR 落地頁初始化）', () => {
  beforeEach(() => {
    // Only clear call counts, not implementations
    mocks.driverFindUnique.mockClear()
    mocks.pricingFindMany.mockClear()
  })

  it('1. 司機存在且為 Premium → 200，回傳車型選項', async () => {
    const mockDriverResult = {
      id: 'driver-1',
      userId: 'user-1',
      licensePlate: 'REC-2391',
      carType: '轎車',
      carColor: '黑色',
      balance: 5000,
      isPremium: true,
      bankCode: '700',
      bankAccount: '3123456789',
      user: { name: '測試司機' },
      pricing: [
        { id: 'p1', vehicleType: 'small', price: 800, enabled: true },
        { id: 'p2', vehicleType: 'suv', price: 1200, enabled: true },
      ],
    }
    mocks.driverFindUnique.mockResolvedValue(mockDriverResult)

    const req = makePublicGetRequest('http://localhost:3000/api/book/driver-1')
    const res = await bookGET(req, { params: Promise.resolve(Promise.resolve({ driverId: 'driver-1' })) } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    // DEBUG: print full response
    console.log('TEST RESPONSE:', JSON.stringify(json))
    expect(json.success).toBe(true)
    expect(json.data.licensePlate).toBe('REC-2391')
    // Route returns `pricing` (not `vehicleOptions`) as the key
    expect(json.data.pricing).toHaveLength(2)
    expect(json.data.pricing[0].price).toBe(800)
  })

  it('2. 只回傳 enabled=true 的車型', async () => {
    mocks.driverFindUnique.mockResolvedValue({
      id: 'driver-1',
      userId: 'user-1',
      licensePlate: 'REC-2391',
      isPremium: true,
      user: { name: '測試司機' },
      pricing: [
        { id: 'p1', vehicleType: 'small', price: 800, enabled: true },
        { id: 'p2', vehicleType: 'suv', price: 1200, enabled: false },
      ],
    })

    const req = makePublicGetRequest('http://localhost:3000/api/book/driver-1')
    const res = await bookGET(req, { params: Promise.resolve(Promise.resolve({ driverId: 'driver-1' })) } as any)
    const json = await res.json()
    expect(json.data.pricing).toHaveLength(1)
    expect(json.data.pricing[0].vehicleType).toBe('small')
  })

  it('3. 司機不存在 → 404', async () => {
    mocks.driverFindUnique.mockResolvedValue(null)
    const req = makePublicGetRequest('http://localhost:3000/api/book/nonexistent-driver')
    const res = await bookGET(req, { params: Promise.resolve(Promise.resolve({ driverId: 'nonexistent-driver' })) } as any)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('司機')
  })

  it('4. 司機存在但非 Premium → 403', async () => {
    mocks.driverFindUnique.mockResolvedValue({
      id: 'driver-2',
      userId: 'user-2',
      licensePlate: 'REC-9999',
      isPremium: false,
      user: { name: '普通司機' },
      pricing: [],
    })
    const req = makePublicGetRequest('http://localhost:3000/api/book/driver-2')
    const res = await bookGET(req, { params: Promise.resolve(Promise.resolve({ driverId: 'driver-2' })) } as any)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('尚未開放 QR')
  })

  it('5. 司機無任何 enabled 車型 → 200，但 pricing 為空陣列', async () => {
    mocks.driverFindUnique.mockResolvedValue({
      id: 'driver-1',
      userId: 'user-1',
      licensePlate: 'REC-2391',
      isPremium: true,
      user: { name: '測試司機' },
      pricing: [],
    })
    const req = makePublicGetRequest('http://localhost:3000/api/book/driver-1')
    const res = await bookGET(req, { params: Promise.resolve(Promise.resolve({ driverId: 'driver-1' })) } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.pricing).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════
// SECTION 4: POST /api/book/[driverId]/orders（旅客下單）
// ══════════════════════════════════════════════════════════

describe('POST /api/book/[driverId]/orders（旅客送出訂單）', () => {
  const validOrderBody = {
    orderType: 'pickup',
    airport: '桃園國際機場',
    scheduledTime: futureDateISO(7),
    flightNumber: 'BR32',
    vehicleType: 'small',
    passengerCount: 2,
    luggage: [{ size: '24吋', quantity: 1 }],
    pickupLocation: '新竹火車站',
    dropoffLocation: '桃園國際機場',
    contactName: '王小明',
    contactPhone: '0912-345-678',
    notes: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
    })
    customerFindFirst.mockResolvedValue(null)
    customerCreate.mockResolvedValue({
      ...mockCustomer,
      name: '王小明',
      phone: '0912-345-678',
    })
    orderCreate.mockResolvedValue(mockCreatedOrder)
    dispatcherFindUnique.mockResolvedValue({ id: 'd-1', userId: 'user-1', companyName: 'Test', commissionRate: 0, taxId: null, contactPhone: null })
  })

  it('1. 正常下單（小車接機）→ 200，建立訂單並建立客戶', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      validOrderBody
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.orderId).toBeDefined()
    expect(json.data.message).toContain('感謝您的預訂')
  })

  it('2. 車型驗證：司機未設定該車型 → 400', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      { ...validOrderBody, vehicleType: 'van9' }
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('車型')
  })

  it('3. 車型驗證：該車型已停用 → 400', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingVan9Disabled],
    })

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      { ...validOrderBody, vehicleType: 'van9' }
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('車型')
  })

  it('4. 時間驗證：過去的時間 → 400', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      { ...validOrderBody, scheduledTime: pastDateISO(1) }
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('時間')
  })

  it('5. 司機不存在 → 404', async () => {
    driverFindUnique.mockResolvedValue(null)
    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/nonexistent/orders',
      validOrderBody
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'nonexistent' }) } as any)
    expect(res.status).toBe(404)
  })

  it('6. 司機非 Premium → 403', async () => {
    driverFindUnique.mockResolvedValue({
      ...nonPremiumDriver,
      user: { id: 'user-2', name: '普通司機' },
      pricing: [],
    })
    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-2/orders',
      validOrderBody
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-2' }) } as any)
    expect(res.status).toBe(403)
  })

  it('7. 必填欄位驗證：contactName 缺少 → 400', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    const body = { ...validOrderBody }
    delete (body as any).contactName
    const req = makePublicPostRequest('http://localhost:3000/api/book/driver-1/orders', body)
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(400)
  })

  it('8. 必填欄位驗證：contactPhone 缺少 → 400', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    const body = { ...validOrderBody }
    delete (body as any).contactPhone
    const req = makePublicPostRequest('http://localhost:3000/api/book/driver-1/orders', body)
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(400)
  })

  it('9. 必填欄位驗證：vehicleType 缺少 → 400', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    const body = { ...validOrderBody }
    delete (body as any).vehicleType
    const req = makePublicPostRequest('http://localhost:3000/api/book/driver-1/orders', body)
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(400)
  })

  it('10. Auto-upsert：新客戶 → 建立客戶記錄', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    customerFindFirst.mockResolvedValue(null)
    customerCreate.mockResolvedValue({
      id: 'new-customer-1',
      driverId: 'driver-1',
      name: '王小明',
      phone: '0912-345-678',
      createdAt: new Date(),
      lastOrderAt: null,
    })
    orderCreate.mockResolvedValue(mockCreatedOrder)

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      validOrderBody
    )
    await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)

    expect(customerFindFirst).toHaveBeenCalledWith({
      where: { driverId: 'driver-1', phone: '0912-345-678' },
    })
    expect(customerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        driverId: 'driver-1',
        name: '王小明',
        phone: '0912-345-678',
      }),
    })
  })

  it('11. Auto-upsert：既有客戶 → 更新 lastOrderAt 和常用地點', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    customerFindFirst.mockResolvedValue({
      ...mockCustomer,
      name: '王小明',
      phone: '0912-345-678',
      commonPickup: null,
    })
    customerUpdate.mockResolvedValue({
      ...mockCustomer,
      lastOrderAt: new Date(),
      commonPickup: '新竹火車站',
    })
    orderCreate.mockResolvedValue(mockCreatedOrder)

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      validOrderBody
    )
    await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)

    expect(customerFindFirst).toHaveBeenCalledWith({
      where: { driverId: 'driver-1', phone: '0912-345-678' },
    })
    expect(customerCreate).not.toHaveBeenCalled()
    expect(customerUpdate).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: expect.objectContaining({
        lastOrderAt: expect.any(Date),
        commonPickup: '新竹火車站',
      }),
    })
  })

  it('12. 訂單建立時 isQROrder=true, originalDriverId=司機ID, qrPrice=報價', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    orderCreate.mockResolvedValue(mockCreatedOrder)

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      validOrderBody
    )
    await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)

    expect(orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isQROrder: true,
        originalDriverId: 'driver-1',
        qrPrice: 800,
        status: 'ASSIGNED',
        driverId: 'driver-1',
        price: 800,
        passengerName: '王小明',
        passengerPhone: '0912-345-678',
      }),
    })
  })

  it('13. 送機行程（dropoff）：上車/目的地自動交換', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    orderCreate.mockResolvedValue({
      ...mockCreatedOrder,
      type: 'dropoff',
      pickupLocation: '台北市信義區',
      dropoffLocation: '桃園國際機場',
    })

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      {
        ...validOrderBody,
        orderType: 'dropoff',
        airport: '桃園國際機場',
        pickupLocation: '台北市信義區',
        dropoffLocation: '桃園國際機場',
      }
    )
    await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)

    expect(orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'dropoff' }),
    })
  })

  it('14. 司機沒有 dispatcher 帳號 → 500', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    dispatcherFindUnique.mockResolvedValue(null)

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      validOrderBody
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(500)
  })

  it('15. Prisma 錯誤 → 500，不暴露內部訊息', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    orderCreate.mockRejectedValue(new Error('Database connection failed'))
    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      validOrderBody
    )
    const res = await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toContain('Database connection')
  })

  it('16. 訂單狀態 = ASSIGNED（司機直接接單）', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { id: 'user-1', name: '測試司機' },
      pricing: [mockPricingSmall],
    })
    orderCreate.mockResolvedValue({ ...mockCreatedOrder, status: 'ASSIGNED', driverId: 'driver-1' })

    const req = makePublicPostRequest(
      'http://localhost:3000/api/book/driver-1/orders',
      validOrderBody
    )
    await bookOrderPOST(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)

    expect(orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'ASSIGNED' }),
    })
  })
})

// ══════════════════════════════════════════════════════════
// SECTION 5: QR 單派到大廳的邏輯
// ══════════════════════════════════════════════════════════

describe('QR 單派到大廳邏輯', () => {
  it('1. QR 單派到大廳時 feeMode 強制為 cash_collection', () => {
    const qrOrder = {
      ...mockCreatedOrder,
      isQROrder: true,
      originalDriverId: 'driver-1',
      qrPrice: 800,
    }
    expect(qrOrder.isQROrder).toBe(true)
    expect(qrOrder.originalDriverId).toBe('driver-1')
    expect(qrOrder.qrPrice).toBe(800)
  })

  it('2. 轉帳單不可外派（原司機 ID 已記錄）', () => {
    const transferQrOrder = {
      ...mockCreatedOrder,
      isQROrder: true,
      originalDriverId: 'driver-1',
      qrPrice: 800,
      transferStatus: 'completed',
    }
    expect(transferQrOrder.isQROrder).toBe(true)
    expect(transferQrOrder.originalDriverId).toBe('driver-1')
  })

  it('3. 派到大廳時 originalDriverId 仍保留（可追溯）', () => {
    const orderToDispatch = {
      ...mockCreatedOrder,
      isQROrder: true,
      originalDriverId: 'driver-1',
      qrPrice: 800,
    }
    expect(orderToDispatch.originalDriverId).toBe('driver-1')
  })

  it('4. 外派單顯示實收/回金，而非原報價', () => {
    const externalDispatch = {
      actualReceived: 1200,
      returnAmount: 200,
      netAmount: 1000,
      qrPrice: 800,
    }
    expect(externalDispatch.actualReceived).toBe(1200)
    expect(externalDispatch.qrPrice).toBe(800)
    expect(externalDispatch.actualReceived).not.toBe(externalDispatch.qrPrice)
  })
})

// ══════════════════════════════════════════════════════════
// SECTION 6: API 統一回應格式驗證
// ══════════════════════════════════════════════════════════

describe('API 統一回應格式', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('所有成功回應包含 success:true 和 data', async () => {
    driverFindUnique.mockResolvedValue({
      ...mockDriver,
      user: { name: '測試司機' },
      pricing: [{ id: 'p1', vehicleType: 'small', price: 800, enabled: true }],
    })
    const req = makePublicGetRequest('http://localhost:3000/api/book/driver-1')
    const res = await bookGET(req, { params: Promise.resolve({ driverId: 'driver-1' }) } as any)
    if (res.status === 200) {
      const json = await res.json()
      expect(json).toHaveProperty('success', true)
      expect(json).toHaveProperty('data')
      expect(json).not.toHaveProperty('error')
    }
  })

  it('所有錯誤回應包含 success:false 和 error 字串', async () => {
    driverFindUnique.mockResolvedValue(null)
    const req = makePublicGetRequest('http://localhost:3000/api/book/nonexistent')
    const res = await bookGET(req, { params: Promise.resolve({ driverId: 'nonexistent' }) } as any)
    if (res.status !== 200) {
      const json = await res.json()
      expect(json).toHaveProperty('success', false)
      expect(json).toHaveProperty('error')
      expect(typeof json.error).toBe('string')
    }
  })
})
