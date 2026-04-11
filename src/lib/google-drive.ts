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
function getDriveService() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 未設定')

  console.log('[DRIVE] GOOGLE_SERVICE_ACCOUNT_KEY is', key.length > 0 ? 'SET' : 'EMPTY')
  console.log('[DRIVE] GOOGLE_DRIVE_ROOT_FOLDER_ID is', process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ? 'SET' : 'EMPTY')

  const credentials = JSON.parse(key)
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
 * Returns: folderId
 */
export async function getOrCreateUserFolder(
  parentFolderId: string,
  userId: string,
  licensePlate: string,
): Promise<string> {
  const drive = getDriveService()
  const folderName = `${userId}_${licensePlate}`

  // Check if folder already exists
  const res = await drive.files.list({
    q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // Create new folder
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
 * Upload file to Google Drive
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
  buffer: Buffer,
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  const drive = getDriveService()
  console.log(`[DRIVE] Uploading "${fileName}" (${buffer.length} bytes, ${mimeType}) to folder ${folderId}`)

  // Check if file with same name exists (overwrite if so)
  const existing = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const existingId = existing.data.files?.[0]?.id

  // Create a readable stream from buffer
  const { Readable } = await import('stream')
  const media = {
    mimeType,
    body: Readable.from(buffer),
  }

  if (existingId) {
    // Overwrite existing file
    const updated = await drive.files.update({
      fileId: existingId,
      requestBody: { name: fileName },
      media,
      fields: 'id, webViewLink, webContentLink',
    })
    return {
      fileId: existingId,
      webViewLink: updated.data.webViewLink!,
      webContentLink: updated.data.webContentLink!,
    }
  } else {
    // Create new file
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media,
      fields: 'id, webViewLink, webContentLink',
    })
    return {
      fileId: created.data.id!,
      webViewLink: created.data.webViewLink!,
      webContentLink: created.data.webContentLink!,
    }
  }
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
