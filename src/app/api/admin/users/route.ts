import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { hashPassword } from '@/lib/auth'
import { ApiResponse } from '@/types'
import type { AccountStatus } from '@/types'

// GET /api/admin/users — 列出所有使用者（支援篩選與搜尋）
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以查看使用者清單' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role') // 'DRIVER' | 'DISPATCHER' | 'ADMIN' | null
  const status = searchParams.get('status') as AccountStatus | null // 'ACTIVE' | 'PENDING_REVIEW' | 'REJECTED' | null
  const search = searchParams.get('search')?.trim() || '' // 姓名/Email/車牌/公司名

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (role === 'DRIVER' || role === 'DISPATCHER' || role === 'ADMIN') where.role = role
  if (status) where.accountStatus = status

  // 搜尋：姓名 或 Email 或 車牌 或 公司名（全部在 Prisma 層過濾，無 JS 層過濾）
  if (search) {
    const q = search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      // Driver licensePlate
      ...(role !== 'DISPATCHER' ? [{ driver: { licensePlate: { contains: q } } }] : []),
      // Dispatcher company name
      ...(role !== 'DRIVER' ? [{ dispatcher: { companyName: { contains: q, mode: 'insensitive' } } }] : []),
    ]
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      driver: true,
      dispatcher: true,
      documents: { select: { id: true, type: true, status: true, fileName: true, uploadFailed: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    accountStatus: u.accountStatus,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    rejectReason: u.rejectReason,
    driver: u.driver ? {
      id: u.driver.id,
      licensePlate: u.driver.licensePlate,
      vehicleType: u.driver.vehicleType,
      carBrand: u.driver.carBrand,
      carModel: u.driver.carModel,
      carColor: u.driver.carColor,
      balance: u.driver.balance,
      status: u.driver.status,
      bankCode: u.driver.bankCode,
      bankAccount: u.driver.bankAccount,
      isPremium: u.driver.isPremium,
    } : null,
    dispatcher: u.dispatcher ? {
      id: u.dispatcher.id,
      companyName: u.dispatcher.companyName,
      taxId: u.dispatcher.taxId,
      contactPhone: u.dispatcher.contactPhone,
      commissionRate: u.dispatcher.commissionRate,
    } : null,
    documents: u.documents,
    _docCount: u.documents.length,
    _pendingDocCount: u.documents.filter(d => d.status === 'PENDING').length,
  }))

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      users: result,
      total: result.length,
    },
  })
}
