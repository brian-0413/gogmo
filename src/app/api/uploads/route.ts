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

  // Get user's license plate and name (Driver or Dispatcher)
  const driver = await prisma.driver.findUnique({ where: { userId: user.id } })
  const dispatcher = await prisma.dispatcher.findUnique({ where: { userId: user.id } })
  const licensePlate = driver?.licensePlate || dispatcher?.companyName || user.id
  const userName = user.name

  // Build Google Drive file name: {車牌}-{姓名}-{文件類型}.{ext}
  const ext = file.name.split('.').pop() || 'bin'
  const docTypeLabel = docType ? (DOC_TYPE_FILE_NAME[docType] || docType) : '文件'
  const driveFileName = `${licensePlate}-${userName}-${docTypeLabel}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  let fileUrl = ''
  let driveFileId = ''
  let driveFolderId = ''
  let uploadFailed = false

  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootFolderId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID 未設定')

    const folderId = await getOrCreateUserFolder(rootFolderId, user.id, licensePlate, userName)
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

  // Delete old documents of the same type (avoid duplicates)
  if (docType) {
    await prisma.userDocument.deleteMany({
      where: { userId: user.id, type: docType },
    })
  }

  // Create UserDocument record
  const doc = await prisma.userDocument.create({
    data: {
      userId: user.id,
      type: docType || 'OTHER',
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
    data: { fileUrl, fileName: file.name, mimeType: file.type, sizeBytes: file.size, uploadFailed },
  })
}
