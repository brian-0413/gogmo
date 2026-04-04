# 訂閱與金流系統規格

## 功能概述

本系統整合 UNIPAY 金流，提供司機付費升級和點數儲值功能。

### 付費方案

| 方案 | 價格 | 天數 | 起始 | 截止 |
|------|------|------|------|------|
| 月訂閱 | $299 | 30天 | 付款當日 | D+1 00:00 |
| 年訂閱 | $3,000 | 365天 | 付款當日 | 隔年 D+1 00:00 |

### 儲值方案

| 付款金額 | 入帳點數 | 贈送點數 |
|---------|---------|---------|
| $500 | 520點 | +20點 |
| $1,000 | 1,050點 | +50點 |
| $2,000 | 2,150點 | +150點 |
| $3,000 | 3,300點 | +300點 |

> 點數不可退費、不可轉贈

---

## 資料庫設計

### Prisma Schema 異動

```prisma
// User model 新增
subscriptionPlan    String    @default("free")   // "free" | "premium"
subscriptionStart    DateTime?
subscriptionEnd      DateTime?
lastScheduleReset    DateTime?                    // 每日 quota 重置時間

// Order model 新增
isSystemRecommended  Boolean   @default(false)   // 系統排班產生的訂單，不可當觸發點
```

### PaymentRecord Model（新增）

```prisma
model PaymentRecord {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  type            String    // "subscription_monthly" | "subscription_yearly" | "topup"
  amount          Int       // 付款金額（實收，不含手續費）
  pointsGranted   Int       // 給予點數（訂閱為 0，儲值為入帳點數）
  payuniTradeNo   String?   // UNIPAY 交易序號
  status          String    @default("pending")  // "pending" | "completed" | "failed"
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### 環境變數

```
PAYUNI_HASH_KEY=...
PAYUNI_HASH_IV=...
PAYUNI_MER_ID=...
PAYUNI_ENV=production  # 或 "sandbox"
PAYUNI_NOTIFY_URL=https://your-domain.com/api/payuni/notify
```

---

## 智慧排班 Quota 邏輯

### 核心規則

```
free 用戶：每日最多 1 套（D+1 00:00 重置）
         每套 = 1 司機自選觸發單 + 1 系統排銜接單

premium 用戶：每日最多 3 套（D+1 00:00 重置）
              每套同上，可累積銜接鏈
```

### 觸發點限制

```
isSystemRecommended = false  → 司機自己在大廳挑的單，可以當觸發點
isSystemRecommended = true   → 系統排的單，永遠不能當觸發點
```

### Quota 計算方式

```typescript
// Quota = 當天已 confirm 的套數
// 一套 = 1 司機自選單 + 1 系統排單
// 查詢：當天 00:00 ~ now 的 schedule_records

// free 用戶：已用套數 < 1 → 可以排班
// premium 用戶：已用套數 < 3 → 可以排班
```

### 每日重置

- 使用台北時區（UTC+8）
- 每日 00:00 重置 quota
- 實作：每次呼叫 `/api/schedule/recommend` 前檢查 `lastScheduleReset` 是否已過 24 小時

---

## API 端點設計

### 1. 建立付款訂單

**POST /api/payment/create**

Request:
```json
{
  "type": "subscription_monthly" | "subscription_yearly" | "topup",
  "topupAmount": 500 | 1000 | 2000 | 3000  // 只有 topup 需要
}
```

Response:
```json
{
  "success": true,
  "payuniUrl": "https://api.payuni.com.tw/api/upp",
  "formData": {
    "MerID": "...",
    "Version": "1.0",
    "EncryptInfo": "...",
    "HashInfo": "..."
  }
}
```

### 2. UNIPAY 付款通知（擴展）

**POST /api/payuni/notify**

原有的 notify 邏輯擴展，根據 MerTradeNo 前綴判斷類型：

| MerTradeNo 前綴 | 類型 | 處理邏輯 |
|----------------|------|---------|
| `PAY-SUB-` | 訂閱 | 更新 User subscriptionPlan + subscriptionStart/End |
| `PAY-TOP-` | 儲值 | 點數入帳 Driver.balance |
| `PAY-ORD-` | 一般訂單 | 現有邏輯（若有） |

### 3. 查詢當日 Quota

**GET /api/schedule/quota**

Response:
```json
{
  "success": true,
  "data": {
    "plan": "free" | "premium",
    "dailyUsed": 0,
    "dailyLimit": 1 | 3,
    "remaining": 1 | 3,
    "canSchedule": true | false,
    "resetAt": "2026-04-05T00:00:00+08:00"
  }
}
```

### 4. 查詢訂閱狀態

**GET /api/drivers/subscription**

Response:
```json
{
  "success": true,
  "data": {
    "plan": "free" | "premium",
    "startDate": null | "2026-04-04T00:00:00Z",
    "endDate": null | "2027-04-05T00:00:00Z",
    "isActive": true | false
  }
}
```

### 5. 智慧排班推薦（修改）

**GET /api/schedule/recommend**

修改：前端需傳送 `plan` 參數（free/premium），API 根據方案限制 quota。

---

## 智慧排班 API 修改要點

### `/api/schedule/recommend`

```typescript
// 1. 檢查 quota
const driver = await getDriver(user.driverId)
const plan = driver.subscriptionPlan || 'free'
const limit = plan === 'premium' ? 3 : 1
const used = await getDailyConfirmedSets(user.driverId) // 當天已用套數
if (used >= limit) {
  return { success: false, error: `今日智慧排班額度已用完（${limit}套）` }
}

