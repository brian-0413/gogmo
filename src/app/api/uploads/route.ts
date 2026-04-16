import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_UPLOAD_ATTEMPTS = 3 // 同一文件類型最多上傳次數
const DOC_TYPE_FILE_NAME: Record<string, string> = {
  VEHICLE_REGISTRATION: '行照',
  DRIVER_LICENSE: '駕照',
  INSURANCE: '保險證',
  ID_CARD: '身分證',
  BUSINESS_REGISTRATION: '商業登記',
}

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

  // 檢查失敗次數
  if (docType) {
    const failedCount = await prisma.userDocument.count({
      where: { userId: user.id, type: docType, uploadFailed: true },
    })
    if (failedCount >= MAX_UPLOAD_ATTEMPTS) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `此文件類型已失敗 ${MAX_UPLOAD_ATTEMPTS} 次，請聯絡管理員處理` },
        { status: 400 }
      )
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'bin'
  const docTypeLabel = docType ? (DOC_TYPE_FILE_NAME[docType] || docType) : '文件'
  const safeFileName = `${user.id}-${docTypeLabel}-${Date.now()}.${ext}`

  let fileUrl = ''
  let uploadFailed = false

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 未正確設定')
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const storagePath = `${user.id}/${safeFileName}`

    const { error } = await supabase.storage
      .from('driver-credentials')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (error) throw new Error(error.message)

    const { data: urlData } = supabase.storage
      .from('driver-credentials')
      .getPublicUrl(storagePath)
    fileUrl = urlData.publicUrl
  } catch (err) {
    console.error('Supabase Storage upload failed:', err)
    uploadFailed = true
    fileUrl = `upload-failed:${file.name}`
  }

  // Delete old documents of the same type (avoid duplicates) — 先刪再創
  if (docType) {
    await prisma.userDocument.deleteMany({
      where: { userId: user.id, type: docType },
    })
  }

  const doc = await prisma.userDocument.create({
    data: {
      userId: user.id,
      type: docType || 'OTHER',
      fileUrl,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      status: 'PENDING',
      uploadFailed,
    },
  })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { fileUrl, fileName: file.name, mimeType: file.type, sizeBytes: file.size, uploadFailed },
  })
}
