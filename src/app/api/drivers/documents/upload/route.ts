import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { uploadFileToDrive, getOrCreateUserFolder, setFilePublic } from '@/lib/google-drive'
import { prisma } from '@/lib/prisma'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DOC_TYPE_FILE_NAME: Record<string, string> = {
  VEHICLE_REGISTRATION: '行照',
  DRIVER_LICENSE: '駕照',
  INSURANCE: '保險證',
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

  // 驗證是司機本人
  if (user.role !== 'DRIVER' || !user.driver) {
    return NextResponse.json<ApiResponse>({ success: false, error: '僅限司機使用' }, { status: 403 })
  }

  // 驗證 userId 為本人
  const formData = await request.formData()
  const userIdParam = formData.get('userId') as string | null
  if (userIdParam && userIdParam !== user.id) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無法替他人上傳文件' }, { status: 403 })
  }

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
  if (!docType || !['DRIVER_LICENSE', 'VEHICLE_REGISTRATION', 'INSURANCE'].includes(docType)) {
    return NextResponse.json<ApiResponse>({ success: false, error: '文件類型需為 DRIVER_LICENSE、VEHICLE_REGISTRATION 或 INSURANCE' }, { status: 400 })
  }

  const driver = await prisma.driver.findUnique({ where: { id: user.driver.id } })
  if (!driver) {
    return NextResponse.json<ApiResponse>({ success: false, error: '找不到司機資料' }, { status: 404 })
  }
  const licensePlate = driver.licensePlate || user.id

  const ext = file.name.split('.').pop() || 'bin'
  const docTypeLabel = DOC_TYPE_FILE_NAME[docType] || docType
  const driveFileName = `${licensePlate}-${docTypeLabel}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  let fileUrl = ''
  let driveFileId = ''
  let driveFolderId = ''
  let uploadFailed = false

  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootFolderId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID 未設定')

    const folderId = await getOrCreateUserFolder(rootFolderId, user.id, licensePlate)
    const result = await uploadFileToDrive(folderId, driveFileName, file.type, buffer)
    await setFilePublic(result.fileId)

    fileUrl = result.webViewLink
    driveFileId = result.fileId
    driveFolderId = folderId
  } catch (err) {
    console.error('Google Drive upload failed:', err)
    uploadFailed = true
    fileUrl = `upload-failed:${file.name}`
  }

  // 建立新文件記錄，舊文件保留
  const doc = await prisma.userDocument.create({
    data: {
      userId: user.id,
      type: docType,
      fileUrl,
      driveFileId,
      driveFolderId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      status: 'PENDING',
      uploadFailed,
    },
  })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      documentId: doc.id,
      fileUrl: doc.fileUrl,
      status: doc.status,
    },
  })
}
