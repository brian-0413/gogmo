import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, hashPassword } from '@/lib/auth'
import { ApiResponse } from '@/types'
import type { AccountStatus } from '@/types'

// GET /api/admin/users/[id] — 取得單一使用者詳情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以查看使用者資料' }, { status: 403 })
  }

  const { id } = await params
  const target = await prisma.user.findUnique({
    where: { id },
    include: {
      driver: true,
      dispatcher: true,
      documents: true,
    },
  })

  if (!target) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到該使用者' }, { status: 404 })
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { user: target },
  })
}

// PUT /api/admin/users/[id] — 更新使用者資料（編輯、停用、啟用）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const admin = await getUserFromToken(token)
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以修改使用者資料' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到該使用者' }, { status: 404 })
  }

  // 不能操作自己
  if (id === admin.id) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無法對自己的帳號進行操作' }, { status: 400 })
  }

  // 不能操作其他 ADMIN
  if (target.role === 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '無法操作管理員帳號' }, { status: 403 })
  }

  const updateData: {
    name?: string
    phone?: string
    accountStatus?: AccountStatus
    rejectReason?: string | null
  } = {}

  if (typeof body.name === 'string' && body.name.trim()) updateData.name = body.name.trim()
  if (typeof body.phone === 'string' && body.phone.trim()) updateData.phone = body.phone.trim()
  if (['ACTIVE', 'PENDING_REVIEW', 'REJECTED'].includes(body.accountStatus)) {
    updateData.accountStatus = body.accountStatus
    if (body.accountStatus !== 'REJECTED') updateData.rejectReason = null
    if (body.accountStatus === 'REJECTED' && body.rejectReason) updateData.rejectReason = body.rejectReason
  }

  // 更新 Driver 或 Dispatcher 附帶資料
  const driverUpdate: Record<string, unknown> = {}
  const dispatcherUpdate: Record<string, unknown> = {}

  if (target.role === 'DRIVER' && body.driver) {
    if (body.driver.licensePlate) driverUpdate.licensePlate = body.driver.licensePlate
    if (body.driver.carType) driverUpdate.carType = body.driver.carType
    if (body.driver.carColor) driverUpdate.carColor = body.driver.carColor
    if (body.driver.carBrand) driverUpdate.carBrand = body.driver.carBrand
    if (body.driver.carModel) driverUpdate.carModel = body.driver.carModel
  }

  if (target.role === 'DISPATCHER' && body.dispatcher) {
    if (body.dispatcher.companyName) dispatcherUpdate.companyName = body.dispatcher.companyName
    if (body.dispatcher.taxId) dispatcherUpdate.taxId = body.dispatcher.taxId
    if (body.dispatcher.contactPhone) dispatcherUpdate.contactPhone = body.dispatcher.contactPhone
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.user.update({ where: { id }, data: updateData })
    }
    if (target.role === 'DRIVER' && Object.keys(driverUpdate).length > 0) {
      await tx.driver.update({ where: { userId: id }, data: driverUpdate })
    }
    if (target.role === 'DISPATCHER' && Object.keys(dispatcherUpdate).length > 0) {
      await tx.dispatcher.update({ where: { userId: id }, data: dispatcherUpdate })
    }
  })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { message: '使用者資料已更新' },
  })
}

// DELETE /api/admin/users/[id] — 刪除使用者
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const admin = await getUserFromToken(token)
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '只有管理員可以刪除使用者' }, { status: 403 })
  }

  const { id } = await params
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到該使用者' }, { status: 404 })
  }

  if (id === admin.id) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無法刪除自己的帳號' }, { status: 400 })
  }
  if (target.role === 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '無法刪除管理員帳號' }, { status: 403 })
  }

  // Cascade delete via Prisma relations (Driver/Dispatcher has onDelete: Cascade)
  await prisma.user.delete({ where: { id } })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { message: '使用者已刪除' },
  })
}