// 2. 只允許 isSystemRecommended = false 的訂單當觸發點
const triggerOrders = orders.filter(o => o.isSystemRecommended === false)
```

### `/api/schedule/confirm`

```typescript
// 1. 銜接單標記為系統排班
for (const orderId of recommendedOrderIds) {
  await prisma.order.update({
    where: { id: orderId },
    data: { isSystemRecommended: true }
  })
}

// 2. 記錄排班套數（用於 quota 計算）
await prisma.scheduleRecord.create({
  data: {
    driverId: user.driverId,
    triggerOrderId: triggerOrderId,
    recommendedOrderIds: recommendedOrderIds,
    setsUsed: 1,
    date: todayString // YYYY-MM-DD
  }
})
```

### 新增 ScheduleRecord Model

```prisma
model ScheduleRecord {
  id                   String   @id @default(cuid())
  driverId             String
  driver               Driver   @relation(fields: [driverId], references: [id])
  triggerOrderId       String   // 司機自選的觸發單
  recommendedOrderIds   String[] // 系統排的銜接單
  setsUsed             Int      @default(1)
  date                 String   // YYYYMMDD 格式
  createdAt            DateTime @default(now())
}
```

---

## 前端頁面規劃

### 1. 司機端新增 Tab：訂閱與儲值

```
路徑：/dashboard/driver（擴展 tab）
新增 Tab：帳務中心（已有）/ 我的小隊（新）
```

#### 訂閱頁面

```
┌─────────────────────────────────────────┐
│ 升級為高級司機                           │
│                                          │
│ 方案一：月訂閱                            │
│ NT$299 / 月                             │
│ 智慧排班每日 3 套                         │
│ 小隊互助模式                             │
│ [立即升級]                               │
│                                          │
│ 方案二：年訂閱                            │
│ NT$3,000 / 年                           │
│ 相當於每月 $250，省 $588                 │
│ [立即升級]                               │
│                                          │
│ 當前方案：一般司機                        │
│ 訂閱有效期：—                            │
└─────────────────────────────────────────┘
```

#### 儲值頁面

```
┌─────────────────────────────────────────┐
│ 點數儲值                                 │
│ 當前點數：1,250 點                       │
│                                          │
│ [500元 → 520點]  [+20]                  │
│ [1000元 → 1,050點] [+50]                │
│ [2000元 → 2,150點] [+150]              │
│ [3000元 → 3,300點] [+300]              │
│                                          │
│ 點數不可退費、不可轉贈                    │
└─────────────────────────────────────────┘
```

### 2. 智慧排班按鈕 UI 變動

| 情境 | 顯示 |
|------|------|
| free 用戶，今日未用過 | 「智慧排班」（藍色） |
| free 用戶，今日已用完 | 「智慧排班」（灰色，disabled，hover 提示「今日已用完」） |
| premium 用戶，有 quota | 「智慧排班」（藍色）+ 顯示剩餘套數 |
| premium 用戶，quota 用完 | 「智慧排班」（灰色，disabled） |
| 系統排的單 | 無「智慧排單」按鈕（隱藏） |

### 3. 小隊頁面（Premium 功能）

```
┌─────────────────────────────────────────┐
│ 我的小隊                    [Premium]    │
│                                          │
│ ⚠️ 小隊功能為高級司機專屬                 │
│                                          │
│ [查看方案]  [升級月費]                    │
└─────────────────────────────────────────┘
```

---

## UNIPAY 整合實作

### 加密邏輯（沿用 GF）

```typescript
// src/lib/payuni.ts
import crypto from 'crypto'

