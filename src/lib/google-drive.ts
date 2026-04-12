// Document type to display label mapping
export const DOC_TYPE_LABELS: Record<string, string> = {
  VEHICLE_REGISTRATION: '行照',
  DRIVER_LICENSE: '駕照',
  INSURANCE: '保險證',
  ID_CARD: '身分證',
  BUSINESS_REGISTRATION: '商業登記',
}

// Google Apps Script Web App URL（Zeabur 環境變數或 fallback）
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxuAYUk0IX_yUE5Igu3dk4sVeKtlCwHjVWtLdzhNuKMFf6JDv-iRpIc_K4kyBS0dt8pfQ/exec'

/**
 * POST to Apps Script and follow the redirect to get the actual JSON response.
 * Apps Script returns 302 with the JSON as a URL parameter; we follow it manually.
 */
async function appsScriptPost(payload: Record<string, string>): Promise<string> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
  })

  // Apps Script returns 302 redirect; follow it to get actual JSON
  if (res.status === 302 || res.status === 301) {
    const location = res.headers.get('location') || res.headers.get('Location')
    if (!location) throw new Error('Apps Script redirect but no Location header')
    // Follow the redirect to the echo URL
    const echoRes = await fetch(location)
    return await echoRes.text()
  }

  // Direct response
  return await res.text()
}

/**
 * POST JSON payload to Apps Script and follow redirect for response.
 * Used for large binary data (file uploads) to avoid URL-encoding corruption.
 */
async function appsScriptPostJson(payload: Record<string, string>): Promise<string> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (res.status === 302 || res.status === 301) {
    const location = res.headers.get('location') || res.headers.get('Location')
    if (!location) throw new Error('Apps Script redirect but no Location header')
    const echoRes = await fetch(location)
    return await echoRes.text()
  }

  return await res.text()
}

/**
 * Upload file to Google Drive via Google Apps Script Web App
 * Apps Script 以用戶身份執行，繞過 Service Account storage quota 限制
 */
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer | Uint8Array,
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  console.log(`[DRIVE] Uploading "${fileName}" (${buffer.length} bytes) via Apps Script`)

  const base64 = (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)).toString('base64')

  const text = await appsScriptPostJson({
    action: 'upload',
    fileName,
    mimeType,
    fileData: base64,
    folderId,
  })

  let result: { success: boolean; data?: { fileId: string; fileUrl?: string; webViewLink?: string; webContentLink?: string }; error?: string }
  try {
    result = JSON.parse(text)
  } catch {
    throw new Error(`Apps Script returned non-JSON: ${text.slice(0, 200)}`)
  }

  if (!result.success) {
    throw new Error(result.error || 'Apps Script upload failed')
  }

  console.log(`[DRIVE] Uploaded: ${result.data!.fileId} -> ${result.data!.webViewLink || result.data!.fileUrl}`)
  return {
    fileId: result.data!.fileId,
    webViewLink: result.data!.webViewLink || result.data!.fileUrl || '',
    webContentLink: result.data!.webContentLink || result.data!.fileUrl || '',
  }
}

/**
 * Get or create a user-specific folder via Apps Script
 */
export async function getOrCreateUserFolder(
  parentFolderId: string,
  _userId: string,
  licensePlate: string,
  name: string,
): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const folderName = `${date}-${licensePlate}-${name}`

  const text = await appsScriptPost({
    action: 'createFolder',
    folderName,
    parentFolderId,
  })

  let result: { success: boolean; data?: { folderId: string }; error?: string }
  try {
    result = JSON.parse(text)
  } catch {
    throw new Error(`Apps Script returned non-JSON: ${text.slice(0, 200)}`)
  }
  if (!result.success) {
    throw new Error(result.error || 'Apps Script createFolder failed')
  }

  console.log(`[DRIVE] User folder: ${folderName} -> ${result.data!.folderId}`)
  return result.data!.folderId
}

/**
 * Get or create the admin test folder via Apps Script
 */
export async function getOrCreateTestFolder(parentFolderId: string): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const folderName = `🔧Drive上傳測試區-${date}`

  const text = await appsScriptPost({
    action: 'createFolder',
    folderName,
    parentFolderId,
  })

  let result: { success: boolean; data?: { folderId: string }; error?: string }
  try {
    result = JSON.parse(text)
  } catch {
    throw new Error(`Apps Script returned non-JSON: ${text.slice(0, 200)}`)
  }
  if (!result.success) {
    throw new Error(result.error || 'Apps Script createFolder failed')
  }

  console.log(`[DRIVE] Test folder: ${folderName} -> ${result.data!.folderId}`)
  return result.data!.folderId
}

/**
 * Set file to be publicly viewable (Apps Script does this automatically on upload)
 */
export async function setFilePublic(_fileId: string): Promise<void> {
  // Apps Script 已設定為 ANYONE_WITH_LINK，無需額外操作
}