# 司機接單窗口 — QR 貴賓預訂系統設計規格

## 1. 功能定位

- **目標用戶**：Premium 等級司機
- **核心功能**：每位 Premium 司機擁有專屬 QR code，客人掃描後進入個人化落地頁填寫接送需求，訂單直接進入司機接單中心
- **差異化**：專屬車牌抬頭、客製化問候語、司機自訂車型與價格
- **整合位置**：依附在小車頭功能內（同一個 Tab）
- **門檻控制**：普通司機可見 QR code 入口但無編輯權限

## 2. 司機端 — 客戶資料庫（整合在小車頭 Tab）

每位 Premium 司機擁有專屬的客戶資料庫。當客人透過 QR code 完成預訂，系統自動將該客人加入司機的客戶名單。司機可在此統一管理自己的客人資料。

### 2.1 客戶資料欄位

| 欄位 | 說明 |
|------|------|
| 姓名 | 必填 |
| 電話 | 必填 |
| 常用上車地點 | 選填 |
| 常用目的地 | 選填 |
| 偏好車型 | 選填（小車/休旅/9人座） |
| 備註 | 選填（例如「容易暈車」「有嬰兒」等） |
| 建立時間 | 自動 |
| 最後下單時間 | 自動更新 |

### 2.2 操作

- **新增**：司機可手動新增客戶（姓名+電話為必填）
- **編輯**：修改任一欄位
- **刪除**：刪除客戶（不影響歷史訂單）
- **搜尋**：依姓名或電話搜尋
- **列表排序**：依建立時間或最後下單時間

### 2.3 自動新增邏輯

旅客在 Step 9 填寫「姓名+電話」後，系統檢查該電話是否已存在於司機的客戶名單：
- 不存在 → 自動新增至名單，並在建立時間標記
- 已存在 → 更新「最後下單時間」，並更新「常用上/下地點」（如有差異）

---

## 3. 司機端 — 報價設定

### 2.1 呈現方式

在小車頭 Tab 內新增「我的 QR 單」區塊，與原有的「自助發單」對話流程並列。

區塊內容：
- **QR code 顯示區**：司機的專屬 QR code（可下載/分享）
- **預覽連結**：客人掃描後看到的網址，格式 `/book/[driverId]`
- **報價設定**：司機可新增/編輯/刪除車型+對應價格

### 2.2 報價資料結構

每位司機可設定多個車型選項，每個選項包含：

| 欄位 | 說明 |
|------|------|
| 車型 | 小車(5人) / 休旅(7人) / 9人座 |
| 單趟價格 | NT$ 純數字，司機自行填寫 |
| 啟用狀態 | 開啟 / 關閉（關閉後不顯示給客人） |

### 2.3 運作邏輯

- 司機至少需設定一個車型+價格，QR code 才生效
- 司機可隨時修改報價，修改後新訂單適用新價格，既有訂單不受影響
- 刪除車型時，若有待處理訂單，該車型不可刪除

## 3. 客人端 — QR 落地頁

### 3.1 頁面設計

**URL**：`/book/[driverId]`

**Header**：
- 背景：黑色 #1C1917
- 車牌號碼：金色 #E8A855，40px 等寬大字（例如 REC-2391）
- 副標題：淺灰小字「專屬貴賓預訂頁面」

**風格**：LINE 風格對話泡泡（與小車頭一致）

### 3.2 對話流程（共 10 步）

旅客依序填寫，系統記錄狀態。

#### Step 1 — 行程類型
- Bot：「請問您需要什麼服務？」
- 選項（2格並排，豎向堆疊）：
  - 接機 / 接船
  - 送機 / 送船
- **連動行為**：選擇後自動更新行程類型

#### Step 2 — 機場 / 港口
- Bot：「請問從哪裡上車？」
- 選項（grid）：
  - 桃園國際機場
  - 松山機場
  - 台中清泉崗
  - 高雄小港機場
  - 基隆港
  - 其他地點
- **連動行為**：
  - Step 1 為接 → 自動帶入「上車地點」
  - Step 1 為送 → 自動帶入「目的地」

#### Step 3 — 日期和時間
- Bot：「請選擇搭乘日期和時間」
- 輸入：date picker + time picker（橫排）

#### Step 4 — 航班號碼
- Bot：「請輸入航班號碼」（接機必填，送機選填）
- 輸入：文字框（如 BR32）+ 下一步按鈕

#### Step 5 — 車型
- Bot：「請選擇車型」
- 選項：司機設定的車型列表（動態，2格 grid）
- 選擇後系統悄悄套用該車型的預設價格
- **不顯示價格**（價格在 Step 10 才出現）

