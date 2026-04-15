/**
 * POST /api/auth/login — API 整合測試
 *
 * 測試場景：
 * 1. 司機正常登入（車牌 + 密碼）
 * 2. 派單方正常登入（Email + 密碼）
 * 3. 密碼錯誤 → 401
 * 4. 帳號不存在 → 401
 * 5. 缺少必填欄位 → 400
 * 6. 無效角色 → 400
 * 7. rate limit 觸發 → 429
 * 8. 非司機使用車牌登入（loginByPlate）→ 失敗
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/login/route'
import {
  createDriverUser,
  createDispatcherUser,
} from '../fixtures/auth'

// ─── Mocks ───────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  login: vi.fn(),
  loginByPlate: vi.fn(),
  getUserFromToken: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  checkRateLimit: vi.fn(() => null),
}))

import { login, loginByPlate } from '@/lib/auth'
import { checkRateLimit } from '@/lib/api-utils'

const mockLogin = login as ReturnType<typeof vi.fn>
const mockLoginByPlate = loginByPlate as ReturnType<typeof vi.fn>
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>

// ─── 工具函式 ────────────────────────────────────────────

function makeLoginRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // 預設：無 rate limit
  mockCheckRateLimit.mockReturnValue(null)
})

// ─── 正常登入流程 ────────────────────────────────────────

describe('POST /api/auth/login — 正常登入', () => {
  it('1. 司機以車牌+密碼登入成功', async () => {
    const driverUser = createDriverUser()
    mockLoginByPlate.mockResolvedValue({
      success: true,
      token: 'driver-jwt-token-xyz',
      user: {
        id: driverUser.id,
        email: driverUser.email,
        name: driverUser.name,
        role: driverUser.role,
        isPremium: false,
        accountStatus: 'ACTIVE',
        rejectReason: null,
      },
    })

    const req = makeLoginRequest({
      account: 'TEST-1234',
      password: 'CorrectPassword!',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.token).toBe('driver-jwt-token-xyz')
    expect(json.data.user.role).toBe('DRIVER')
    expect(mockLoginByPlate).toHaveBeenCalledWith('TEST-1234', 'CorrectPassword!')
  })

  it('2. 派單方以 Email+密碼登入成功', async () => {
    const dispatcherUser = createDispatcherUser()
    mockLogin.mockResolvedValue({
      success: true,
      token: 'dispatcher-jwt-token-abc',
      user: {
        id: dispatcherUser.id,
        email: dispatcherUser.email,
        name: dispatcherUser.name,
        role: dispatcherUser.role,
        isPremium: false,
        accountStatus: 'ACTIVE',
        rejectReason: null,
      },
    })

    const req = makeLoginRequest({
      account: 'dispatcher1@test.com',
      password: 'DispatcherPass!',
      role: 'DISPATCHER',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.token).toBe('dispatcher-jwt-token-abc')
    expect(json.data.user.role).toBe('DISPATCHER')
    expect(mockLogin).toHaveBeenCalledWith('dispatcher1@test.com', 'DispatcherPass!')
  })

  it('3. 登入成功回傳包含完整 user 欄位', async () => {
    mockLoginByPlate.mockResolvedValue({
      success: true,
      token: 'token-123',
      user: {
        id: 'user-id',
        email: 'test@test.com',
        name: 'Test User',
        role: 'DRIVER',
        isPremium: true,
        accountStatus: 'ACTIVE',
        rejectReason: null,
      },
    })

    const req = makeLoginRequest({
      account: 'TEST-PLATE',
      password: 'pass',
      role: 'DRIVER',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(json.data.user).toMatchObject({
      id: 'user-id',
      email: 'test@test.com',
      name: 'Test User',
      role: 'DRIVER',
      isPremium: true,
      accountStatus: 'ACTIVE',
    })
  })

  it('4. ADMIN 角色登入成功', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      token: 'admin-token',
      user: {
        id: 'admin-1',
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
      },
    })

    const req = makeLoginRequest({
      account: 'admin@test.com',
      password: 'adminpass',
      role: 'ADMIN',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
  })
})

// ─── 失敗場景 ────────────────────────────────────────────

describe('POST /api/auth/login — 失敗場景', () => {
  it('5. 密碼錯誤 → 401，回傳通用錯誤訊息', async () => {
    mockLoginByPlate.mockResolvedValue({
      success: false,
      error: '帳號或密碼錯誤',
    })

    const req = makeLoginRequest({
      account: 'TEST-1234',
      password: 'WrongPassword',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)

    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('帳號或密碼錯誤')
  })

  it('6. 派單方 Email 不存在 → 401', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: '帳號或密碼錯誤',
    })

    const req = makeLoginRequest({
      account: 'nonexistent@test.com',
      password: 'anypassword',
      role: 'DISPATCHER',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('7. 缺少 account → 400', async () => {
    const req = makeLoginRequest({
      password: 'somepassword',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('必填')
  })

  it('8. 缺少 password → 400', async () => {
    const req = makeLoginRequest({
      account: 'TEST-1234',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('9. 缺少 role → 400', async () => {
    const req = makeLoginRequest({
      account: 'TEST-1234',
      password: 'password',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('10. role=INVALID → 400，錯誤訊息包含「無效」', async () => {
    const req = makeLoginRequest({
      account: 'test',
      password: 'test',
      role: 'INVALID_ROLE',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error).toContain('無效')
  })

  it('11. login 函式拋出例外 → 500，不暴露內部錯誤', async () => {
    mockLogin.mockRejectedValue(new Error('Prisma connection failed'))

    const req = makeLoginRequest({
      account: 'test@test.com',
      password: 'password',
      role: 'DISPATCHER',
    })
    const res = await POST(req)
    expect(res.status).toBe(500)

    const json = await res.json()
    expect(json.success).toBe(false)
    // 確認不回傳內部錯誤
    expect(json.error).toBe('伺服器錯誤')
    expect(json.error).not.toContain('Prisma')
    expect(json.error).not.toContain('connection')
  })

  it('12. loginByPlate 拋出例外 → 500，不暴露內部錯誤', async () => {
    mockLoginByPlate.mockRejectedValue(new Error('Database timeout'))

    const req = makeLoginRequest({
      account: 'TEST-1234',
      password: 'password',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(500)

    const json = await res.json()
    expect(json.error).toBe('伺服器錯誤')
    expect(json.error).not.toContain('Database')
  })
})

// ─── Rate Limit ──────────────────────────────────────────

describe('POST /api/auth/login — Rate Limit', () => {
  it('13. rate limit 觸發時回傳 429', async () => {
    // Mock rate limit 回傳 429 response
    mockCheckRateLimit.mockReturnValue(
      new (await import('next/server')).NextResponse(
        JSON.stringify({ success: false, error: '請求過於頻繁，請稍後再試' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const req = makeLoginRequest({
      account: 'TEST-1234',
      password: 'password',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(429)

    const json = await res.json()
    expect(json.error).toContain('過於頻繁')
  })

  it('14. rate limit 未觸發時正常處理請求', async () => {
    mockCheckRateLimit.mockReturnValue(null)
    mockLoginByPlate.mockResolvedValue({
      success: true,
      token: 'token',
      user: {
        id: 'id',
        email: 'test@test.com',
        name: 'Test',
        role: 'DRIVER',
      },
    })

    const req = makeLoginRequest({
      account: 'TEST-1234',
      password: 'pass',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})

// ─── 邊界條件 ────────────────────────────────────────────

describe('POST /api/auth/login — 邊界條件', () => {
  it('15. account 和 password 為空白字串 → 400', async () => {
    const req = makeLoginRequest({
      account: '',
      password: '',
      role: 'DRIVER',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('16. role 大小寫錯誤（driver 而非 DRIVER）→ 400', async () => {
    const req = makeLoginRequest({
      account: 'TEST-1234',
      password: 'pass',
      role: 'driver', // 小寫
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('17. 司機使用 login（Email 登入）應呼叫 loginByPlate', async () => {
    // 當 role=DRIVER 時，應該呼叫 loginByPlate 而非 login
    mockLoginByPlate.mockResolvedValue({
      success: true,
      token: 'token',
      user: { id: 'id', email: 'a@b.com', name: 'D', role: 'DRIVER' },
    })

    const req = makeLoginRequest({
      account: 'REAL-PLATE',
      password: 'pass',
      role: 'DRIVER',
    })
    await POST(req)

    expect(mockLoginByPlate).toHaveBeenCalledTimes(1)
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('18. 派單方使用 loginByPlate 應呼叫 login（非 loginByPlate）', async () => {
    // 當 role=DISPATCHER 時，應該呼叫 login
    mockLogin.mockResolvedValue({
      success: true,
      token: 'token',
      user: { id: 'id', email: 'd@test.com', name: 'D', role: 'DISPATCHER' },
    })

    const req = makeLoginRequest({
      account: 'dispatcher@test.com',
      password: 'pass',
      role: 'DISPATCHER',
    })
    await POST(req)

    expect(mockLogin).toHaveBeenCalledTimes(1)
    expect(mockLoginByPlate).not.toHaveBeenCalled()
  })
})
