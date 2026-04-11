# 司機個人中心 — 設計規格書

> **日期：** 2026-04-11
> **類型：** 新功能設計
> **範圍：** 司機後台個人中心 Tab + 三證到期管理 + 點數加值系統

---

## 1. 概述

在司機後台 Tab 列新增第 6 個 Tab「個人中心」，整合司機的所有個人資訊、文件管理與點數加值功能。

### 1.1 現有 Tab 清單（不變）

| Tab | 功能 |
|-----|------|
| 接單大廳 | 可接訂單列表 |
| 我的行程 | 已接訂單 |
| 帳務中心 | 收支報表 |
| 小車頭 | Premium 自助發單 |
| 小隊 | 互助系統 |

### 1.2 新增 Tab

| Tab | 功能 |
|-----|------|
| **個人中心** | 個人資料 / 車輛資料（唯讀）、聯絡與銀行（可編輯）、會員等級（唯讀）、文件管理、存值點數 |

---

## 2. 個人中心 UI 結構

個人中心 Tab 內分為 4 個子區塊，由上而下垂直排列：

### 2.1 區塊一：個人資料（唯讀）

顯示欄位：

| 欄位 | 說明 |
|------|------|
| 姓名 | user.name |
| Email | user.email |
| 會員等級 | 普通 / Premium（driver.isPremium）|

車輛資料（唯讀）：

| 欄位 | 說明 |
|------|------|
| 車牌 | driver.licensePlate |
| 車廠 | driver.carBrand |
| 車型 | driver.carType（顯示中文）|
| 車色 | driver.carColor |

UI：白色卡片，標籤灰字、內容黑字 bold，車牌用等寬字體。

### 2.2 區塊二：聯絡方式與銀行資料（可編輯）

編輯模式：點「編輯」按鈕 → 表單變為可輸入 → 儲存 / 取消

| 欄位 | 說明 | 是否可編輯 |
|------|------|-----------|
| 聯絡電話 | user.phone | 是 |
| 銀行代碼 | driver.bankCode | 是 |
| 銀行帳號 | driver.bankAccount | 是 |

- 點擊「編輯」進入編輯模式，銀行代碼為下拉選單（常見銀行）
- 儲存時 PUT `/api/drivers/profile`
- 儲存成功後顯示綠色提示，退出編輯模式

### 2.3 區塊三：文件管理（卡片式）

#### 2.3.1 三張文件卡片

每張文件（行照 / 駕照 / 保險證）各自為一張卡片：

```
┌──────────────────────────────────────────────┐
│ [文件類型標籤]              [狀態標籤]       │
│────────────────────────────────              │
│ 文件名稱：XXXX.jpg                            │
│ 到期日：2026-05-15                           │
│                                              │
│ [查看] [重新上傳]                            │
└──────────────────────────────────────────────┘
```

狀態邏輯：

| 狀態 | 條件 | 卡片樣式 |
|------|------|---------|
| 正常（綠） | 到期日 > 今日 + 30 天 | 綠色標籤 |
| 即將到期（黃） | 今日 <= 到期日 <= 今日 + 30 天 | 黃色標籤 + 警示文字 |
| 已過期（紅） | 到期日 < 今日 | 紅色標籤 + 「已過期」警示 |
| 尚未上傳（灰） | 無文件記錄 | 灰色標籤 |

按鈕邏輯：

| 狀態 | 「重新上傳」按鈕 |
|------|----------------|
| 正常（綠） | **隱藏**（未到期不可自行變更）|
| 即將到期（黃） | **顯示**（到期前 30 天才可上傳）|
| 已過期（紅） | **顯示** + 強制上傳提示 |
| 尚未上傳（灰） | **顯示** |

#### 2.3.2 全域到期狀態 Banner

文件區塊最上方，依最緊急的狀態顯示一個 Banner：

