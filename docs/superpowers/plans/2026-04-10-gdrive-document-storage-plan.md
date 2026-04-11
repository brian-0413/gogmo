# Google Drive 文件儲存整合實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將註冊流程的三證文件從本地磁碟改存 Google Drive，並讓派單方能即時查看司機三證。

**Architecture:**
- 使用 Google Cloud 服務帳號（Service Account）+ Google Drive API v3 進行無 OAuth 認證
- 檔案結構：`{GOOGLE_DRIVE_ROOT_FOLDER_ID}/{userId}_{車牌}/` 下依類型命名
- 失敗時註冊仍成功，但文件標記 `uploadFailed = true`，用戶可在後台補傳
- 派單方在已接單司機資訊卡旁新增「查看證件」按鈕，點擊開啟 Google Drive 分享連結

**Tech Stack:** `googleapis` npm 套件，Node.js JWT 服務帳號認證

---

## 檔案變更對照

| 動作 | 檔案 |
|------|------|
| Create | `src/lib/google-drive.ts` — Google Drive 上傳工具函式 |
| Create | `src/app/api/drivers/[id]/documents/route.ts` — 司機文件查詢 API |
| Modify | `.env.local` — 新增環境變數 |
| Modify | `prisma/schema.prisma` — UserDocument 新增 4 個欄位 |
| Modify | `src/app/api/uploads/route.ts` — 改用 Google Drive SDK |
| Modify | `src/app/api/auth/[[...nextauth]]/route.ts` — 支援 multipart 上傳 + 失敗處理 |
| Modify | `src/lib/auth.ts` — `register()` 支援文件上傳 |
| Modify | `src/components/dispatcher/OrderCard.tsx` — 司機資訊區新增查看證件按鈕 |
| Modify | `src/app/dashboard/admin/reviews/page.tsx` — 文件連結格式調整（已相容） |
| Modify | `package.json` — 新增 `googleapis` 依賴 |

---

## Task 1: 安裝套件 + 環境變數設定

**Files:**
- Modify: `package.json`
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: 安裝 `googleapis` 套件**

Run: `cd /c/Users/BrianNB/airport-dispatch-platform && npm install googleapis`
Expected: 安裝成功，package.json 新增 `"googleapis": "^140.0.0"`

- [ ] **Step 2: 在 `.env.local` 新增環境變數**

```bash
# Google Drive Service Account（完整的 service account JSON 字串）
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Google Drive 根資料夾 ID（從 Drive URL 複製：drive.google.com/drive/folders/{此段}）
GOOGLE_DRIVE_ROOT_FOLDER_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456
```

- [ ] **Step 3: 在 `.env.example` 新增範例環境變數**

```bash
GOOGLE_SERVICE_ACCOUNT_KEY=...（從 Google Cloud Console 建立服務帳號並下載金鑰 JSON）
GOOGLE_DRIVE_ROOT_FOLDER_ID=...（在 Google Drive 建立「註冊文件」資料夾，複製其 ID）
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local .env.example
git commit -m "feat: 安裝 googleapis 並新增 Drive 環境變數"
```

---

## Task 2: Prisma Schema 更新

**Files:**
- Modify: `prisma/schema.prisma:297-311`

- [ ] **Step 1: 在 `UserDocument` model 新增 4 個欄位**

在 `prisma/schema.prisma` 的 `model UserDocument {}` 區塊中，新增：

```prisma
model UserDocument {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // VEHICLE_REGISTRATION / DRIVER_LICENSE / INSURANCE / ID_CARD / BUSINESS_REGISTRATION
  fileUrl   String?  // 改存 Google Drive 分享連結（webViewLink）
  driveFileId   String?  // Google Drive 檔案 ID
  driveFolderId String? // Google Drive 資料夾 ID
  fileName  String   // 原始檔案名稱
  mimeType  String   // image/jpeg / image/png / application/pdf
  sizeBytes Int      // 檔案大小（位元組）
  status    String   @default("PENDING")  // PENDING / APPROVED / REJECTED
  uploadFailed Boolean @default(false)   // 上傳失敗標記
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("user_documents")
}
```

> 移除原本的 `fileUrl   String`（非 optional），改為 `fileUrl String?`（Google Drive URL）。

- [ ] **Step 2: 產生 Prisma migration**

Run: `cd /c/Users/BrianNB/airport-dispatch-platform && npx prisma migrate dev --name add_gdrive_fields_to_user_document`
Expected: Migration 檔案建立成功

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: UserDocument 新增 driveFileId/driveFolderId/uploadFailed 欄位"
```

---

## Task 3: Google Drive 工具函式

**Files:**
- Create: `src/lib/google-drive.ts`

- [ ] **Step 1: 建立 `src/lib/google-drive.ts`**

```typescript
import { google, drive_v3 } from 'googleapis'

