/**
 * POST /api/orders — API route tests
 *
 * Covered scenarios:
 * 1. Happy path: valid order creation
 * 2. kenichiRequired field is passed through
 * 3. Missing required fields → 400
 * 4. Unauthorized → 401
 * 5. Non-dispatcher role → 403
 * 6. Past scheduled time → 400
 * 7. Invalid vehicle enum → 400
 * 8. Price out of range → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock modules before importing
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  }
  return { prisma: mockPrisma, default: mockPrisma }
})

vi.mock('@/lib/auth', () => ({
  getUserFromToken: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  checkRateLimit: vi.fn(() => null),
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { POST } from '@/app/api/orders/route'

const mockedPrisma = prisma as unknown as {
  order: {
    create: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}
const mockedGetUser = getUserFromToken as unknown as ReturnType<typeof vi.fn>

function makeRequest(body: object, token = 'valid-token') {
  const req = new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  return req
}

const dispatcherUser = {
  id: 'dispatcher-1',
  email: 'dispatcher1@test.com',
  role: 'DISPATCHER' as const,
  dispatcher: { id: 'disp-id', userId: 'dispatcher-1', companyName: 'Test Co', commissionRate: 0 },
}

const validOrderBody = {
  passengerName: '測試乘客',
  passengerPhone: '0912345678',
  pickupLocation: '桃園機場第一航廈',
  dropoffLocation: '台北市信義區',
  scheduledTime: '2027-01-01T10:00:00',
  price: 1200,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetUser.mockResolvedValue(dispatcherUser)
  mockedPrisma.order.findFirst.mockResolvedValue(null)
  mockedPrisma.order.create.mockResolvedValue({ id: 'order-123' })
})

describe('POST /api/orders', () => {
  it('1. Happy path: creates order successfully', async () => {
    const req = makeRequest(validOrderBody)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('order-123')
  })

  it('2. kenichiRequired=true is passed to Prisma', async () => {
    const req = makeRequest({ ...validOrderBody, kenichiRequired: true })
    await POST(req)
    expect(mockedPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kenichiRequired: true }) })
    )
  })

  it('2b. kenichiRequired=false defaults to false', async () => {
    const req = makeRequest({ ...validOrderBody, kenichiRequired: false })
    await POST(req)
    expect(mockedPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kenichiRequired: false }) })
    )
  })

  it('3. Missing required field → 400', async () => {
    for (const field of ['passengerName', 'passengerPhone', 'pickupLocation', 'dropoffLocation', 'scheduledTime', 'price'] as const) {
      const body = { ...validOrderBody }
      delete body[field]
      const req = makeRequest(body)
      const res = await POST(req)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toContain(field)
    }
  })

  it('4. No token → 401', async () => {
    mockedGetUser.mockResolvedValue(null)
    const req = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validOrderBody),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('5. Non-dispatcher role → 403', async () => {
    mockedGetUser.mockResolvedValue({
      id: 'driver-1',
      email: 'driver1@test.com',
      role: 'DRIVER' as const,
      dispatcher: null,
    })
    const req = makeRequest(validOrderBody)
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('6. Past scheduled time → 400', async () => {
    const pastDate = new Date()
    pastDate.setFullYear(pastDate.getFullYear() - 1)
    const req = makeRequest({ ...validOrderBody, scheduledTime: pastDate.toISOString() })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('過去')
  })

  it('7. Invalid vehicle enum → 400', async () => {
    const req = makeRequest({ ...validOrderBody, vehicle: 'invalid_vehicle' as any })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('車型')
  })

  it('7b. All valid vehicle types accepted', async () => {
    for (const vehicle of ['small', 'suv', 'van9', 'any', 'any_r', 'pending'] as const) {
      const req = makeRequest({ ...validOrderBody, vehicle })
      const res = await POST(req)
      expect(res.status).toBe(200)
    }
  })

  it('8. Price out of range → 400', async () => {
    for (const price of [-1, 100001] as const) {
      const req = makeRequest({ ...validOrderBody, price })
      const res = await POST(req)
      expect(res.status).toBe(400)
    }
  })

  it('9. flightNumber is passed as undefined when not provided (DB default handles it)', async () => {
    const req = makeRequest(validOrderBody)
    await POST(req)
    expect(mockedPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ flightNumber: undefined }) })
    )
  })

  it('10. Prisma error → 500 with generic message (no internal leak)', async () => {
    mockedPrisma.order.create.mockRejectedValue(new Error('Unique constraint failed'))
    const req = makeRequest(validOrderBody)
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    // Must NOT expose internal error message
    expect(json.error).toBe('伺服器錯誤')
    expect(json.error).not.toContain('Unique constraint')
  })
})