export function encryptPayuni(data: Record<string, string>) {
  const merKey = process.env.PAYUNI_HASH_KEY || ''
  const merIV  = Buffer.from(process.env.PAYUNI_HASH_IV || '')

  const plaintext = Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')

  const cipher = crypto.createCipheriv('aes-256-gcm', merKey, merIV)
  let cipherText = cipher.update(plaintext, 'utf8', 'base64')
  cipherText += cipher.final('base64')
  const tag = cipher.getAuthTag().toString('base64')

  const EncryptInfo = Buffer.from(`${cipherText}:::${tag}`)
    .toString('hex').trim()

  const HashInfo = crypto
    .createHash('sha256')
    .update(`${merKey}${EncryptInfo}${process.env.PAYUNI_HASH_IV}`)
    .digest('hex')
    .toUpperCase()

  return { EncryptInfo, HashInfo }
}

export function decryptPayuni(encryptStr: string) {
  const merKey = process.env.PAYUNI_HASH_KEY || ''
  const merIV  = Buffer.from(process.env.PAYUNI_HASH_IV || '')

  const [encryptData, tag] = Buffer.from(encryptStr, 'hex')
    .toString().split(':::')

  const decipher = crypto.createDecipheriv('aes-256-gcm', merKey, merIV)
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  let text = decipher.update(encryptData, 'base64', 'utf8')
  text += decipher.final('utf8')

  return Object.fromEntries(new URLSearchParams(text))
}
```

### 建立付款訂單 API

```typescript
// src/app/api/payment/create/route.ts

const MERCHANT_ID = process.env.PAYUNI_MER_ID
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

export async function POST(request: Request) {
  const { type, topupAmount } = await request.json()
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  const user = await getUserFromToken(token)

  if (!user) return Response.json({ error: '未授權' }, { status: 401 })

  let amount: number
  let prodDesc: string
  let merTradeNo: string
  const timestamp = Math.floor(Date.now() / 1000)

  if (type === 'subscription_monthly') {
    amount = 299
    prodDesc = '高級司機月費訂閱'
    merTradeNo = `PAY-SUB-${timestamp}-${user.id}`
  } else if (type === 'subscription_yearly') {
    amount = 3000
    prodDesc = '高級司機年費訂閱'
    merTradeNo = `PAY-SUB-${timestamp}-${user.id}`
  } else if (type === 'topup') {
    const pointsMap: Record<number, number> = { 500: 520, 1000: 1050, 2000: 2150, 3000: 3300 }
    amount = topupAmount
    prodDesc = `司機點數儲值 ${pointsMap[amount]} 點`
    merTradeNo = `PAY-TOP-${timestamp}-${user.id}`
  } else {
    return Response.json({ error: '無效的付款類型' }, { status: 400 })
  }

  // 先建立 PaymentRecord（pending 狀態）
  await prisma.paymentRecord.create({
    data: {
      userId: user.id,
      type,
      amount,
      pointsGranted: type === 'topup' ? pointsMap[amount] : 0,
      status: 'pending'
    }
  })

  // UNIPAY 表單加密
  const { EncryptInfo, HashInfo } = encryptPayuni({
    MerID: MERCHANT_ID,
    MerTradeNo: merTradeNo,
    TradeAmt: String(amount),
    Timestamp: String(timestamp),
    ProdDesc: prodDesc,
    BuyerName: user.name,
    BuyerMail: user.email || '',
    ReturnURL: `${BASE_URL}/payment/return?orderNo=${encodeURIComponent(merTradeNo)}`,
    NotifyURL: `${BASE_URL}/api/payuni/notify`,
    CardInst: '0',
  })

  return Response.json({
    success: true,
    payuniUrl: process.env.PAYUNI_ENV === 'production'
      ? 'https://api.payuni.com.tw/api/upp'
      : 'https://sandbox-api.payuni.com.tw/api/upp',
    formData: { MerID: MERCHANT_ID, Version: '1.0', EncryptInfo, HashInfo },
  })
}
```

### UNIPAY Notify 處理（擴展）

```typescript
// src/app/api/payuni/notify/route.ts