- 所有文件正常：無 Banner
- 任一文件即將到期（<= 30 天）：黃色 Banner「有文件即將到期，請重新上傳」
- 任一文件已過期：紅色 Banner「帳號已凍結，請重新上傳文件」

#### 2.3.3 上傳流程

點「重新上傳」→ 跳出檔案選擇器（接受 JPG/PNG/PDF，最大 5MB）→ 選擇檔案 → 顯示預覽 → 點「確認上傳」→ 上傳至 Google Drive → 顯示上傳中 → 完成後顯示「上傳成功，等待管理員審核」

上新文件後，舊文件在管理員審核通過前不影響舊到期日。管理員審核通過後，新文件自動生效、舊文件註銷。

#### 2.3.4 帳號凍結邏輯（自動化 Cron）

每日 00:00 執行 `/api/cron/check-document-expiry`：

```
For each driver:
  For each userDocument:
    If expiryDate < today AND status = APPROVED:
      Set accountStatus = SUSPENDED
      Set suspendReason = "文件已過期：{type}"
      Send notification (console log for now)
```

到期前不自動簡訊/Email通知（LINE客服處理）。

### 2.4 區塊四：存值點數

#### 2.4.1 餘額顯示

大字顯示目前點數：`text-4xl font-bold`，下方顯示「約當 NT$ XXX」（1點 = 1元）。

#### 2.4.2 快捷加值按鈕

三個固定金額按鈕 + 一個自訂金額輸入框：

| 按鈕 | 說明 |
|------|------|
| +500 | 500 點 |
| +1000 | 1000 點 |
| +2000 | 2000 點 |
| 自訂 | 輸入金額（最小 100）|

#### 2.4.3 付款方式選擇

選擇金額後，顯示兩個付款方式選項：

**信用卡付款**：
- 按鈕：「信用卡付款（加收 3% 手續費）」
- 點擊後 POST `/api/drivers/topup/create` → 拿 PAYUNi 表單 → POST 到玉山銀行
- 付款完成後自動入帳（notify callback）

**銀行轉帳**：
- 按鈕：「銀行轉帳」
- 點擊後展開顯示轉帳資訊：

```
銀行轉帳資訊
================
郵局 (代號 700)
帳號：00312040680923

渣打銀行 (代號 052)
帳號：12220000471580

※ 轉帳時請在備註欄填寫您的車牌號碼
※ 轉帳完成後請通知 LINE 客服入帳
```

#### 2.4.4 近 5 筆加值紀錄

顯示最近 5 筆 RECHARGE 類型的 Transaction：

| 日期 | 金額 | 付款方式 | 狀態 |
|------|------|---------|------|
| 2026-04-10 | +500 | 信用卡 | 已完成 |
| 2026-04-08 | +1000 | 轉帳 | 已完成 |

---

## 3. API 設計

### 3.1 個人資料

#### `PUT /api/drivers/profile`

更新司機個人資料（電話 + 銀行）。

Request:
```json
{
  "phone": "0912345678",
  "bankCode": "700",
  "bankAccount": "00312040680923"
}
```

Response: `{ success: true, data: { message: "個人資料已更新" } }`

驗證：需為登入司機本人（JWT 驗證）。

#### `GET /api/drivers/profile`

取得司機完整個人資料。

Response:
```json
{
  "success": true,
  "data": {
    "user": { "name": "...", "email": "...", "phone": "..." },
    "driver": {
      "licensePlate": "...",
      "carBrand": "...",
      "carType": "...",
      "carColor": "...",
      "isPremium": false,
      "bankCode": "...",
      "bankAccount": "..."
    },
    "documents": [
      {
        "id": "...",
        "type": "VEHICLE_REGISTRATION",
        "fileName": "...",
        "expiryDate": "2026-05-15",
        "status": "APPROVED",
        "isExpiring": false,
        "isExpired": false
      }
    ],
    "balance": 1234
  }
}
```

### 3.2 文件上傳

#### `POST /api/drivers/documents/upload`

上傳單一文件（重新上傳）。

