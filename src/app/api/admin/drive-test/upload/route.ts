import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { uploadFileToDrive, getOrCreateTestFolder, setFilePublic } from '@/lib/google-drive'
import { ApiResponse } from '@/types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DOC_TYPE_FILE_NAME: Record<string, string> = {
  DRIVER_LICENSE: '駕照',
  VEHICLE_REGISTRATION: '行照',
  INSURANCE: '保險證',
}

// POST /api/admin/drive-test/upload — 上傳測試文件到 Drive 測試資料夾
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
      return NextResponse.json<ApiResponse>({ success: false, error: '檔案需小於 5MB' }, { status: 400 })
    }
    if (!docType || !DOC_TYPE_FILE_NAME[docType]) {
      return NextResponse.json<ApiResponse>({ success: false, error: '無效的文件類型' }, { status: 400 })
    }

    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootFolderId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'GOOGLE_DRIVE_ROOT_FOLDER_ID 未設定' }, { status: 500 })
    }

    // 產生測試檔名：測試-{時間戳}-{原始檔名}
    const ext = file.name.split('.').pop() || 'bin'
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')
    const docLabel = DOC_TYPE_FILE_NAME[docType]
    const fileName = `測試-${docLabel}-${timestamp}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    // 上傳到測試資料夾
    const folderId = await getOrCreateTestFolder(rootFolderId)
    console.log(`[DRIVE-TEST] Folder: ${folderId}, File: ${fileName}`)
    const uploaded = await uploadFileToDrive(folderId, fileName, file.type, buffer)
    await setFilePublic(uploaded.fileId)

    console.log(`[DRIVE-TEST] Uploaded: ${uploaded.fileId} -> ${uploaded.webViewLink}`)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        fileName,
        fileUrl: uploaded.webViewLink,
        driveFileId: uploaded.fileId,
        driveFolderId: folderId,
        mimeType: file.type,
        sizeBytes: file.size,
        docType,
      },
    })
  } catch (err) {
    console.error('[DRIVE-TEST] Upload error:', err)
    return NextResponse.json<ApiResponse>({ success: false, error: '上傳失敗，請稍後再試' }, { status: 500 })
  }
}