if (tradeInfo.TradeStatus === '1') {
  const merTradeNo = tradeInfo.MerTradeNo
  const prefix = merTradeNo.split('-')[1] // SUB / TOP / ORD

  if (prefix === 'SUB') {
    // 訂閱：更新用戶方案
    const userId = merTradeNo.split('-')[2]
    const isYearly = merTradeNo.includes('-Y-') // 年訂閱識別
    const duration = isYearly ? 365 : 30
    const now = new Date()
    const endDate = new Date(now)
    endDate.setDate(endDate.getDate() + duration + 1)
    endDate.setHours(0, 0, 0, 0)

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: 'premium',
        subscriptionStart: now,
        subscriptionEnd: endDate,
      }
    })
  } else if (prefix === 'TOP') {
    // 儲值：點數入帳
    const userId = merTradeNo.split('-')[2]
    const record = await prisma.paymentRecord.findFirst({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' }
    })
    if (record) {
      await prisma.driver.update({
        where: { userId },
        data: { balance: { increment: record.pointsGranted } }
      })
      await prisma.paymentRecord.update({
        where: { id: record.id },
        data: { status: 'completed', payuniTradeNo: tradeInfo.TradeNo }
      })
    }
  }

  // 更新 PaymentRecord
  await prisma.paymentRecord.updateMany({
    where: { userId, status: 'pending' },
    data: { status: 'completed', payuniTradeNo: tradeInfo.TradeNo }
  })
}
```

### 付款結果頁面

```
路徑：/payment/return

邏輯：
1. 有 EncryptInfo → 解密驗證
2. 無 → 查 DB PaymentRecord status
3. 顯示成功/失敗結果
```

---

## 自動降級機制

每日凌晨檢查（可在 `/api/schedule/recommend` 中一併檢查）：

```typescript
async function checkAndResetQuota(driverId: string) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { user: true }
  })
  if (!driver?.user) return

  // 檢查訂閱是否過期
  if (driver.user.subscriptionEnd && new Date() > driver.user.subscriptionEnd) {
    await prisma.user.update({
      where: { id: driver.user.id },
      data: { subscriptionPlan: 'free' }
    })
  }

  // 檢查是否需要重置每日 quota
  const now = new Date()
  const today = format(now, 'yyyyMMdd')
  if (driver.user.lastScheduleReset) {
    const lastReset = format(driver.user.lastScheduleReset, 'yyyyMMdd')
    if (lastReset !== today) {
      // 新的一天，重置
      await prisma.user.update({
        where: { id: driver.user.id },
        data: { lastScheduleReset: now }
      })
    }
  }
}
```

---

## 小隊模式（Premium 功能）

詳細規格見 `docs/squad-system.md`

### 與訂閱系統的整合

- 小隊功能預設只對 `subscriptionPlan = 'premium'` 的司機開放
- 一般用戶點擊「我的小隊」時，顯示「此功能為高級司機專屬」並引導升級

---

## 開發優先順序

| 優先序 | 項目 |
|--------|------|
| 1 | Prisma schema 異動（新增欄位 + PaymentRecord + ScheduleRecord） |
| 2 | UNIPAY 加密解密工具（`src/lib/payuni.ts`） |
| 3 | `/api/payment/create` API |
| 4 | `/api/payuni/notify` 擴展 |
| 5 | `/api/schedule/quota` API |
| 6 | 司機端訂閱/儲值頁面 |
| 7 | `/api/schedule/recommend` 和 `/api/schedule/confirm` 修改 |
| 8 | 前端智慧排班按鈕 quota 顯示邏輯 |
| 9 | 每日自動重置 + 自動降級邏輯 |
| 10 | 小隊頁面（Premium 提示） |
