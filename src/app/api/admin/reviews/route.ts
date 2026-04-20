import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import type { AccountStatus } from '@/types'

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以查看審核清單' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role') // 'DRIVER' | 'DISPATCHER' | null

  const whereClause: { accountStatus: AccountStatus; role?: 'DRIVER' | 'DISPATCHER' } = { accountStatus: 'PENDING_REVIEW' }
  if (role === 'DRIVER' || role === 'DISPATCHER') whereClause.role = role

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      driver: true,
      dispatcher: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Fetch documents for these users
  const userIds = users.map(u => u.id)
  const documents = await prisma.userDocument.findMany({
    where: { userId: { in: userIds } },
  })

  const result = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    accountStatus: u.accountStatus,
    createdAt: u.createdAt,
    driver: u.driver ? {
      id: u.driver.id,
      licensePlate: u.driver.licensePlate,
      vehicleType: u.driver.vehicleType,
      carBrand: u.driver.carBrand,
      carModel: u.driver.carModel,
      carColor: u.driver.carColor,
    } : null,
    dispatcher: u.dispatcher ? {
      id: u.dispatcher.id,
      companyName: u.dispatcher.companyName,
      taxId: u.dispatcher.taxId,
      contactPhone: u.dispatcher.contactPhone,
    } : null,
    documents: documents.filter(d => d.userId === u.id).map(d => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      driveFileId: d.driveFileId,
      status: d.status,
      expiryDate: d.expiryDate,
      uploadFailed: d.uploadFailed,
    })),
  }))

  return NextResponse.json<ApiResponse>({ success: true, data: { users: result } })
}
