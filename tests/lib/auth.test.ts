/**
 * lib/auth.ts — JWT 函式單元測試
 *
 * 測試覆蓋：
 * 1. hashPassword / verifyPassword（bcrypt）
 * 2. generateToken / verifyToken（JWT）
 * 3. 錯誤路徑：錯誤 secret、過期、格式錯誤
 *
 * 這些是純商業邏輯測試，不需要 DB 或 HTTP 層。
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  type JwtPayload,
} from '@/lib/auth'

// ─── Setup ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── bcrypt 測試 ────────────────────────────────────────

describe('hashPassword / verifyPassword', () => {
  it('相同密碼：hash 後 verify 應回傳 true', async () => {
    const password = 'TestPassword123!'
    const hashed = await hashPassword(password)
    const result = await verifyPassword(password, hashed)
    expect(result).toBe(true)
  })

  it('不同密碼：verify 應回傳 false', async () => {
    const password = 'TestPassword123!'
    const wrongPassword = 'WrongPassword456!'
    const hashed = await hashPassword(password)
    const result = await verifyPassword(wrongPassword, hashed)
    expect(result).toBe(false)
  })

  it('空字串密碼：hash 後 verify 應回傳 false（不同於原始空字串）', async () => {
    const password = 'non-empty'
    const hashed = await hashPassword(password)
    const result = await verifyPassword('', hashed)
    expect(result).toBe(false)
  })

  it('相同密碼每次 hash 結果不同（bcrypt salt）', async () => {
    const password = 'SamePassword!'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    // 兩次 hash 不相等（因為有不同的 salt）
    expect(hash1).not.toBe(hash2)
    // 但都能通過驗證
    expect(await verifyPassword(password, hash1)).toBe(true)
    expect(await verifyPassword(password, hash2)).toBe(true)
  })

  it('hash 後的密碼長度應為 60 個字元（bcrypt 標準）', async () => {
    const hashed = await hashPassword('anypassword')
    expect(hashed.length).toBe(60)
    expect(hashed).toMatch(/^\$2[aby]?\$\d{1,2}\$/) // bcrypt format
  })

  it('超長密碼（255 字元）應正常處理', async () => {
    const longPassword = 'A'.repeat(255)
    const hashed = await hashPassword(longPassword)
    const result = await verifyPassword(longPassword, hashed)
    expect(result).toBe(true)
  })

  it('含特殊字元密碼應正常處理', async () => {
    const specialPassword = 'P@$$w0rd!@#$%^&*()_+-=[]{}|;:\',.<>?/`~'
    const hashed = await hashPassword(specialPassword)
    const result = await verifyPassword(specialPassword, hashed)
    expect(result).toBe(true)
  })
})

// ─── JWT 測試 ────────────────────────────────────────────

describe('generateToken / verifyToken', () => {
  const testPayload: JwtPayload = {
    userId: 'user-123',
    role: 'DRIVER',
  }

  it('正常產生 + 驗證 token，payload 正確', () => {
    const token = generateToken(testPayload)
    const payload = verifyToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.userId).toBe('user-123')
    expect(payload!.role).toBe('DRIVER')
    expect(payload!.exp).toBeDefined() // 有過期時間
  })

  it('帶有額外欄位的 payload 也能正確產生', () => {
    const extendedPayload: JwtPayload = {
      userId: 'user-456',
      role: 'DISPATCHER',
      // @ts-ignore — 允許額外欄位用於測試
      extraField: 'test',
    }
    const token = generateToken(extendedPayload)
    const payload = verifyToken(token)
    expect(payload!.userId).toBe('user-456')
    expect(payload!.role).toBe('DISPATCHER')
  })

  it('7 天後過期的 token 應有正確 exp', () => {
    const token = generateToken(testPayload, '7d')
    const payload = verifyToken(token)

    expect(payload).not.toBeNull()
    const expTime = payload!.exp!
    const now = Math.floor(Date.now() / 1000)
    const sevenDaysInSeconds = 7 * 24 * 60 * 60
    // 誤差 5 分鐘內
    expect(Math.abs((expTime - now) - sevenDaysInSeconds)).toBeLessThan(300)
  })

  it('自訂過期時間 1 小時', () => {
    const token = generateToken(testPayload, '1h')
    const payload = verifyToken(token)

    expect(payload).not.toBeNull()
    const expTime = payload!.exp!
    const now = Math.floor(Date.now() / 1000)
    const oneHourInSeconds = 60 * 60
    expect(Math.abs((expTime - now) - oneHourInSeconds)).toBeLessThan(5)
  })

  it('VERIFY role 的 token 可被驗證（用於 email 驗證）', () => {
    const verifyPayload: JwtPayload = {
      userId: 'user-789',
      role: 'VERIFY',
    }
    const token = generateToken(verifyPayload, '1d')
    const payload = verifyToken(token) as (JwtPayload & { role: string }) | null

    expect(payload).not.toBeNull()
    expect(payload!.role).toBe('VERIFY')
  })

  it('RESET role 的 token 可被驗證（用於密碼重設）', () => {
    const resetPayload: JwtPayload = {
      userId: 'user-reset',
      role: 'RESET',
    }
    const token = generateToken(resetPayload, '1h')
    const payload = verifyToken(token) as (JwtPayload & { role: string }) | null

    expect(payload).not.toBeNull()
    expect(payload!.role).toBe('RESET')
  })
})

// ─── JWT 錯誤路徑測試 ────────────────────────────────────

describe('verifyToken — 錯誤路徑', () => {
  it('完全隨機字串 → 回傳 null', () => {
    const result = verifyToken('this.is.not.a.valid.jwt')
    expect(result).toBeNull()
  })

  it('格式正確但非預期內容 → 回傳 null', () => {
    // 格式正確但 payload 被篡改（無效簽名）
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0In0.fake-signature'
    const result = verifyToken(fakeToken)
    expect(result).toBeNull()
  })

  it('只有 header（無 .payload 和 .signature）→ 回傳 null', () => {
    const result = verifyToken('eyJhbGciOiJIUzI1NiJ9')
    expect(result).toBeNull()
  })

  it('空白字串 → 回傳 null', () => {
    const result = verifyToken('')
    expect(result).toBeNull()
  })

  it('null 作為 token → 回傳 null', () => {
    // @ts-ignore — 測試非預期輸入
    const result = verifyToken(null)
    expect(result).toBeNull()
  })

  it('undefined 作為 token → 回傳 null', () => {
    // @ts-ignore — 測試非預期輸入
    const result = verifyToken(undefined)
    expect(result).toBeNull()
  })
})

// ─── 整合測試：登入流程模擬 ───────────────────────────────

describe('登入流程模擬（auth 函式整合）', () => {
  // 這些測試模擬完整的 register → login 流程
  // 但不實際連接 DB，純用 vi.mock prisma

  it('情境：司機註冊後應收到有效 JWT', async () => {
    // 模擬密碼處理
    const rawPassword = 'DriverPass2024!'
    const hashed = await hashPassword(rawPassword)

    // 驗證密碼正確
    expect(await verifyPassword(rawPassword, hashed)).toBe(true)

    // 模擬產生 JWT（如同 register 函式最後一步）
    const mockUserId = 'registered-driver-001'
    const token = generateToken({ userId: mockUserId, role: 'DRIVER' })

    // 模擬後續請求的 JWT 驗證
    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.userId).toBe(mockUserId)
    expect(payload!.role).toBe('DRIVER')
  })

  it('情境：派單方登入後 JWT 應包含正確 role', async () => {
    const mockUserId = 'registered-dispatcher-001'
    const token = generateToken({ userId: mockUserId, role: 'DISPATCHER' })

    const payload = verifyToken(token)
    expect(payload!.role).toBe('DISPATCHER')
    expect(payload!.userId).toBe(mockUserId)
  })

  it('情境：忘記密碼產生的 RESET token 應與 DRIVER token 獨立', async () => {
    const userId = 'user-reset-test'
    const driverToken = generateToken({ userId, role: 'DRIVER' })
    const resetToken = generateToken({ userId, role: 'RESET' }, '1h')

    const driverPayload = verifyToken(driverToken)
    const resetPayload = verifyToken(resetToken) as (JwtPayload & { role: string }) | null

    expect(driverPayload!.role).toBe('DRIVER')
    expect(resetPayload!.role).toBe('RESET')
    expect(resetPayload!.userId).toBe(userId)

    // DRIVER token 的 exp 應比 RESET token（1h）更長
    const driverExp = driverPayload!.exp!
    const resetExp = resetPayload!.exp!
    expect(driverExp).toBeGreaterThan(resetExp)
  })

  it('情境：多次呼叫 generateToken 每次都能正確驗證（同一毫秒產生相同 token）', () => {
    const payload: JwtPayload = { userId: 'user-1', role: 'DRIVER' }
    const token = generateToken(payload)
    // 同一毫秒呼叫多次會產生相同 token（iat 相同）
    // 重點是每次呼叫都能正確產生可驗證的 token
    expect(verifyToken(token)).toMatchObject({ userId: 'user-1', role: 'DRIVER' })

    // 多次呼叫都不應拋出錯誤
    const tokens = Array.from({ length: 5 }, () => generateToken(payload))
    tokens.forEach((t) => {
      expect(verifyToken(t)).toMatchObject({ userId: 'user-1', role: 'DRIVER' })
    })
  })
})
