import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from './rate-limit'
import { ApiResponse } from '@/types'

// Rate limit configs for different endpoints
export const rateLimitConfigs = {
  // Strict: auth endpoints (login, register)
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 requests per 15 minutes

  // Medium: order operations
  orders: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 requests per minute

  // Relaxed: read operations
  read: { windowMs: 60 * 1000, maxRequests: 120 }, // 120 requests per minute
}

export interface RateLimitOptions {
  type: keyof typeof rateLimitConfigs
  identifier?: string // Optional custom identifier
}

/**
 * Apply rate limiting to API routes
 * Returns response with rate limit headers if exceeded, or null to continue
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): NextResponse<ApiResponse> | null {
  const config = rateLimitConfigs[options.type]
  const identifier = options.identifier || getClientIP(request.headers)

  const result = rateLimit(identifier, config)

  // Add rate limit headers to response
  const headers = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
  }

  if (!result.success) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '請求太頻繁，請稍後再試',
      },
      { status: 429, headers }
    )
  }

  // Return headers to be merged with response
  return null // Signal to continue
}

export { getClientIP }