#### Step 6 — 乘客數
- Bot：「請問乘客有幾位？」
- 選項（4x2 grid）：1人、2人、3人、4人、5人、6人、7人、8人

#### Step 7 — 行李（Loop）
- Bot：「請問有什麼行李？」
- **Loop A — 尺寸**：胖胖箱、28吋、24吋、20吋、其他尺寸、無行李
  - 選「無行李」→ 直接結束行李流程
- **Loop B — 數量**：選完尺寸後出現，1件、2件、3件
- **Loop C — 確認**：顯示已選行李晶片（含移除 x）
  - 「確定，沒了」→ 結束
  - 「還要再加」→ 返回 Loop A

#### Step 8 — 上下車地點
- **接送機**：依類型自動填入一端，另一端由旅客填寫
  - 接機：上車 = Step 2 選項，下車 = 旅客輸入
  - 送機：上車 = 旅客輸入，下車 = Step 2 選項
- Bot：「請填寫另一端的上車地點」（或「目的地」）
- 輸入：文字框（如新竹火車站）

#### Step 9 — 聯絡人
- Bot：「請輸入聯絡人姓名和電話」
- 輸入：姓名文字框 + 電話文字框（橫排）

#### Step 10 — 摘要確認
- Bot：「請確認您的行程資訊」
- 顯示完整摘要（含費用）：
  - 行程類型
  - 日期 / 時間
  - 航班號碼
  - 上車地點 / 目的地
  - 車型
  - 乘客 / 行李
  - 聯絡人
  - **費用：NT$ [司機設定的該車型價格]**
- 按鈕：
  - 「確認送出」（主要按鈕）
  - 「修改」（次要按鈕）→ 回 Step 1 重新填寫

送出後：
- Bot：「感謝您的預訂！我已將您的需求傳給司機 [車牌]，他會盡快與您聯繫。」
- 旅客可關閉頁面

## 5. 司機端 — 接單中心處理

### 4.1 收到通知

旅客送出後，司機在接單中心看到新訂單（狀態 = ASSIGNED，原司機）。

卡片顯示內容與一般司機自派單一致，但標籤改為「QR 貴賓單」。

### 4.2 司機決策

| 付款方式 | 可用操作 |
|---------|---------|
| 收現 | 自己跑 / 派到接單大廳 / 取消 |
| 轉帳 | 自己跑 / 取消 |

### 4.3 派到接單大廳（限收現）

司機點「外派」，展開填寫：
- **實收金額**（NT$）：接單司機向旅客收取的金額 = 旅客支付的費用
- **回金金額**（NT$）：接單司機執行後轉回給原司機的金額
- 系統即時顯示「外派後您實拿：[實收 - 回金]」

送出後，訂單進入接單大廳（PUBLISHED 狀態），大廳顯示：
- 標籤：「QR 貴賓單」
- **費用**：顯示實收金額（如 NT$1200，含回金 NT$200）
- **付款方式**：收現

### 4.4 轉帳單的處理

旅客已轉帳至原司機帳戶，原司機不能外派。只能：
- 自己跑（親自執行行程）
- 取消（款項由原司機自行處理退款）

## 6. 資料庫變更

### 6.1 新增 DriverPricing Model

```prisma
model DriverPricing {
  id          String   @id @default(cuid())
  driverId    String
  vehicleType String   // "small" | "suv" | "van9"
  price       Int      // NT$
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  driver      Driver   @relation(fields: [driverId], references: [id], onDelete: Cascade)
  @@unique([driverId, vehicleType])
}
```

### 6.2 新增 DriverCustomer Model

```prisma
model DriverCustomer {
  id               String    @id @default(cuid())
  driverId         String
  name             String
  phone            String
  commonPickup     String?
  commonDropoff    String?
  preferredVehicle String?   // "small" | "suv" | "van9"
  notes            String?
  createdAt        DateTime  @default(now())
  lastOrderAt      DateTime?
  driver           Driver    @relation(fields: [driverId], references: [id], onDelete: Cascade)
  orders           Order[]   // 該客戶的歷史訂單
  @@unique([driverId, phone])
  @@index([driverId])
}
```

### 6.3 Order Model 新增欄位

```prisma
model Order {
  // 既有欄位...
  isQROrder      Boolean @default(false)  // 是否為 QR 貴賓單
  originalDriverId String?                 // 原司機 ID（外派後仍可追溯）
  qrPrice        Int?                     // QR 單的報價（建立時鎖定）
}
```

## 7. API 設計

### 7.1 司機端 — 報價管理

