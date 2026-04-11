import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

  const results: Record<string, string> = {}
  results['GOOGLE_SERVICE_ACCOUNT_KEY'] = key ? `SET (${key.length} chars)` : 'NOT SET'
  results['GOOGLE_DRIVE_ROOT_FOLDER_ID'] = rootId ? `SET (${rootId.length} chars, id: ${rootId})` : 'NOT SET'

  // Try to parse the key
  if (key) {
    try {
      const parsed = JSON.parse(key.replace(/\\n/g, '\n'))
      results['key_parsed'] = `OK (type: ${parsed.type || 'service_account'}, client_email: ${parsed.client_email || 'N/A'})`
    } catch (e: any) {
      results['key_parsed'] = `FAILED: ${e.message || String(e)}`
    }
  }

  // Try to actually initialize Drive
  if (key && rootId) {
    try {
      const { google } = await import('googleapis')
      let normalizedKey = key
      try { JSON.parse(key) } catch { normalizedKey = key.replace(/\\n/g, '\n') }
      const credentials = JSON.parse(normalizedKey)
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      })
      const drive = google.drive({ version: 'v3', auth })
      results['drive_init'] = 'OK'

      // Try to list root folder by ID directly
      try {
        const folderRes = await drive.files.get({ fileId: rootId, fields: 'id,name,mimeType' })
        results['root_folder'] = `OK (${folderRes.data.name}, type: ${folderRes.data.mimeType})`
      } catch (e: any) {
        results['root_folder'] = `GET FAILED: ${e.message || String(e)}`
      }
    } catch (e: any) {
      results['drive_init'] = `FAILED: ${e.message || String(e)}`
    }
  }

  return NextResponse.json(results)
}
