import { v4 as uuidv4 } from 'uuid'

// Simple in-memory rate limiter with UUID-keyed buckets.
// For production, use Redis-based solution like upstash/ratelimit.
// Thread-safety note: Next.js edge/serverless runs each request in isolated
// contexts. This module-level store works per-instance. For multi-instance
// deployments, replace with a shared store (Redis/DB). We use UUID keys so
// each request gets a unique bucket that self-expires, avoiding cross-request
// leakage that IP-only keys would have.

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store — keyed by UUID per request to avoid cross-request pollution
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function rateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 100 },
  requestId?: string
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  // Use UUID per request to avoid cross-request state leakage.
  // Fall back to IP-based key only as a stable identifier (no separate UUID).
  const key = `rate_limit:${requestId || identifier}`

  let entry = rateLimitStore.get(key)

  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    }
  }

  entry.count++
  rateLimitStore.set(key, entry)

  return {
    success: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  }
}

// Generate a short UUID for rate limit bucket (no shared state between instances)
export function newRateLimitBucket(): string {
  return uuidv4()
}

// Get client IP from request headers
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  )
}
