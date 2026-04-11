import { NextRequest, NextResponse } from 'next/server'
import { register, getUserFromToken, sendVerifyEmail } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { checkRateLimit } from '@/lib/api-utils'

// Register new user
export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoints
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult

  try {
    const contentType = request.headers.get('content-type') || ''

    let email: string, password: string, name: string, phone: string, role: string
    let licensePlate = '', carType = '', carColor = '', companyName = ''
    let carBrand = '', carModel = '', taxId = '', contactPhone = ''
    let uploadedFiles: { type: string; file: File }[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      email = formData.get('email') as string
      password = formData.get('password') as string
      name = formData.get('name') as string
      phone = formData.get('phone') as string
      role = formData.get('role') as string
      licensePlate = (formData.get('licensePlate') as string) || ''
      carType = (formData.get('carType') as string) || '轎車'
      carColor = (formData.get('carColor') as string) || ''
      companyName = (formData.get('companyName') as string) || ''
      carBrand = (formData.get('carBrand') as string) || ''
      carModel = (formData.get('carModel') as string) || ''
      taxId = (formData.get('taxId') as string) || ''
      contactPhone = (formData.get('contactPhone') as string) || ''

      // Collect document files
      const docTypes = ['VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'INSURANCE', 'ID_CARD', 'BUSINESS_REGISTRATION']
      for (const dt of docTypes) {
        const f = formData.get(dt) as File | null
        if (f && f.size > 0) uploadedFiles.push({ type: dt, file: f })
      }
    } else {
      const body = await request.json()
      ;({ email, password, name, phone, role, licensePlate, carType, carColor, companyName, carBrand, carModel, taxId, contactPhone } = body)
    }

    // Basic validation
    if (!email || !password || !name || !phone || !role) {
      console.error('[REGISTER] Missing required fields:', { email: !!email, password: !!password, name: !!name, phone: !!phone, role: !!role })
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少必填欄位' },
        { status: 400 }
      )
    }

    if (!['DRIVER', 'DISPATCHER'].includes(role)) {
      console.error('[REGISTER] Invalid role:', role)
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的角色' },
        { status: 400 }
      )
    }

    if (role === 'DRIVER' && !licensePlate) {
      console.error('[REGISTER] Driver missing licensePlate')
      return NextResponse.json<ApiResponse>(
        { success: false, error: '司機必須提供車牌號碼' },
        { status: 400 }
      )
    }

    // Register user
    const result = await register(email, password, name, phone, role as 'DRIVER' | 'DISPATCHER', {
      licensePlate,
      carType: carType || '轎車',
      carColor,
      companyName,
      carBrand: carBrand || '',
      carModel: carModel || '',
      taxId: taxId || '',
      contactPhone: contactPhone || '',
    })

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    // Upload documents to Google Drive (if any) — failures do NOT block registration
    if (uploadedFiles.length > 0) {
      console.log(`[REGISTER] Received ${uploadedFiles.length} files:`, uploadedFiles.map(f => `${f.type} (${f.file.name}, ${f.file.size} bytes)`))
      const { uploadFileToDrive, getOrCreateUserFolder, setFilePublic } = await import('@/lib/google-drive')
      const { prisma } = await import('@/lib/prisma')

      for (const { type, file } of uploadedFiles) {
        try {
          console.log(`[REGISTER] Uploading ${type} to Google Drive...`)
          const driver = await prisma.driver.findUnique({ where: { userId: result.user!.id } })
          const dispatcher = await prisma.dispatcher.findUnique({ where: { userId: result.user!.id } })
          const plate = driver?.licensePlate || dispatcher?.companyName || result.user!.id

          const ext = file.name.split('.').pop() || 'bin'
          const labelMap: Record<string, string> = {
            VEHICLE_REGISTRATION: '行照',
            DRIVER_LICENSE: '駕照',
            INSURANCE: '保險證',
            ID_CARD: '身分證',
            BUSINESS_REGISTRATION: '商業登記',
          }
          const fileName = `${plate}-${labelMap[type] || type}.${ext}`
          const buffer = Buffer.from(await file.arrayBuffer())

          const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
          if (!rootFolderId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID 未設定')

          const folderId = await getOrCreateUserFolder(rootFolderId, result.user!.id, plate)
          console.log(`[REGISTER] Created/retrieved folder: ${folderId}`)
          const uploaded = await uploadFileToDrive(folderId, fileName, file.type, buffer)
          console.log(`[REGISTER] Uploaded file: ${uploaded.fileId} -> ${uploaded.webViewLink}`)
          await setFilePublic(uploaded.fileId)

          await prisma.userDocument.create({
            data: {
              userId: result.user!.id,
              type,
              fileUrl: uploaded.webViewLink,
              driveFileId: uploaded.fileId,
              driveFolderId: folderId,
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              status: 'PENDING',
              uploadFailed: false,
            },
          })
        } catch (err) {
          console.error(`[REGISTER] 文件上傳失敗 (${type}):`, err)
          const { prisma } = await import('@/lib/prisma')
          await prisma.userDocument.create({
            data: {
              userId: result.user!.id,
              type,
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              status: 'PENDING',
              uploadFailed: true,
            },
          })
        }
      }
    } else {
      console.log('[REGISTER] No files received for upload')
    }

    // Send verification email (async, don't await)
    sendVerifyEmail(result.user!.id, email).catch(err => {
      console.error('Failed to send verify email:', err)
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { token: result.token, user: result.user },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

// Get current user
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未提供認證令牌' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的認證令牌' },
        { status: 401 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
        rejectReason: user.rejectReason,
        driver: user.driver,
        dispatcher: user.dispatcher,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
