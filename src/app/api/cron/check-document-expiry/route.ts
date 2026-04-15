import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DRIVER_LICENSE: '駕照',
  VEHICLE_REGISTRATION: '行照',
  INSURANCE: '保險證',
}

// GET /api/cron/check-document-expiry — 每日檢查司機文件是否過期
export async function GET(request: NextRequest) {
  try {
    const secret = request.headers.get('x-cron-secret')
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 找出所有已過期且狀態為 APPROVED 的文件（隸屬於 accountStatus = ACTIVE 的 DRIVER）
    const expiredDocs = await prisma.userDocument.findMany({
      where: {
        user: {
          role: 'DRIVER',
          accountStatus: 'ACTIVE',
        },
        status: 'APPROVED',
        expiryDate: {
          not: null,
          lt: today,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (expiredDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired documents found',
        expiredCount: 0,
        affectedDrivers: [],
      })
    }

    const affectedDrivers: Array<{ userId: string; name: string; email: string; expiredTypes: string[] }> = []

    for (const doc of expiredDocs) {
      const typeLabel = DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type

      if (process.env.NODE_ENV !== 'production') console.log(`[check-document-expiry] 司機 ${doc.user.name}（${doc.user.email}）的文件已過期：${typeLabel}`)

      await prisma.user.update({
        where: { id: doc.userId },
        data: {
          accountStatus: 'REJECTED',
          rejectReason: `文件已過期：${typeLabel}`,
        },
      })

      // 累積同一司機的過期文件類型
      const existing = affectedDrivers.find((d) => d.userId === doc.userId)
      if (existing) {
        existing.expiredTypes.push(typeLabel)
      } else {
        affectedDrivers.push({
          userId: doc.userId,
          name: doc.user.name,
          email: doc.user.email,
          expiredTypes: [typeLabel],
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document expiry check completed',
      expiredCount: expiredDocs.length,
      affectedDrivers,
    })
  } catch (error) {
    console.error('[check-document-expiry] Cron error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
