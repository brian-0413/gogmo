import { google, drive_v3 } from 'googleapis'

// Document type to display label mapping
export const DOC_TYPE_LABELS: Record<string, string> = {
  VEHICLE_REGISTRATION: '行照',
  DRIVER_LICENSE: '駕照',
  INSURANCE: '保險證',
  ID_CARD: '身分證',
  BUSINESS_REGISTRATION: '商業登記',
}

/**
 * Create Google Drive service instance using Service Account authentication
 */
export function getDriveService() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 未設定')

  console.log('[DRIVE] GOOGLE_SERVICE_ACCOUNT_KEY is', key.length > 0 ? 'SET' : 'EMPTY')
  console.log('[DRIVE] GOOGLE_DRIVE_ROOT_FOLDER_ID is', process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ? 'SET' : 'EMPTY')

  // Zeabur may store multi-line JSON in two ways:
  // 1. As a single-line JSON with \n as two characters (backslash + n) — .env.local style.
  //    JSON.parse handles this directly (the \n is a valid JSON escape sequence).
  // 2. As actual newlines (Zeabur UI pastes the raw JSON with real line breaks).
  //    In this case, process.env contains actual newlines which break JSON.parse.
  //
  // Strategy: Try JSON.parse directly first. If it fails, check if the key has actual
  // newlines (ASCII 10) and normalize them to \n escape sequences before retrying.
  let credentials
  try {
    credentials = JSON.parse(key)
  } catch (_) {
    // Key has actual newlines (Zeabur multi-line format) — replace with \n escape
    // Must check BEFORE any replacement to avoid false positives from \n→\n
    const hasActualNewlines = key.includes('\n')
    if (hasActualNewlines) {
      // Replace actual newlines with \n escape sequence for JSON
      // Handle both \n (Unix) and \r\n (Windows) line endings
      const escaped = key.replace(/\r?\n/g, '\\n')
      console.log('[DRIVE] Normalized actual newlines in key (Zeabur multi-line format)')
      credentials = JSON.parse(escaped)
    } else {
      throw new Error('Invalid JSON')
    }
  }
  console.log('[DRIVE] Service account:', credentials.client_email)
  console.log('[DRIVE] Project:', credentials.project_id)

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  return google.drive({ version: 'v3', auth })
}

/**
 * Get or create a user-specific folder in Google Drive
 * parentFolderId: root folder ID (GOOGLE_DRIVE_ROOT_FOLDER_ID)
 * userId: user ID
 * licensePlate: vehicle license plate
 * name: user name
 * Returns: folderId
 */
/**
 * Escape special characters for Google Drive API query strings.
 * Single quotes must be escaped as \' and backslashes as \\.
 */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function getOrCreateUserFolder(
  parentFolderId: string,
  userId: string,
  licensePlate: string,
  name: string,
): Promise<string> {
  const drive = getDriveService()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safePlate = escapeDriveQuery(licensePlate)
  const safeName = escapeDriveQuery(name)
  const folderName = `${date}-${safePlate}-${safeName}`

  // Check if folder already exists
  const res = await drive.files.list({
    q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  })

  if (res.data.files && res.data.files.length > 0) {
    console.log(`[DRIVE] Found existing folder: ${folderName} (${res.data.files[0].id})`)
    return res.data.files[0].id!
  }

  // Create new folder
  console.log(`[DRIVE] Creating new folder: ${folderName}`)
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })

  return folder.data.id!
}

/**
 * Get or create the admin test folder in Google Drive
 * parentFolderId: root folder ID (GOOGLE_DRIVE_ROOT_FOLDER_ID)
 * Returns: folderId
 */
export async function getOrCreateTestFolder(parentFolderId: string): Promise<string> {
  const drive = getDriveService()
  const testFolderName = '🔧Drive上傳測試區'
  const safeName = escapeDriveQuery(testFolderName)
  const safeParent = escapeDriveQuery(parentFolderId)

  const res = await drive.files.list({
    q: `name='${safeName}' and '${safeParent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  })

  if (res.data.files && res.data.files.length > 0) {
    console.log(`[DRIVE] Found test folder: ${testFolderName} (${res.data.files[0].id})`)
    return res.data.files[0].id!
  }

  console.log(`[DRIVE] Creating test folder: ${testFolderName}`)
  const folder = await drive.files.create({
    requestBody: {
      name: testFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })

  return folder.data.id!
}

/**
 * Upload file to Google Drive using raw fetch — bypasses googleapis pipe() bug
 * folderId: target folder ID
 * fileName: file name (without path)
 * mimeType: MIME type
 * buffer: file content (Buffer)
 * Returns: { fileId, webViewLink, webContentLink }
 */
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer | Uint8Array,
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 未設定')

  let credentials
  try {
    credentials = JSON.parse(key)
  } catch (_) {
    if (key.includes('\n')) {
      credentials = JSON.parse(key.replace(/\r?\n/g, '\\n'))
    } else {
      throw new Error('Invalid JSON')
    }
  }

  // Get access token from service account
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: await createJwt(credentials),
    }),
  })
  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Token request failed: ${tokenRes.status} ${text}`)
  }
  const { access_token } = await tokenRes.json()

  // Check if file exists (to overwrite)
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )
  const listData = await listRes.json()
  const existingId = listData.files?.[0]?.id

  // Multipart metadata
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  })

  // Build multipart request body
  const boundary = 'boundary_' + Math.random().toString(36).slice(2)
  const bodyParts: string[] = []

  bodyParts.push(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`)

  const contentTypeHeader = `Content-Type: ${mimeType}\r\nContent-Length: ${buffer.length}`
  bodyParts.push(`--${boundary}\r\n${contentTypeHeader}\r\n\r\n`)
  bodyParts.push(Buffer.isBuffer(buffer) ? buffer.toString('binary') : Buffer.from(buffer).toString('binary'))
  bodyParts.push(`\r\n--${boundary}--\r\n`)

  const multipartBody = bodyParts.join('')
  const fullLength = Buffer.byteLength(multipartBody, 'utf8')

  let url: string, method: string
  if (existingId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,webViewLink,webContentLink`
    method = 'PATCH'
  } else {
    url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink'
    method = 'POST'
  }

  const uploadRes = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(fullLength),
    },
    body: multipartBody,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`Upload failed: ${uploadRes.status} ${text}`)
  }

  const result = await uploadRes.json()
  return {
    fileId: result.id,
    webViewLink: result.webViewLink,
    webContentLink: result.webContentLink,
  }
}

/**
 * Create a signed JWT for Google OAuth2 service account
 */
async function createJwt(credentials: Record<string, unknown>): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const claims = btoa(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const privateKey = (credentials.private_key as string).replace(/\\n/g, '\n')
  const signingInput = `${header}.${claims}`

  // Use Node.js native signing
  const { createSign } = await import('crypto')
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()
  const sig = signer.sign(privateKey, 'base64url')
  return `${signingInput}.${sig}`
}

/**
 * Set file to be publicly viewable by anyone with the link
 */
export async function setFilePublic(fileId: string): Promise<void> {
  const drive = getDriveService()
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })
}
