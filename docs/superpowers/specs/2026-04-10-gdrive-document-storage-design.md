# Google Drive 文件儲存整合設計

## 1. 目標

將註冊流程中的三證文件（行照、駕照、保險證）從本地 `public/uploads/` 改存 Google Drive，由服務帳號統一管理，派單方可即時透過連結查看司機三證。

## 2. 架構設計

### 2.1 Google Cloud 設定

- 建立 Google Cloud 專案，啟用 **Google Drive API**
- 建立**服務帳號（Service Account）**，下載 JSON 金鑰檔
- 在共用的 Google Drive 根目錄建立「註冊文件」資料夾，將服務帳號加入該資料夾的「編輯者」權限
- 將金鑰檔內容存為環境變數 `GOOGLE_SERVICE_ACCOUNT_KEY`（完整的 JSON 字串）

### 2.2 認證方式

使用 Google Drive API v3，透過服務帳號的 JWT 直接認證，**不需要任何 OAuth 流程**。

### 2.3 資料夾結構

```
Google Drive 根目錄（由服務帳號擁有）
└── 註冊文件/
    └── {userId}_{車牌}/
        ├── {車牌}-行照.{副檔名}
        ├── {車牌}-駕照.{副檔名}
        └── {車牌}-保險證.{副檔名}
```

範例：`/註冊文件/usr_123abc_REC2391/REC2391-行照.jpg`

同一個用戶重新上傳時，檔名相同會覆寫舊檔（Google Drive 同一資料夾內檔名不可重複）。

### 2.4 上傳時機

- 用戶在 Step 4 選擇文件（停留在本地瀏覽器 Blob URL，UI 已有）
- Step 5 點「完成註冊」時，**一次**把所有文件上傳到 Google Drive
- 上傳成功後，driveFolderId + driveFileId + driveShareUrl 存入 `UserDocument` table

## 3. 實作變更

### 3.1 新增環境變數

```
GOOGLE_SERVICE_ACCOUNT_KEY=...（完整 JSON 字串）
GOOGLE_DRIVE_ROOT_FOLDER_ID=...（「註冊文件」資料夾的 ID）
```

### 3.2 新增套件

```
npm install googleapis
```

### 3.3 新增 Drive 上傳工具函式

新增 `src/lib/google-drive.ts`：

```
uploadToDrive(file, folderId, fileName)
  → 使用 googleapis 服務帳號認證
  → 上傳檔案到指定 folderId
  → 回傳 { fileId, webViewLink, webContentLink }
```

```
getOrCreateUserFolder(userId, licensePlate, parentFolderId)
  → 查詢是否已有 userId 資料夾
  → 有：回傳 folderId
  → 無：建立新資料夾，回傳 folderId
```

### 3.4 修改 `POST /api/uploads`

**現有流程**（存入本地）：
1. 驗證 Bearer token
2. 檢查檔案格式/大小
3. 寫入 `public/uploads/{userId}/`
4. 建立 `UserDocument` record

**新流程**：
1. 驗證 Bearer token
2. 檢查檔案格式/大小
3. **使用 Google Drive SDK** 上傳到 `GOOGLE_DRIVE_ROOT_FOLDER_ID/{userId}_{licensePlate}/`
4. 將 `driveFileId`、`driveFolderId`、`driveShareUrl` 存入 `UserDocument` record
5. **不**再寫入本地磁碟

### 3.5 失敗處理邏輯

在 `POST /api/auth` 的註冊流程中（或在 `RegisterWizard.tsx` 的 `handleSubmit` 中）：

```
1. 先建立 User + Driver/Dispatcher record（拿到 userId）
2. 嘗試上傳文件到 Google Drive
   - 成功：UserDocument.status = 'APPROVED'，driveShareUrl 入庫
   - 失敗：UserDocument.status = 'PENDING'，標記 uploadFailed = true
3. 回傳給前端：即使上傳失敗，註冊仍成功
4. 前端顯示溫馨提示：「文件上傳失敗，請至個人資料補傳」
```

> 考量：用戶要在什麼地方補傳？
> - 司機/派單方 Dashboard 新增「文件管理」頁面，可檢視已上傳/待補件的狀態，並支援重新上傳

### 3.6 Prisma Schema 變更

`UserDocument` model 新增欄位：

```prisma
model UserDocument {
  id              String   @id @default(cuid())
  userId          String
  type            String   // VEHICLE_REGISTRATION / DRIVER_LICENSE / INSURANCE / ID_CARD / BUSINESS_REGISTRATION
  fileUrl         String?  // 改存 Google Drive 分享連結（webViewLink）
  driveFileId     String?  // Google Drive 檔案 ID
  driveFolderId   String? // Google Drive 資料夾 ID
  fileName        String?
  mimeType        String?
  sizeBytes       Int?
  status          String   // PENDING / APPROVED / REJECTED
  uploadFailed    Boolean  @default(false) // 上傳失敗標記
  uploadedAt      DateTime @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?
  reviewedNote    String?

  user            User     @relation(fields: [userId], references: [id])
}
```

### 3.7 派單方查看司機三證

#### API

`GET /api/drivers/[id]/documents`
- 驗證請求者是否為 DISPATCHER 身份
- 回傳該司機的所有 `UserDocument`（含 `driveShareUrl`）

#### 前端

在派單方行控中心，已接單司機資訊卡旁加入「查看證件」按鈕：

```
司機：張小明｜車牌：REC2391｜車型：小車
[查看證件] ← 點下去 → window.open(documents[0].fileUrl, '_blank')
```

按鈕點下去直接在新分頁開啟 Google Drive 分享連結。

> Google Drive 分享連結的 format：`https://drive.google.com/file/d/{fileId}/view`

**權限設定**：上傳時自動設定 `anyoneWithLink` 可檢視（view），管理員可下載。

## 4. 審核流程整合

Admin 審核頁面（`/dashboard/admin/reviews`）現有功能不變，但文件連結從本地 `fileUrl` 改為 Google Drive 分享連結，點擊同樣開新分頁。

## 5. 實作順序

1. **Google Cloud 設定**：建立服務帳號、建立 Drive 資料夾、取得金鑰和 folder ID
2. **套件安裝 + 環境變數**
3. **`src/lib/google-drive.ts`**：上傳工具函式
4. **Prisma migration**：UserDocument 新增欄位
5. **修改 `POST /api/uploads`**：改用 Google Drive SDK
6. **修改 `POST /api/auth`**：失敗處理邏輯
7. **`GET /api/drivers/[id]/documents`** API
8. **派單方前端**：查看證件按鈕
9. **Build + commit**
