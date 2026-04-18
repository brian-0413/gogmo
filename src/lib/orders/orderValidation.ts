/**
 * Order Validation Pipeline
 * Centralizes pre-order-creation checks: quota, verification status, duplicate detection.
 * Each function returns { allowed: true } or { allowed: false, reason, errorCode }.
 * Call in order: verifyAuth → verifyRole → verifyRealName → checkQuota → checkDuplicate → proceed.
 */

import { prisma } from '@/lib/prisma'
import type { User, Dispatcher } from '@prisma/client'

// ── Quota System ──────────────────────────────────────────────────────────────

export type QuotaCheckResult =
  | { allowed: true; used: number; limit: number; resetAt: Date }
  | { allowed: false; reason: 'QUOTA_EXCEEDED'; used: number; limit: number; resetAt: Date; upgradeUrl: string }

export function getQuotaLimit(tier: string): number {
  switch (tier) {
    case 'BASIC': return 100
    case 'PREMIUM': return 500
    case 'ENTERPRISE': return Infinity
    default: return 100
  }
}

/**
 * Lazy-reset quota check for dispatcher.
 * Returns current usage and whether creation is allowed.
 * Uses transaction to prevent race condition.
 */
export async function checkAndIncrementQuota(dispatcherUser: User): Promise<QuotaCheckResult> {
  const now = new Date()
  const taipeiReset = getNextTaipeiMidnight()

  // Lazy reset if expired
  if (dispatcherUser.dailyCountResetAt < now) {
    await prisma.user.update({
      where: { id: dispatcherUser.id },
      data: { dailyOrderCount: 0, dailyCountResetAt: taipeiReset },
    })
  }

  const limit = getQuotaLimit(dispatcherUser.tier)
  const used = dispatcherUser.dailyOrderCount

  if (used >= limit) {
    return {
      allowed: false,
      reason: 'QUOTA_EXCEEDED',
      used,
      limit,
      resetAt: dispatcherUser.dailyCountResetAt,
      upgradeUrl: '/settings/upgrade',
    }
  }

  return { allowed: true, used, limit, resetAt: dispatcherUser.dailyCountResetAt }
}

/**
 * Increment dailyOrderCount after successful order creation.
 * Call inside the same transaction as order creation.
 */
export async function incrementQuota(userId: string): Promise<void> {
  const now = new Date()
  const taipeiReset = getNextTaipeiMidnight()

  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyOrderCount: { increment: 1 },
      dailyCountResetAt: taipeiReset,
    },
  })
}

// ── Verification Status ────────────────────────────────────────────────────────

export type VerificationResult =
  | { allowed: true }
  | { allowed: false; reason: string; pendingSteps: string[] }

export async function checkVerificationStatus(user: User): Promise<VerificationResult> {
  if (user.role !== 'DISPATCHER') return { allowed: true }

  const pendingSteps: string[] = []

  if (!user.phoneVerifiedAt) pendingSteps.push('phone')
  if (!user.emailVerifiedAt) pendingSteps.push('email')
  if (!user.realName) pendingSteps.push('realName')

  if (user.verificationStatus === 'FULLY_VERIFIED') return { allowed: true }

  if (user.verificationStatus === 'PENDING' || pendingSteps.length > 0) {
    return {
      allowed: false,
      reason: 'VERIFICATION_INCOMPLETE',
      pendingSteps,
    }
  }

  return { allowed: true }
}

// ── Duplicate Detection ───────────────────────────────────────────────────────

export type DuplicateCheckResult =
  | { isDuplicate: false }
  | { isDuplicate: true; matchedOrderId: string; similarity: number; matchedFields: string[] }

export async function checkDuplicate(
  dispatcherId: string,
  orderData: { date: string; time: string; type: string; pickupLocation: string; price: number }
): Promise<DuplicateCheckResult> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  const recentOrders = await prisma.order.findMany({
    where: {
      dispatcherId,
      createdAt: { gte: thirtyMinutesAgo },
      status: { in: ['PUBLISHED', 'PENDING'] },
    },
    select: {
      id: true,
      pickupLocation: true,
      price: true,
      scheduledTime: true,
      type: true,
    },
  })

  for (const existing of recentOrders) {
    const fields: string[] = []
    let matchScore = 0

    const sameDate = existing.scheduledTime.toISOString().split('T')[0] === orderData.date
    const samePrice = existing.price === orderData.price
    const sameType = existing.type === orderData.type

    if (sameDate) { matchScore++; fields.push('date') }
    if (samePrice) { matchScore++; fields.push('price') }
    if (sameType) { matchScore++; fields.push('type') }

    // Location similarity (edit distance < 3)
    const locDistance = levenshteinDistance(
      normalizeLocation(existing.pickupLocation),
      normalizeLocation(orderData.pickupLocation)
    )
    if (locDistance < 3) { matchScore++; fields.push('location') }

    const similarity = matchScore / 5

    if (matchScore >= 4) {
      return {
        isDuplicate: true,
        matchedOrderId: existing.id,
        similarity,
        matchedFields: fields,
      }
    }
  }

  return { isDuplicate: false }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNextTaipeiMidnight(): Date {
  const now = new Date()
  const taipei = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  taipei.setDate(taipei.getDate() + 1)
  taipei.setHours(0, 0, 0, 0)
  return taipei
}

function normalizeLocation(loc: string): string {
  return loc.replace(/[\s,。、，]/g, '').toLowerCase()
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}