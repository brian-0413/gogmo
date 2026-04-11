/**
 * GET /api/cron/check-document-expiry — 每日檢查司機文件過期
 *
 * 覆蓋情境：
 * 1. 無過期文件 → 200，expiredCount=0
 * 2. 有過期文件 → 帳號停用（REJECTED）
 * 3. 同一司機多個文件過期 → 一次更新、多個 expiredTypes
 * 4. 兩個司機各自有過期文件 → 各自更新
 * 5. 無效的 cron secret → 401
 * 6. 查詢只限 DRIVER 且 ACTIVE 且 APPROVED 文件
 */


import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted() runs at vitest hoisting time (before imports execute)
// Set CRON_SECRET here so it's captured when the route module loads via import
vi.hoisted(() => {
  process.env.CRON_SECRET = 'valid-cron-secret'
})

// vi.hoisted() ensures mocks are evaluated within vitest's hoisting scope
const mocks = vi.hoisted(() => ({
  userDocumentFindMany: vi.fn(),
  userUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userDocument: { findMany: mocks.userDocumentFindMany },
    user: { update: mocks.userUpdate },
  },
}))

import { GET } from '@/app/api/cron/check-document-expiry/route'

function makeRequest(secret = 'valid-cron-secret') {
  return new NextRequest('http://localhost:3000/api/cron/check-document-expiry', {
    method: 'GET',
    headers: { 'x-cron-secret': secret },
  })
}

beforeEach(() => {
  mocks.userDocumentFindMany.mockClear()
  mocks.userUpdate.mockClear()
})

describe('GET /api/cron/check-document-expiry', () => {
  it('1. 無過期文件 → 200，expiredCount=0', async () => {
    mocks.userDocumentFindMany.mockResolvedValue([])

    const req = makeRequest()
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.expiredCount).toBe(0)
    expect(json.affectedDrivers).toHaveLength(0)
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it('2. 有過期文件 → 帳號停用，rejectReason 含文件類型', async () => {
    mocks.userDocumentFindMany.mockResolvedValue([
      { id: 'doc-expired-1', userId: 'user-driver-1', type: 'DRIVER_LICENSE', user: { id: 'user-driver-1', name: '王小明', email: 'driver@test.com' } },
    ])
    mocks.userUpdate.mockResolvedValue({ id: 'user-driver-1', accountStatus: 'REJECTED' })

    const req = makeRequest()
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.expiredCount).toBe(1)
    expect(json.affectedDrivers).toHaveLength(1)
    expect(json.affectedDrivers[0].name).toBe('王小明')
    expect(json.affectedDrivers[0].expiredTypes).toContain('駕照')

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-driver-1' },
      data: { accountStatus: 'REJECTED', rejectReason: '文件已過期：駕照' },
    })
  })

  it('3. 同一司機多個文件過期 → 只更新一次，expiredTypes 含所有類型', async () => {
    mocks.userDocumentFindMany.mockResolvedValue([
      { id: 'doc-license', userId: 'user-driver-1', type: 'DRIVER_LICENSE', user: { id: 'user-driver-1', name: '王小明', email: 'driver@test.com' } },
      { id: 'doc-reg', userId: 'user-driver-1', type: 'VEHICLE_REGISTRATION', user: { id: 'user-driver-1', name: '王小明', email: 'driver@test.com' } },
    ])
    mocks.userUpdate.mockResolvedValue({ id: 'user-driver-1', accountStatus: 'REJECTED' })

    const req = makeRequest()
    const res = await GET(req)
    const json = await res.json()
    expect(json.expiredCount).toBe(2)
    expect(json.affectedDrivers).toHaveLength(1)
    expect(json.affectedDrivers[0].expiredTypes).toContain('駕照')
    expect(json.affectedDrivers[0].expiredTypes).toContain('行照')

    // user.update 被呼叫 2 次（每個過期文件各一次）
    expect(mocks.userUpdate).toHaveBeenCalledTimes(2)
  })

  it('4. 兩個司機各自有過期文件 → 各自更新', async () => {
    mocks.userDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', userId: 'user-driver-1', type: 'DRIVER_LICENSE', user: { id: 'user-driver-1', name: '王小明', email: 'driver1@test.com' } },
      { id: 'doc-2', userId: 'user-driver-2', type: 'INSURANCE', user: { id: 'user-driver-2', name: '陳大明', email: 'driver2@test.com' } },
    ])
    mocks.userUpdate.mockResolvedValue({ id: '', accountStatus: 'REJECTED' })

    const req = makeRequest()
    const res = await GET(req)
    const json = await res.json()
    expect(json.expiredCount).toBe(2)
    expect(json.affectedDrivers).toHaveLength(2)
    expect(mocks.userUpdate).toHaveBeenCalledTimes(2)
  })

  it('5. 無效的 cron secret → 401', async () => {
    const req = makeRequest('wrong-secret')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('6. 查詢只限 DRIVER 且 ACTIVE 且 APPROVED 文件', async () => {
    mocks.userDocumentFindMany.mockResolvedValue([])

    const req = makeRequest()
    await GET(req)

    expect(mocks.userDocumentFindMany).toHaveBeenCalledWith({
      where: {
        user: { role: 'DRIVER', accountStatus: 'ACTIVE' },
        status: 'APPROVED',
        expiryDate: { not: null, lt: expect.any(Date) },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })
  })
})
