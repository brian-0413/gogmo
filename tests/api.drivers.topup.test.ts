/**
 * POST /api/drivers/topup/create — 建立加值訂單
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDriver = {
  id: 'driver-1',
  userId: 'user-1',
  licensePlate: 'ABC-1234',
  bankCode: '700',
  bankAccount: '3123456',
  balance: 500,
}

const mockUser = {
  id: 'user-1',
  name: '測試司機',
  email: 'driver@test.com',
  phone: '0912345678',
  role: 'DRIVER' as const,
  driver: mockDriver,
}

// vi.hoisted() ensures mocks are evaluated within vitest's hoisting scope
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  topupCreate: vi.fn(),
  driverFindUnique: vi.fn(),
  encryptPayuni: vi.fn(() => ({
    EncryptInfo: 'mock-encrypt-info',
    HashInfo: 'mock-hash-info',
  })),
  getPayuniEndpoint: vi.fn(() => 'https://test.payuni.com.tw/webATM'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    topup: { create: mocks.topupCreate, findUnique: vi.fn() },
    driver: { findUnique: mocks.driverFindUnique, update: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  getUserFromToken: mocks.getUser,
}))

vi.mock('@/lib/payuni', () => ({
  encryptPayuni: mocks.encryptPayuni,
  getPayuniEndpoint: mocks.getPayuniEndpoint,
}))

import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/drivers/topup/create/route'

const $prisma = prisma as unknown as {
  topup: { create: typeof mocks.topupCreate; findUnique: ReturnType<typeof vi.fn> }
  driver: { findUnique: typeof mocks.driverFindUnique; update: ReturnType<typeof vi.fn> }
}

function makeRequest(body: object, token = 'valid-token') {
  return new NextRequest('http://localhost:3000/api/drivers/topup/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/drivers/topup/create', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue(mockUser)
    mocks.topupCreate.mockResolvedValue({ id: 'topup-1', amount: 1000, method: 'credit', status: 'pending' })
    mocks.driverFindUnique.mockResolvedValue({ ...mockDriver, user: mockUser })
  })

  it('1. credit 方式 → 回傳 PAYUNi 表單，含 3% 手續費', async () => {
    mocks.topupCreate.mockResolvedValue({ id: 'topup-1', amount: 1030, method: 'credit', status: 'pending' })
    mocks.driverFindUnique.mockResolvedValue({ ...mockDriver, user: mockUser })
    const req = makeRequest({ amount: 1000, method: 'credit' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.topupId).toBe('topup-1')
    expect(json.data.finalAmount).toBe(1030)
    expect(json.data.payuniUrl).toBe('https://test.payuni.com.tw/webATM')
    expect(json.data.formData.EncryptInfo).toBe('mock-encrypt-info')
  })

  it('2. credit 方式 amount=500 → finalAmount=515', async () => {
    mocks.topupCreate.mockResolvedValue({ id: 'topup-1', amount: 515, method: 'credit', status: 'pending' })
    mocks.driverFindUnique.mockResolvedValue({ ...mockDriver, user: mockUser })
    const req = makeRequest({ amount: 500, method: 'credit' })
    const res = await POST(req)
    const json = await res.json()
    expect(json.data.finalAmount).toBe(515)
  })

  it('3. transfer 方式 → 回傳 topupId，status=pending，無 PAYUNi', async () => {
    mocks.topupCreate.mockResolvedValue({ id: 'topup-transfer-1', amount: 1000, method: 'transfer', status: 'pending' })
    const req = makeRequest({ amount: 1000, method: 'transfer' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.topupId).toBe('topup-transfer-1')
    expect(json.data.method).toBe('transfer')
    expect(json.data.amount).toBe(1000)
    expect(json.data.payuniUrl).toBeUndefined()
  })

  it('4. amount < 100 → 400', async () => {
    const req = makeRequest({ amount: 50, method: 'credit' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('最低 100 元')
  })

  it('5. amount = 99 → 400', async () => {
    const req = makeRequest({ amount: 99, method: 'transfer' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('6. amount = 100 → 成功（最低門檻）', async () => {
    mocks.topupCreate.mockResolvedValue({ id: 'topup-1', amount: 103, method: 'credit', status: 'pending' })
    mocks.driverFindUnique.mockResolvedValue({ ...mockDriver, user: mockUser })
    const req = makeRequest({ amount: 100, method: 'credit' })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('7. 無效的 method → 400', async () => {
    const req = makeRequest({ amount: 1000, method: 'cash' as any })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('credit 或 transfer')
  })

  // Auth null test skipped: covered in api.orders.test.ts "No token → 401"

  it('9. 非司機角色 → 404', async () => {
    mocks.getUser.mockResolvedValue({ ...mockUser, role: 'DISPATCHER' as const, driver: null })
    const req = makeRequest({ amount: 1000, method: 'credit' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('10. Topup record 建立時 status 為 pending', async () => {
    mocks.topupCreate.mockResolvedValue({ id: 'topup-1', amount: 1000, method: 'transfer', status: 'pending' })
    const req = makeRequest({ amount: 1000, method: 'transfer' })
    await POST(req)
    expect(mocks.topupCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        driverId: 'driver-1',
        amount: 1000,
        method: 'transfer',
        status: 'pending',
      }),
    })
  })
})
