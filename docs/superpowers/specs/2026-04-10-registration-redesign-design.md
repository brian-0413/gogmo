# 使用者註冊功能改善 — 規格文件

## 1. 概述

改善機場接送派單平台的註冊與登入流程，建立更嚴謹的身份驗證機制。

### 目標
- 司機：一車一帳號，車牌即帳號
- 派單方：以公司為單位註冊
- 所有新帳號需文件審核後開通

### 使用者角色
| 角色 | 帳號識別 | 驗證方式 | 文件審核 |
|------|----------|----------|----------|
| 司機 | 車牌號碼 | Email + 文件上傳 | 行照、駕照、乘客險 500 萬以上 |
| 派單方 | Email | Email + 文件上傳 | 負責人身分證、商業登記公文 |
| Admin | — | — | 審核司機/派單方上傳文件 |

---

## 2. 註冊流程（多步驟精靈）

共五個步驟，橫向進度條顯示當前進度。

### Step 1 — 身份選擇

- 兩個大字卡片：司機 / 派單方
- 點擊進入對應流程，不再回頭

### Step 2 — 基本資料

**司機：**
| 欄位 | 格式 | 必填 |
|------|------|------|
| 姓名 | 文字 | 是 |
| 手機號碼 | 09xx-xxx-xxx | 是 |
| Email | 標準 Email 格式 | 是 |

**派單方：**
| 欄位 | 格式 | 必填 |
|------|------|------|
| 公司名稱 | 文字 | 是 |
| 聯絡電話 | 09xx-xxx-xxx | 是 |
| Email | 標準 Email 格式 | 是 |
| 統一編號 | 8 碼數字 | 是 |

### Step 3 — 車輛資料（僅司機）

| 欄位 | 格式 | 必填 |
|------|------|------|
| 車牌號碼（= 帳號） | 自動英文大寫，格式如 ABC-1234 | 是 |
| 車廠/品牌 | 自動英文大寫（如 TOYOTA） | 是 |
| 車型/型號 | 自動英文大寫（如 CAMRY） | 是 |
| 車色 | 自由填寫（如白、黑、銀） | 是 |
| 車型 | 下拉選單 | 是 |

車型下拉選項：
- 5人座（小車/轎車）
- 5人座（休旅/SUV）
- 7人座
- 9人座

### Step 4 — 資料上傳驗證

**司機上傳（3 項）：**
1. 行照（行車執照）
2. 駕照（汽車駕駛執照）
3. 乘客險 500 萬（含）以上保險證

**派單方上傳（2 項）：**
1. 負責人身分證（正面）
2. 公司/商業登記核准公文

技術規格：
- 支援格式：JPG、PNG、PDF
- 每個檔案最大 5MB
- 上傳至 `/api/uploads` 端點，儲存於雲端儲存（如有）或本地檔案系統
- 檔案存取時需 admin token 驗證

### Step 5 — 密碼設定 + 同意書

- 密碼：自己設定，至少 6 個字元
- 確認密碼：需與密碼一致
- 同意書：繁體中文「服務條款與隱私權政策」全文 + 勾選核取方塊

### 完成後

1. 系統寄驗證 Email 至用戶填寫的 Email
2. 點擊 Email 連結 → 帳號啟用
3. 帳號狀態為「待審核」，畫面顯示「您的資料已送出，我們將在 1-2 個工作天內完成審核」
4. Admin 在後台審核通過後，帳號正式開通

---

## 3. 登入頁（雙 Tab）

### Tab 1 — 司機登入
- 車牌號碼（自動英文大寫）
- 密碼
- 「忘記密碼」連結

### Tab 2 — 派單方登入
- Email
- 密碼
- 「忘記密碼」連結

### 技術實作
- 同一個 `/api/auth/login` 端點，根據 `role` 參數區分登入類型
- 司機登入時以車牌查詢用戶，再驗證密碼
- 派單方登入時以 Email 查詢用戶，再驗證密碼

---

## 4. Email 驗證

