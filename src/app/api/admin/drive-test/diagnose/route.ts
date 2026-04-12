import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { getDriveService } from '@/lib/google-drive'
import { ApiResponse } from '@/types'

// GET /api/admin/drive-test/diagnose — 診斷 Drive API 設定問題
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'ADMIN') return NextResponse.json<ApiResponse>({ success: false, error: '僅限管理員' }, { status: 403 })

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

  const result: Record<string, unknown> = {}

  // 1. Check env vars
  result.hasKey = !!key
  result.keyLength = key ? key.length : 0
  result.hasRootFolderId = !!rootFolderId
  result.rootFolderId = rootFolderId || null
  result.nodeEnv = process.env.NODE_ENV

  // 2. Try JSON.parse on the key
  try {
    const credentials = JSON.parse(key!)
    result.jsonParse = 'OK'
    result.clientEmail = credentials.client_email
    result.projectId = credentials.project_id
    result.hasPrivateKey = !!credentials.private_key
    result.privateKeyStart = credentials.private_key?.substring(0, 30)
  } catch (e) {
    result.jsonParse = 'FAILED'
    result.jsonError = e instanceof Error ? e.message : String(e)
    return NextResponse.json<ApiResponse>({ success: false, data: result }, { status: 200 })
  }

  // 3. Try creating Drive service
  try {
    const drive = getDriveService()
    result.driveService = 'CREATED'
  } catch (e) {
    result.driveService = 'FAILED'
    result.driveServiceError = e instanceof Error ? e.message : String(e)
    return NextResponse.json<ApiResponse>({ success: false, data: result }, { status: 200 })
  }

  // 4. Try listing files in root folder
  try {
    const drive = getDriveService()
    const res = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 5,
    })
    result.folderList = 'OK'
    result.folders = res.data.files
  } catch (e) {
    result.folderList = 'FAILED'
    result.folderListError = e instanceof Error ? e.message : String(e)
    if ((e as any).code) result.errorCode = (e as any).code
    if ((e as any).errors) result.errorDetails = (e as any).errors
  }

  return NextResponse.json<ApiResponse>({ success: true, data: result }, { status: 200 })
}
