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

  const params = new URLSearchParams()
  params.append('action', 'upload')
  params.append('fileName', fileName)
  params.append('mimeType', mimeType)
  params.append('fileData', base64)
  params.append('folderId', folderId)

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed: ${res.status} ${text}`)
  }

  const result = await res.json()
  if (!result.success) {
    throw new Error(result.error || 'Apps Script upload failed')
  }

  console.log(`[DRIVE] Uploaded: ${result.data.fileId} -> ${result.data.fileUrl}`)
  return {
    fileId: result.data.fileId,
    webViewLink: result.data.webViewLink || result.data.fileUrl,
    webContentLink: result.data.webContentLink || result.data.fileUrl,
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

  const params = new URLSearchParams()
  params.append('action', 'createFolder')
  params.append('folderName', folderName)
  params.append('parentFolderId', parentFolderId)

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const result = await res.json()
  if (!result.success) {
    throw new Error(result.error || 'Apps Script createFolder failed')
  }

  console.log(`[DRIVE] Folder: ${folderName} -> ${result.data.folderId}`)
  return result.data.folderId
}

/**
 * Get or create the admin test folder via Apps Script
 */
export async function getOrCreateTestFolder(parentFolderId: string): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const folderName = `🔧Drive上傳測試區-${date}`

  const params = new URLSearchParams()
  params.append('action', 'createFolder')
  params.append('folderName', folderName)
  params.append('parentFolderId', parentFolderId)

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const result = await res.json()
  if (!result.success) {
    throw new Error(result.error || 'Apps Script createFolder failed')
  }

  console.log(`[DRIVE] Test folder: ${folderName} -> ${result.data.folderId}`)
  return result.data.folderId
}

/**
 * Set file to be publicly viewable (Apps Script does this automatically on upload)
 */
export async function setFilePublic(_fileId: string): Promise<void> {
  // Apps Script 已設定為 ANYONE_WITH_LINK，無需額外操作
}
