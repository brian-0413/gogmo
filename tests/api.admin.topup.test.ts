/**
 * PUT /api/drivers/topup/[id]/confirm — 管理員確認轉帳加值
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAdmin = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
  driver: null,
}

// vi.hoisted() ensures mocks are evaluated within vitest's hoisting scope
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  topupFindUnique: vi.fn(),
  topupUpdate: vi.fn(),
  driverUpdate: vi.fn(),
  transactionCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    topup: { findUnique: mocks.topupFindUnique, update: mocks.topupUpdate },
    driver: { update: mocks.driverUpdate },
    transaction: { create: mocks.transactionCreate },
  },
}))

vi.mock('@/lib/auth', () => ({
  getUserFromToken: mocks.getUser,
}))

import { prisma } from '@/lib/prisma'
import { PUT } from '@/app/api/drivers/topup/[id]/confirm/route'

const $prisma = prisma as unknown as {
  topup: { findUnique: typeof mocks.topupFindUnique; update: typeof mocks.topupUpdate }
  driver: { update: typeof mocks.driverUpdate }
  transaction: { create: typeof mocks.transactionCreate }
}

function makeRequest(topupId: string, token = 'admin-token') {
  return new NextRequest(`http://localhost:3000/api/drivers/topup/${topupId}/confirm`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

describe('PUT /api/drivers/topup/[id]/confirm', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue(mockAdmin)
  })

  it('1. 成功確認 transfer topup → 更新 status=paid、balance 增加，建立 Transaction', async () => {
    mocks.topupFindUnique.mockResolvedValue({
      id: 'topup-1', driverId: 'driver-1', amount: 1000,
      method: 'transfer', status: 'pending',
      driver: { id: 'driver-1', balance: 500 },
    })
    mocks.topupUpdate.mockResolvedValue({ id: 'topup-1', status: 'paid' })
    mocks.driverUpdate.mockResolvedValue({ id: 'driver-1', balance: 1500 })
    mocks.transactionCreate.mockResolvedValue({ id: 'tx-1' })

    const req = makeRequest('topup-1')
    const res = await PUT(req as unknown as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: 'topup-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.amount).toBe(1000)
    expect(json.data.driverBalance).toBe(1500)

    expect(mocks.topupUpdate).toHaveBeenCalledWith({
      where: { id: 'topup-1' },
      data: { status: 'paid', paidAt: expect.any(Date) },
    })
    expect(mocks.driverUpdate).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      data: { balance: { increment: 1000 } },
    })
    expect(mocks.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        driverId: 'driver-1',
        topupId: 'topup-1',
        amount: 1000,
        type: 'RECHARGE',
        status: 'SETTLED',
      }),
    })
  })

  it('2. 非 admin → 403', async () => {
    mocks.getUser.mockResolvedValue({ ...mockAdmin, role: 'DRIVER' as const })
    const req = makeRequest('topup-1')
    const res = await PUT(req as unknown as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: 'topup-1' }) })
    expect(res.status).toBe(403)
  })

  it('3. topup 不存在 → 404', async () => {
    mocks.topupFindUnique.mockResolvedValue(null)
    const req = makeRequest('nonexistent')
    const res = await PUT(req as unknown as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('4. credit 方式的 topup → 400（只能確認 transfer）', async () => {
    mocks.topupFindUnique.mockResolvedValue({
      id: 'topup-credit-1', driverId: 'driver-1', amount: 1030,
      method: 'credit', status: 'pending',
      driver: { id: 'driver-1', balance: 500 },
    })
    const req = makeRequest('topup-credit-1')
    const res = await PUT(req as unknown as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: 'topup-credit-1' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('僅能確認轉帳加值')
  })

  it('5. 已確認過的 topup（status=paid）→ 400', async () => {
    mocks.topupFindUnique.mockResolvedValue({
      id: 'topup-1', driverId: 'driver-1', amount: 1000,
      method: 'transfer', status: 'paid',
      driver: { id: 'driver-1', balance: 1500 },
    })
    const req = makeRequest('topup-1')
    const res = await PUT(req as unknown as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: 'topup-1' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('paid')
  })

  // Auth null test skipped: covered in api.orders.test.ts
})
