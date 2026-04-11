require('dotenv').config({ override: true });
const { google } = require('googleapis');

const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

if (!key) { console.log('GOOGLE_SERVICE_ACCOUNT_KEY not set'); process.exit(1); }
if (!rootFolderId) { console.log('GOOGLE_DRIVE_ROOT_FOLDER_ID not set'); process.exit(1); }

const credentials = JSON.parse(key);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

async function main() {
  console.log('Testing Google Drive access...');
  console.log('Service account:', credentials.client_email);
  console.log('Root folder ID:', rootFolderId);

  try {
    // List root folder contents
    const res = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 20,
    });

    const files = res.data.files || [];
    console.log(`\nRoot folder has ${files.length} items:`);
    files.forEach(f => {
      console.log(`  [${f.mimeType === 'application/vnd.google-apps.folder' ? 'DIR ' : 'FILE'}]
  ${f.name} (${f.id})`);
    });

    // Try to get the root folder itself
    try {
      const folder = await drive.files.get({ fileId: rootFolderId, fields: 'id, name' });
      console.log('\nRoot folder name:', folder.data.name);
    } catch (e) {
      console.log('\nCannot get root folder info:', e.message);
    }
  } catch (err) {
    console.error('Drive error:', err.message);
    if (err.message.includes('permission')) {
      console.log('\n>>> PERMISSION DENIED: 請確認服務帳號有該資料夾的編輯權限');
    }
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
