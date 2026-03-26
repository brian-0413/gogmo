// Simple in-memory rate limiter
// For production, use Redis-based solution like upstash/ratelimit

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (resets on server restart - OK for single instance)
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
  config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 100 }
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = `rate_limit:${identifier}`

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

// Get client IP from request headers
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  )
}