// 類型別名
type GDriveFile = drive_v3.Schema$File

// 文件類型 → 顯示名稱
export const DOC_TYPE_LABELS: Record<string, string> = {
  VEHICLE_REGISTRATION: '行照',
  DRIVER_LICENSE: '駕照',
  INSURANCE: '保險證',
  ID_CARD: '身分證',
  BUSINESS_REGISTRATION: '商業登記',
}

/**
 * 建立 Google Drive 服務實例（服務帳號認證）
 */
function getDriveService() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 未設定')

  const credentials = JSON.parse(key)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  return google.drive({ version: 'v3', auth })
}

/**
 * 查詢或建立用戶專屬資料夾
 * parentFolderId: 根資料夾 ID（GOOGLE_DRIVE_ROOT_FOLDER_ID）
 * userId: 用戶 ID
 * licensePlate: 車牌
 * 回傳: folderId
 */
export async function getOrCreateUserFolder(
  parentFolderId: string,
  userId: string,
  licensePlate: string,
): Promise<string> {
  const drive = getDriveService()
  const folderName = `${userId}_${licensePlate}`

  // 查詢是否已存在
  const res = await drive.files.list({
    q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // 建立新資料夾
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
 * 上傳檔案到 Google Drive
 * folderId: 目標資料夾 ID
 * fileName: 檔案名稱（不含路徑）
 * mimeType: MIME 類型
 * buffer: 檔案內容（Buffer）
 * 回傳: { fileId, webViewLink, webContentLink }
 */
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  const drive = getDriveService()

  // 先查詢是否已有同名檔案（有就覆寫）
  const existing = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const existingId = existing.data.files?.[0]?.id

  const media = {
    mimeType,
    body: new (await import('stream')).Readable({
      read() { this.push(buffer); this.push(null) },
    }),
  } as any

  const uploadParams: drive_v3.Params$Resource$Files$Create = {
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media,
    fields: 'id, webViewLink, webContentLink',
  }

  if (existingId) {
    // 覆寫現有檔案
    uploadParams.requestBody = { name: fileName }
    const updated = await drive.files.update({
      fileId: existingId,
      ...uploadParams,
    } as any)
    return {
      fileId: existingId,
      webViewLink: updated.data.webViewLink!,
      webContentLink: updated.data.webContentLink!,
    }
  } else {
    // 新建
    const created = await drive.files.create(uploadParams as any)
    return {
      fileId: created.data.id!,
      webViewLink: created.data.webViewLink!,
      webContentLink: created.data.webContentLink!,
    }
  }
}

/**
 * 設定檔案為 anyoneWithLink 可檢視
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/google-drive.ts
git commit -m "feat: 新增 google-drive.ts 上傳工具函式"
```

---

## Task 4: 修改上傳 API（支援 Google Drive）

**Files:**
- Modify: `src/app/api/uploads/route.ts`

- [ ] **Step 1: 修改 `POST /api/uploads`**

用 `google-drive.ts` 取代原本的磁碟寫入邏輯：

```typescript
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

  // 取得用戶車牌（Driver 或 Dispatcher 各自取）
  const driver = await prisma.driver.findUnique({ where: { userId: user.id } })
  const dispatcher = await prisma.dispatcher.findUnique({ where: { userId: user.id } })
  const licensePlate = driver?.licensePlate || dispatcher?.companyName || user.id

  // 組成 Google Drive 檔名
  const ext = file.name.split('.').pop() || 'bin'
  const docTypeLabel = docType ? (DOC_TYPE_FILE_NAME[docType] || docType) : '文件'
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

  // 刪除同類型舊檔（若有的話，避免重複）
  if (docType) {
    await prisma.userDocument.deleteMany({
      where: { userId: user.id, type: docType },
    })
  }

  // 建立 UserDocument record
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
      status: uploadFailed ? 'PENDING' : 'PENDING',
      uploadFailed,
    },
  })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { fileUrl, fileName: file.name, mimeType: file.type, sizeBytes: file.size, uploadFailed },
  })
}
```

- [ ] **Step 2: Build 確認編譯正確**

Run: `cd /c/Users/BrianNB/airport-dispatch-platform && npm run build`
Expected: Build 成功，無 TypeScript 錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/uploads/route.ts
git commit -m "feat: 上傳 API 改用 Google Drive SDK 儲存文件"
```

---

## Task 5: 修改註冊流程（支援文件上傳 + 失敗處理）

**Files:**
- Modify: `src/app/api/auth/[[...nextauth]]/route.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: 修改 `src/app/api/auth/[[...nextauth]]/route.ts` 的 POST**

讓註冊 API 支援 `multipart/form-data`（Step 4 送出時用同一個請求），同時處理文件上傳：

```typescript
// POST (修改) — 支援 multipart 上傳
export async function POST(request: NextRequest) {
  const rateLimitResult = checkRateLimit(request, { type: 'auth' })
  if (rateLimitResult) return rateLimitResult

  try {
    // 判斷 content-type：JSON → 純文字註冊；FormData → 註冊+上傳
    const contentType = request.headers.get('content-type') || ''

    let email: string, password: string, name: string, phone: string, role: string
    let licensePlate: string, carType: string, carColor: string, companyName: string
    let carBrand: string, carModel: string, taxId: string, contactPhone: string
    let uploadedFiles: { type: string; file: File }[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      email = formData.get('email') as string
      password = formData.get('password') as string
      name = formData.get('name') as string
      phone = formData.get('phone') as string
      role = formData.get('role') as string
      licensePlate = formData.get('licensePlate') as string || ''
      carType = formData.get('carType') as string || '轎車'
      carColor = formData.get('carColor') as string || ''
      companyName = formData.get('companyName') as string || ''
      carBrand = formData.get('carBrand') as string || ''
      carModel = formData.get('carModel') as string || ''
      taxId = formData.get('taxId') as string || ''
      contactPhone = formData.get('contactPhone') as string || ''

      // 收集所有文件欄位
      const docTypes = ['VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'INSURANCE', 'ID_CARD', 'BUSINESS_REGISTRATION']
      for (const dt of docTypes) {
        const f = formData.get(dt) as File | null
        if (f && f.size > 0) uploadedFiles.push({ type: dt, file: f })
      }
    } else {
      const body = await request.json()
      ;({ email, password, name, phone, role, licensePlate, carType, carColor, companyName, carBrand, carModel, taxId, contactPhone } = body)
    }

    // 基本驗證（同原本）
    if (!email || !password || !name || !phone || !role) {
      return NextResponse.json<ApiResponse>({ success: false, error: '缺少必填欄位' }, { status: 400 })
    }

    // 執行註冊
    const result = await register(email, password, name, phone, role as 'DRIVER' | 'DISPATCHER', {
      licensePlate, carType, carColor, companyName, carBrand, carModel, taxId, contactPhone,
    })

    if (!result.success) {
      return NextResponse.json<ApiResponse>({ success: false, error: result.error }, { status: 400 })
    }

    // 如果有文件，嘗試上傳到 Google Drive（失敗不阻擋註冊）
    if (uploadedFiles.length > 0) {
      // 動態 import 上傳函式
      const { uploadToDriveFromBuffer } = await import('@/lib/google-drive-upload')
      for (const { type, file } of uploadedFiles) {
        try {
          const { prisma } = await import('@/lib/prisma')
          const driver = await prisma.driver.findUnique({ where: { userId: result.user!.id } })
          const dispatcher = await prisma.dispatcher.findUnique({ where: { userId: result.user!.id } })
          const plate = driver?.licensePlate || dispatcher?.companyName || result.user!.id

          const ext = file.name.split('.').pop() || 'bin'
          const label = type === 'VEHICLE_REGISTRATION' ? '行照'
            : type === 'DRIVER_LICENSE' ? '駕照'
            : type === 'INSURANCE' ? '保險證'
            : type === 'ID_CARD' ? '身分證' : '商業登記'
          const fileName = `${plate}-${label}.${ext}`
          const buffer = Buffer.from(await file.arrayBuffer())

          const { fileUrl, driveFileId, driveFolderId } = await uploadToDriveFromBuffer(
            result.user!.id, plate, fileName, file.type, buffer,
          )
          await setFilePublic(driveFileId)

          await prisma.userDocument.create({
            data: {
              userId: result.user!.id, type, fileUrl, driveFileId, driveFolderId,
              fileName: file.name, mimeType: file.type, sizeBytes: file.size,
              status: 'PENDING', uploadFailed: false,
            },
          })
        } catch (err) {
          console.error(`文件上傳失敗 (${type}):`, err)
          const { prisma } = await import('@/lib/prisma')
          await prisma.userDocument.create({
            data: {
              userId: result.user!.id, type, fileName: file.name,
              mimeType: file.type, sizeBytes: file.size,
              status: 'PENDING', uploadFailed: true,
            },
          })
        }
      }
    }

    // 寄驗證信（async）
    sendVerifyEmail(result.user!.id, email).catch(err => {
      console.error('Failed to send verify email:', err)
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { token: result.token, user: result.user },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json<ApiResponse>({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
```

> 說明：由於 Google Drive 上傳函式需要 driver/dispatcher 資料（車牌），因此在 `POST /api/auth` 中自己實作上傳邏輯而非呼叫 `/api/uploads`（因為上傳 API 需要 Bearer token，註冊時還沒有 token）。

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/[[...nextauth]]/route.ts
git commit -m "feat: 註冊 API 支援 multipart 上傳文件，失敗不阻擋註冊"
```

---

## Task 6: 司機文件查詢 API

**Files:**
- Create: `src/app/api/drivers/[id]/documents/route.ts`

- [ ] **Step 1: 建立 `GET /api/drivers/[id]/documents`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { prisma } from '@/lib/prisma'

// GET /api/drivers/[id]/documents
// 驗證請求者是 DISPATCHER 身份，回傳該司機的所有 UserDocument
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: '未授權' }, { status: 401 })
  }
  const currentUser = await getUserFromToken(token)
  if (!currentUser) {
    return NextResponse.json<ApiResponse>({ success: false, error: '無效的 token' }, { status: 401 })
  }

  // 只允許 DISPATCHER 查詢
  if (currentUser.role !== 'DISPATCHER' && currentUser.role !== 'ADMIN') {
    return NextResponse.json<ApiResponse>({ success: false, error: '無權限' }, { status: 403 })
  }

  const { id } = await params

  const docs = await prisma.userDocument.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { documents: docs },
  })
}
```

- [ ] **Step 2: Build 確認**

Run: `cd /c/Users/BrianNB/airport-dispatch-platform && npm run build`
Expected: Build 成功

- [ ] **Step 3: Commit**

```bash
git add src/app/api/drivers/[id]/documents/route.ts
git commit -m "feat: 新增 GET /api/drivers/[id]/documents 司機文件查詢 API"
```

---

## Task 7: 派單方 — 司機資訊卡「查看證件」按鈕

**Files:**
- Modify: `src/components/dispatcher/OrderCard.tsx`

- [ ] **Step 1: 在司機資訊區塊新增「查看證件」按鈕**

在 `OrderCard.tsx` 的司機資訊區塊（`{hasDriver && !isEditing ? ...}` 區塊，約 line 154-165）：

在 `<span className="text-[13px] text-[#717171]">{order.driver?.carColor} {order.driver?.carType}</span>` 這行後面加入：

```tsx
<button
  onClick={async (e) => {
    e.stopPropagation()
    if (!token) return
    try {
      const res = await fetch(`/api/drivers/${order.driver?.userId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && data.data.documents?.length > 0) {
        // 開啟第一份文件
        window.open(data.data.documents[0].fileUrl, '_blank')
      } else {
        alert('暫無文件資料')
      }
    } catch { alert('無法載入文件') }
  }}
  className="ml-auto text-[11px] px-2 py-1 bg-[#0C447C] text-white rounded hover:bg-[#0A3570] transition-colors"
>
  查看證件
</button>
```

> 需要在元件頂部確保 `token` 可用（從 props 或 context 取得）。

- [ ] **Step 2: Build 確認**

Run: `cd /c/Users/BrianNB/airport-dispatch-platform && npm run build`
Expected: Build 成功，無 TypeScript 錯誤

- [ ] **Step 3: Commit**

```bash
git add src/components/dispatcher/OrderCard.tsx
git commit -m "feat: 派單方司機資訊卡新增查看證件按鈕"
```

---

## Task 8: 更新 CURRENT_WORK.md + 最終 build

**Files:**
- Modify: `CURRENT_WORK.md`

- [ ] **Step 1: 更新 CURRENT_WORK.md**

在 CURRENT_WORK.md 的「目前開發階段」區塊新增：

```
### [進行中] Google Drive 文件儲存整合（2026-04-10）
- Google Drive API v3 服務帳號認證
- 註冊文件統一上傳至 Drive（`{userId}_{車牌}/` 資料夾結構）
- 上傳失敗時註冊仍成功，標記 uploadFailed 供補傳
- 派單方司機資訊卡新增「查看證件」按鈕
- API: GET /api/drivers/[id]/documents
```

- [ ] **Step 2: 最終 build**

Run: `cd /c/Users/BrianNB/airport-dispatch-platform && npm run build`
Expected: Build 完全成功

- [ ] **Step 3: Commit**

```bash
git add CURRENT_WORK.md
git commit -m "docs: 更新 CURRENT_WORK.md — Google Drive 文件儲存整合完成"
```

---

## 實作前需準備

在開始 Task 1 之前，請先完成以下 Google Cloud 設定：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) 建立專案
2. 啟用 **Google Drive API**
3. 建立**服務帳號**，下載 JSON 金鑰檔
4. 在 Google Drive 建立「註冊文件」資料夾，將服務帳號 email（`...@....iam.gserviceaccount.com`）加入該資料夾的「編輯者」權限
5. 複製服務帳號 JSON 金鑰內容和資料夾 ID，填入 `.env.local`

準備好之後再告訴我，我就可以開始實作了。
