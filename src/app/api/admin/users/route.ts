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

  const where: {
    role?: 'DRIVER' | 'DISPATCHER' | 'ADMIN'
    accountStatus?: AccountStatus
    OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' } }>
  } = {}
  if (role === 'DRIVER' || role === 'DISPATCHER' || role === 'ADMIN') where.role = role
  if (status) where.accountStatus = status

  // 搜尋：姓名 或 Email（不分大小寫）
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
    // 也搜尋 driver licensePlate 和 dispatcher companyName
    // 這需要額外的 include + filter
  }

  const users = await prisma.user.findMany({
    where: where,
    include: {
      driver: true,
      dispatcher: true,
      documents: { select: { id: true, type: true, status: true, fileName: true, uploadFailed: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 如果有搜尋關鍵字，再過濾 driver.licensePlate 和 dispatcher.companyName
  let filtered = users
  if (search) {
    const q = search.toLowerCase()
    filtered = users.filter(u => {
      if (u.role === 'DRIVER' && u.driver?.licensePlate?.toLowerCase().includes(q)) return true
      if (u.role === 'DISPATCHER' && u.dispatcher?.companyName?.toLowerCase().includes(q)) return true
      return false
    })
    // 已在 Prisma filter 過 name/email，這裡只加車牌/公司名
    if (filtered.length === 0) {
      // 找不到結果時搜尋更廣泛
      filtered = users
    }
  }

  const result = filtered.map(u => ({
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
      carType: u.driver.carType,
      carBrand: u.driver.carBrand,
      carModel: u.driver.carModel,
      carColor: u.driver.carColor,
      balance: u.driver.balance,
      status: u.driver.status,
    } : null,
    dispatcher: u.dispatcher ? {
      id: u.dispatcher.id,
      companyName: u.dispatcher.companyName,
      taxId: u.dispatcher.taxId,
      contactPhone: u.dispatcher.contactPhone,
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
