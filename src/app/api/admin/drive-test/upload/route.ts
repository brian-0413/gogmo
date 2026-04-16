import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DOC_TYPE_FILE_NAME: Record<string, string> = {
  DRIVER_LICENSE: '駕照',
  VEHICLE_REGISTRATION: '行照',
  INSURANCE: '保險證',
}

// POST /api/admin/drive-test/upload — 上傳測試文件到 Supabase Storage
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  }
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '僅限管理員' }, { status: 403 })
  }

  try {
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
      return NextResponse.json<ApiResponse>( { success: false, error: '檔案需小於 5MB' }, { status: 400 })
    }
    if (!docType || !DOC_TYPE_FILE_NAME[docType]) {
      return NextResponse.json<ApiResponse>({ success: false, error: '無效的文件類型' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'bin'
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')
    const docLabel = DOC_TYPE_FILE_NAME[docType]
    const fileName = `測試-${docLabel}-${timestamp}.${ext}`
    const storagePath = `admin-test/${timestamp}-${fileName}`

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Supabase 未正確設定' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const buffer = Buffer.from(await file.arrayBuffer())

    const { data, error } = await supabase.storage
      .from('driver-credentials')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (error) throw new Error(error.message)

    const { data: urlData } = supabase.storage
      .from('driver-credentials')
      .getPublicUrl(storagePath)

    if (process.env.NODE_ENV !== 'production') console.log(`[SUPABASE-TEST] Uploaded: ${data.path} -> ${urlData.publicUrl}`)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        fileName,
        fileUrl: urlData.publicUrl,
        mimeType: file.type,
        sizeBytes: file.size,
        docType,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const type = err instanceof Error ? err.constructor.name : 'Error'
    console.error('[SUPABASE-TEST] Upload error:', type, msg)
    return NextResponse.json<ApiResponse>({ success: false, error: `[${type}] ${msg}` }, { status: 500 })
  }
}
