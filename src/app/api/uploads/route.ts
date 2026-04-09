import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  }
  const user = await getUserFromToken(token)
  if (!user) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無效的 token' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const docType = formData.get('type') as string | null

  if (!file) {
    return NextResponse.json<ApiResponse>({ success: false, error: '未選擇檔案' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json<ApiResponse>({ success: false, error: '僅支援 JPG、PNG、PDF' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json<ApiResponse>({ success: false, error: '檔案需小於 5MB' }, { status: 400 })
  }

  // Store in public/uploads/{userId}/
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', user.id)
  await mkdir(uploadDir, { recursive: true })

  const ext = file.name.split('.').pop() || 'bin'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const filePath = path.join(uploadDir, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const fileUrl = `/uploads/${user.id}/${safeName}`

  // Also save to UserDocument table
  const { prisma } = await import('@/lib/prisma')
  await prisma.userDocument.create({
    data: {
      userId: user.id,
      type: docType || 'OTHER',
      fileUrl,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      status: 'PENDING',
    },
  })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { fileUrl, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
  })
}