Request: `multipart/form-data`（`file`, `type`, `userId`）

Response: `{ success: true, data: { documentId: "...", fileUrl: "...", status: "PENDING_REVIEW" } }`

邏輯：
1. 上傳至 Google Drive
2. 建立新的 UserDocument 記錄（status = PENDING_REVIEW）
3. 舊的同類型文件保留，直到管理員審核通過才註銷

### 3.3 點數加值

#### `POST /api/drivers/topup/create`

建立加值訂單。

Request:
```json
{
  "amount": 1000,
  "method": "credit" | "transfer"
}
```

Response (method = "credit"):
```json
{
  "success": true,
  "data": {
    "topupId": "...",
    "payuniUrl": "https://sandbox-api.payuni.com.tw/api/upp",
    "formData": { "MerID": "...", "Version": "1.0", "EncryptInfo": "...", "HashInfo": "..." },
    "finalAmount": 1030
  }
}
```

Response (method = "transfer"):
```json
{
  "success": true,
  "data": {
    "topupId": "...",
    "method": "transfer",
    "amount": 1000
  }
}
```

#### `POST /api/payuni/topup/notify`

PAYUNi 點數加值 server notify callback（與 GF 專案邏輯相同）。

解密 EncryptInfo → TradeStatus === "1" → 更新 Driver balance + 建立 Transaction (RECHARGE)。

### 3.4 文件到期自動化

#### `GET /api/cron/check-document-expiry`

每日 00:00 執行（Zeabur Cron Job）。

邏輯：見 2.3.4 節。

---

## 4. 銀行轉帳加值流程（Phase 1）

```
1. 司機選金額 → 選「銀行轉帳」
2. 前端 POST /api/drivers/topup/create → 建立 topup record（status = PENDING_TRANSFER）
3. 前端顯示轉帳帳號資訊
4. 司機自行轉帳（備註填車牌）
5. 司機通知 LINE 客服
6. 客服人工確認後 → PUT /api/drivers/topup/{id}/confirm
7. 系統更新 Driver balance + Transaction(RECHARGE)
8. 司機看到加值成功
```

---

## 5. 文件審核流程（管理員端）

管理員在 `/dashboard/admin/reviews` 的審核頁面：

- 新文件顯示「重新上傳」標記，與原始註冊文件外觀一致
- 管理員可通過 / 拒絕
- 通過後：新文件生效（status → APPROVED，expiryDate 更新），舊文件標記為 REJECTED

---

## 6. 技術實作清單

### Frontend
- 新增 Tab：「個人中心」
- ProfileTab 元件（src/components/driver/ProfileTab.tsx）
- 文件卡片 DocumentCard 子元件
- 加值面板 TopupPanel 子元件
- PAYUNi 表單送出邏輯

### Backend
- PUT /api/drivers/profile
- GET /api/drivers/profile
- POST /api/drivers/documents/upload
- POST /api/drivers/topup/create
- POST /api/payuni/topup/notify
- PUT /api/drivers/topup/[id]/confirm（客服確認轉帳）
- GET /api/cron/check-document-expiry

### DB
- Driver model 新增 bankCode, bankAccount（已存在於 schema）
- Transaction model 新增 topupId 關聯
- Topup model（new）：

```prisma
model Topup {
  id          String   @id @default(cuid())
  driverId    String
  driver      Driver   @relation(fields: [driverId], references: [id])
  amount      Int
  method      String   // "credit" | "transfer"
  status      String   @default("pending") // "pending" | "paid" | "cancelled"
  payuniTradeNo String?
  paidAt      DateTime?
  createdAt   DateTime @default(now())
}
```

---

## 7. 待後期處理

- [ ] LINE 客服整合（通知司機文件即將到期、入帳確認）
- [ ] 銀行轉帳自動對帳（串接銀行 API 或 Email 通知）
- [ ] 檔案類型驗證（自動偵測行照/駕照/保險證，而非由司機選）