| Method | 端點 | 說明 |
|--------|------|------|
| GET | `/api/drivers/pricing` | 取得司機的車型報價列表 |
| POST | `/api/drivers/pricing` | 新增車型報價 |
| PUT | `/api/drivers/pricing/[id]` | 更新車型報價 |
| DELETE | `/api/drivers/pricing/[id]` | 刪除車型報價 |
| GET | `/api/drivers/qrcode` | 取得司機的 QR code 資料 |

### 7.2 司機端 — 客戶管理

| Method | 端點 | 說明 |
|--------|------|------|
| GET | `/api/drivers/customers` | 取得司機的客戶列表（可搜尋/排序） |
| POST | `/api/drivers/customers` | 新增客戶（司機手動新增） |
| PUT | `/api/drivers/customers/[id]` | 更新客戶資料 |
| DELETE | `/api/drivers/customers/[id]` | 刪除客戶 |
| GET | `/api/drivers/customers/[id]` | 取得單一客戶資料 |

**自動新增**：旅客下單時，系統自動 upsert 客戶記錄（依 phone 識別）。

### 7.3 客人端（無需登入）

| Method | 端點 | 說明 |
|--------|------|------|
| GET | `/api/book/[driverId]` | 取得司機的車型選項（定價頁初始化） |
| POST | `/api/book/[driverId]/orders` | 旅客送出訂單 |

### 7.4 POST /api/book/[driverId]/orders Request

```json
{
  "orderType": "pickup" | "dropoff",
  "airport": "桃園國際機場" | "松山機場" | ...,
  "scheduledTime": "2026-04-16T15:30:00.000Z",
  "flightNumber": "BR32",
  "vehicleType": "small" | "suv" | "van9",
  "passengerCount": 2,
  "luggage": [
    { "size": "24吋", "quantity": 1 }
  ],
  "pickupLocation": "新竹火車站",
  "dropoffLocation": "桃園國際機場",
  "contactName": "王小明",
  "contactPhone": "0912-345-678",
  "notes": ""
}
```

**驗證**：
- 司機存在且為 Premium
- 該車型在司機的定價列表中且 enabled = true
- scheduledTime 為未來時間

**Response**：`{ success: true, data: { orderId, message } }`

### 7.5 派單 API（沿用現有）

派到接單大廳時，使用現有的 `POST /api/orders/[id]/dispatch` 或修改邏輯：
- feeMode 強制為 `cash_collection`
- 帶入司機填寫的「實收」和「回金」金額
- 原司機 ID 存入 `originalDriverId`

## 8. 實作檔案

- `src/app/book/[driverId]/page.tsx` — 客人 QR 落地頁
- `src/components/book/QROrderChat.tsx` — 客人對話精靈元件（10步）
- `src/components/driver/DriverCustomers.tsx` — 司機客戶資料庫元件
- `src/components/driver/QRPricingPanel.tsx` — 司機報價設定元件
- `src/app/api/drivers/pricing/route.ts` — 報價 CRUD
- `src/app/api/drivers/pricing/[id]/route.ts` — 單一報價更新/刪除
- `src/app/api/drivers/qrcode/route.ts` — QR code 資料取得
- `src/app/api/drivers/customers/route.ts` — 客戶 CRUD
- `src/app/api/drivers/customers/[id]/route.ts` — 單一客戶更新/刪除
- `src/app/api/book/[driverId]/route.ts` — 客人端初始化（車型選項）
- `src/app/api/book/[driverId]/orders/route.ts` — 旅客下單（含自動新增客戶）
- `prisma/schema.prisma` — 新增 DriverPricing + DriverCustomer model + Order 擴充欄位

## 9. UI 設計細節

- 不使用任何 emoji
- Header 車牌：40px 等寬金色字，背景黑色
- 對話泡泡：Bot 白底，User 金色底
- 按鈕：2格並排顯示（豎向堆疊內容）
- 對話泡泡間距：20px
- 費用顯示：Step 10 摘要才出現，大字粗體金色

## 10. 與小車頭自助發單的差異

| 項目 | 小車頭（司機用） | QR 貴賓單（客人用） |
|------|---------------|-----------------|
| 觸發者 | 司機自己 | 客人掃 QR code |
| 費用填寫 | 司機即時填寫 | 套用司機預設報價 |
| 付款方式 | 司機選擇（轉帳/收現） | **固定為收現**，外派時司機填寫實收/回金 |
| 轉帳單外派 | 不適用 | 轉帳單不可外派 |
| 目的地預設 | 司機手動選機場 | 司機預設的上下車端 |
| Step 10 費用 | 司機自己設定 | 系統套用預設報價 |