### 流程
1. 註冊完成後，系統產生 `emailVerifyToken`（JWT 或一次性 token）
2. 寄送 Email 至用戶信箱，內含驗證連結
3. 用戶點擊連結 → 呼叫 `/api/auth/verify-email?token=xxx`
4. Token 驗證成功 → 帳號啟用（`emailVerified: true`）

### API 端點
- `POST /api/auth/send-verify-email` — 重發驗證 Email
- `GET /api/auth/verify-email` — 驗證 token 並啟用帳號

---

## 5. 密碼重設

### 司機
- 輸入「車牌號碼」+「當初註冊的 Email」
- 兩者比對成功後，寄重設連結至 Email

### 派單方
- 輸入「當初註冊的 Email」
- 寄重設連結至 Email

### API 端點
- `POST /api/auth/forgot-password` — 發送重設連結
- `POST /api/auth/reset-password` — 重設密碼

---

## 6. Admin 審核功能

### 新增後台頁面：審核管理（`/dashboard/admin/verify`）

- 待審核清單（司機 / 派單方 分頁）
- 每筆顯示：姓名/公司名、車牌/統編、上傳文件（可點擊放大檢視）、註冊時間
- 操作：通過 / 拒絕（附理由）
- 通過後：帳號狀態改為「已開通」，系統寄通知 Email

### Prisma 新增欄位

```prisma
enum AccountStatus {
  PENDING_VERIFICATION  // 待 Email 驗證
  PENDING_REVIEW        // 已驗證，待文件審核
  ACTIVE                // 已開通
  REJECTED              // 審核不通過
}

model User {
  // ...
  emailVerified   Boolean  @default(false)
  emailVerifyToken String?
  accountStatus   AccountStatus @default(PENDING_VERIFICATION)
  rejectReason   String?
}

model UserDocument {
  id        String   @id @default(cuid())
  userId    String
  type      String   // DRIVER_LICENSE / VEHICLE_REGISTRATION / INSURANCE / ID_CARD / BUSINESS_REGISTRATION
  fileUrl   String
  status    String   // PENDING / APPROVED / REJECTED
  createdAt DateTime @default(now())
}
```

---

## 7. API 變動

| 端點 | 變動 |
|------|------|
| `POST /api/auth` | 支援新增 `accountStatus` 欄位預設值 |
| `POST /api/auth/login` | 新增 `role` 參數，支援車牌登入 |
| `POST /api/auth/forgot-password` | 新增，支援車牌+Email（司機）或純Email（派單方）|
| `POST /api/auth/reset-password` | 新增，接收 token + 新密碼 |
| `GET /api/auth/verify-email` | 新增，驗證 email token |
| `POST /api/auth/send-verify-email` | 新增，重發驗證信 |
| `POST /api/uploads` | 新增，檔案上傳端點 |
| `GET /api/admin/reviews` | 新增，取得待審核清單 |
| `POST /api/admin/reviews/[id]` | 新增，通過或拒絕審核 |

---

## 8. UI 變動

| 檔案 | 變動 |
|------|------|
| `src/app/register/page.tsx` | 重寫為多步驟精靈 |
| `src/app/login/page.tsx` | 重寫為雙 Tab 登入 |
| `src/app/dashboard/admin/reviews/page.tsx` | 新增審核管理頁面 |
| `src/lib/auth-context.tsx` | 支援 `accountStatus` 狀態 |
| 新增同意書文件 | `public/terms-and-conditions.html` |

---

## 9. 實施順序

1. **第一階段** — 登入頁重寫（雙 Tab）+ auth-context 更新支援
2. **第二階段** — 註冊精靈（Step 1-3, 5）
3. **第三階段** — 檔案上傳 API + Step 4
4. **第四階段** — Email 驗證流程
5. **第五階段** — 密碼重設流程
6. **第六階段** — Admin 審核後台
7. **第七階段** — 舊資料遷移（為已存在但無 emailVerified 的用戶設定）

---

## 10. 待確認事項

- [ ] SMS 驗證是否為未來需求？（目前先做 Email）
- [ ] 同意書文字內容（需要律師確認或自行撰寫）
- [ ] 檔案儲存方式：本地、S3 還是其他？
- [ ] Admin 審核通知：Email 即時通知管理員，還是管理員自行登入查看？
