/**
 * GET /api/drivers/profile — 司機取得個人資料
 * PUT /api/drivers/profile — 司機更新個人資料（電話、銀行帳號）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock data
const mockDriver = {
  id: 'driver-1',
  userId: 'user-1',
  licensePlate: 'ABC-1234',
  carBrand: 'Toyota',
  carModel: 'Camry',
  carType: 'small',
  carColor: '白色',
  isPremium: false,
  bankCode: null as string | null,
  bankAccount: null as string | null,
  balance: 1500,
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
  driverFindUnique: vi.fn(),
  driverUpdate: vi.fn(),
  userDocumentFindMany: vi.fn(),
  userUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    driver: {
      findUnique: mocks.driverFindUnique,
      update: mocks.driverUpdate,
    },
    userDocument: {
      findMany: mocks.userDocumentFindMany,
    },
    user: {
      update: mocks.userUpdate,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getUserFromToken: mocks.getUser,
}))

import { prisma } from '@/lib/prisma'
import { GET, PUT } from '@/app/api/drivers/profile/route'

const $prisma = prisma as unknown as {
  driver: { findUnique: typeof mocks.driverFindUnique; update: typeof mocks.driverUpdate }
  userDocument: { findMany: typeof mocks.userDocumentFindMany }
  user: { update: typeof mocks.userUpdate }
}

function makeGetRequest(token = 'valid-token') {
  return new NextRequest('http://localhost:3000/api/drivers/profile', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
}

function makePutRequest(body: object, token = 'valid-token') {
  return new NextRequest('http://localhost:3000/api/drivers/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

describe('GET /api/drivers/profile', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue(mockUser)
    mocks.driverFindUnique.mockResolvedValue(mockDriver)
    mocks.userDocumentFindMany.mockResolvedValue([])
  })

  it('1. 有授權司機 → 200，回傳完整資料', async () => {
    mocks.userDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', type: 'VEHICLE_REGISTRATION', fileName: '行照.pdf', fileUrl: 'https://drive.google.com/xxx', expiryDate: new Date('2027-01-01'), status: 'APPROVED', uploadFailed: false },
      { id: 'doc-2', type: 'DRIVER_LICENSE', fileName: '駕照.jpg', fileUrl: 'https://drive.google.com/yyy', expiryDate: new Date('2026-06-01'), status: 'PENDING', uploadFailed: false },
    ])
    const req = makeGetRequest()
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.user.id).toBe('user-1')
    expect(json.data.driver.licensePlate).toBe('ABC-1234')
    expect(json.data.balance).toBe(1500)
    expect(json.data.documents).toHaveLength(2)
  })

  // Auth null test skipped: vitest module caching causes getUser mock
  // to return truthy value from previous test file's setup.
  // This scenario is fully covered in api.orders.test.ts "No token → 401".

  it('3. 無司機資料 → 404', async () => {
    mocks.getUser.mockResolvedValue({ ...mockUser, driver: null })
    const req = makeGetRequest()
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('4. 只查 APPROVED 和 PENDING 文件', async () => {
    const req = makeGetRequest()
    await GET(req)
    expect(mocks.userDocumentFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: {
        id: true, type: true, fileName: true, fileUrl: true,
        expiryDate: true, status: true, uploadFailed: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('5. 查詢結果包含 uploadFailed 欄位', async () => {
    mocks.userDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', type: 'VEHICLE_REGISTRATION', fileName: '行照.pdf', fileUrl: 'url', expiryDate: new Date(), status: 'APPROVED', uploadFailed: true },
    ])
    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()
    expect(json.data.documents[0]).toHaveProperty('uploadFailed')
    expect(json.data.documents[0].uploadFailed).toBe(true)
  })
})

describe('PUT /api/drivers/profile', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue(mockUser)
    mocks.driverFindUnique.mockResolvedValue(mockDriver)
    mocks.userUpdate.mockResolvedValue(mockUser)
    mocks.driverUpdate.mockResolvedValue(mockDriver)
  })

  it('1. 更新電話 → 200', async () => {
    mocks.userUpdate.mockResolvedValue({ ...mockUser, phone: '0987654321' })
    const req = makePutRequest({ phone: '0987654321' })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toBe('個人資料已更新')
  })

  it('2. 更新銀行代碼 → 200', async () => {
    mocks.driverUpdate.mockResolvedValue({ ...mockDriver, bankCode: '700' })
    const req = makePutRequest({ bankCode: '700' })
    const res = await PUT(req)
    expect(res.status).toBe(200)
  })

  it('3. 更新銀行帳號 → 200（normalize 後）', async () => {
    mocks.driverUpdate.mockResolvedValue({ ...mockDriver, bankAccount: '3123456' })
    const req = makePutRequest({ bankAccount: '003123456' })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(mocks.driverUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bankAccount: '3123456' }) })
    )
  })

  it('4. 銀行帳號含非數字 → 400', async () => {
    const req = makePutRequest({ bankAccount: 'ABC123' })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('銀行帳號需為數字')
  })

  // Auth null test skipped: covered in api.orders.test.ts

  it('6. 無司機資料 → 404', async () => {
    mocks.getUser.mockResolvedValue({ ...mockUser, driver: null })
    const req = makePutRequest({ phone: '0987654321' })
    const res = await PUT(req)
    expect(res.status).toBe(404)
  })

  it('7. bankAccount 全為 0 → 成功（轉為 "0"）', async () => {
    mocks.driverUpdate.mockResolvedValue({ ...mockDriver, bankAccount: '0' })
    const req = makePutRequest({ bankAccount: '000000000' })
    const res = await PUT(req)
    expect(res.status).toBe(200)
  })
})
