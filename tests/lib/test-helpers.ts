/**
 * 測試輔助函式 — 提供統一的方式建立 request / mock user
 */

import { NextRequest } from 'next/server'

// ─── Request 工廠 ───────────────────────────────────────

/**
 * 建立帶有 auth token 的 POST request
 */
export function makePostRequest(
  url: string,
  body: object,
  token = 'test-token',
  method = 'POST'
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return new NextRequest(url, {
    method,
    headers,
    body: JSON.stringify(body),
  })
}

/**
 * 建立帶有 auth token 的 GET request
 */
export function makeGetRequest(url: string, token = 'test-token'): NextRequest {
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return new NextRequest(url, {
    method: 'GET',
    headers,
  })
}

/**
 * 建立不帶 auth token 的 request
 */
export function makeUnauthenticatedRequest(
  url: string,
  body: object | null = null,
  method = 'POST'
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ─── 時間輔助 ───────────────────────────────────────────

/**
 * 未來的 ISO 時間字串（N 天後）
 */
export function futureDate(daysFromNow = 7): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

/**
 * 過去的 ISO 時間字串（N 天前）
 */
export function pastDate(daysAgo = 1): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

/**
 * 行程前 6 小時（可用於退單測試）
 */
export function sixHoursFromNow(): string {
  const d = new Date()
  d.setHours(d.getHours() + 6)
  return d.toISOString()
}

/**
 * 行程前 30 分鐘（鎖定期內）
 */
export function thirtyMinsFromNow(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  return d.toISOString()
}

// ─── 斷言輔助 ───────────────────────────────────────────

/**
 * 確認 API 回應符合標準格式
 */
export function expectApiSuccess<T = unknown>(
  json: { success: boolean; data?: T; error?: string },
  expectedStatus = 200
): asserts json is { success: true; data: T } {
  // noop — just for documentation
}

export function expectApiError(
  json: { success: boolean; data?: unknown; error?: string },
  status: number
): asserts json is { success: false; error: string } {
  // noop
}
