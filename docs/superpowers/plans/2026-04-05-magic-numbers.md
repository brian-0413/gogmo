# 魔法數字重構計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將散落全站的魔法數字抽出為具名常數於 `src/lib/constants.ts`，提升程式碼可讀性與可維護性

**Architecture:** 在 `constants.ts` 新增業務規則常數區塊，對 14 個檔案中的使用處以常數取代硬編碼數值

**Tech Stack:** TypeScript

---

## 檔案結構變更

| 動作 | 檔案 | 變更內容 |
|------|------|----------|
| 修改 | `src/lib/constants.ts` | 新增業務規則常數區塊 |
| 修改 | `src/lib/validation.ts` | 加入 MAX_ORDER_PRICE |
| 修改 | `src/app/api/orders/[id]/accept/route.ts` | PLATFORM_FEE_RATE |
| 修改 | `src/app/api/orders/[id]/cancel/route.ts` | CANCELLATION_FEE_RATE |
| 修改 | `src/app/api/schedule/confirm/route.ts` | PLATFORM_FEE_RATE |
| 修改 | `src/app/api/dispatchers/settlement/route.ts` | PLATFORM_FEE_RATE |
| 修改 | `src/app/dashboard/driver/page.tsx` | DRIVER_EARNINGS_RATE, CANCELLATION_FEE_RATE |
| 修改 | `src/app/dashboard/driver/order/[id]/page.tsx` | CANCELLATION_FEE_RATE |
| 修改 | `src/components/driver/SettlementTab.tsx` | DRIVER_EARNINGS_RATE, WEEKLY_SETTLEMENT_TARGET |
| 修改 | `src/components/driver/SmartSchedulePanel.tsx` | PLATFORM_FEE_RATE |
| 修改 | `src/app/dashboard/dispatcher/page.tsx` | DEFAULT_ORDER_PRICE |
| 修改 | `src/lib/auth.ts` | NEW_USER_BONUS |

---

## Task 1: 抽出所有魔法數字為具名常數

### Context

全站有大量硬編碼的魔法數字散落各處，包括平台抽成比率、取消費率、預設金額等。將這些改為具名常數可提升可讀性，也方便未來調整費率。

### 常數定義（加入 `src/lib/constants.ts`）

在 `constants.ts` 末尾（`STATUS_TAG_STYLE` 之後）加入：

```typescript
// ============ 業務規則常數 ============

/** 平台抽成比率（5%） */
export const PLATFORM_FEE_RATE = 0.05

/** 司機實得比率（1 - 平台抽成 = 95%） */
export const DRIVER_EARNINGS_RATE = 0.95

/** 取消訂單手續費比率（10%） */
export const CANCELLATION_FEE_RATE = 0.1

/** 每週結算目標（點數） */
export const WEEKLY_SETTLEMENT_TARGET = 5000

/** 新用戶贈送點數 */
export const NEW_USER_BONUS = 500

/** 訂單預設金額（當無法解析時） */
export const DEFAULT_ORDER_PRICE = 800

/** 最大訂單金額上限 */
export const MAX_ORDER_PRICE = 100000
```

### Step 1: 修改 `src/lib/constants.ts`

在 `constants.ts` 末尾（`STATUS_TAG_STYLE` 定義之後）加入以上業務規則常數區塊。

### Step 2: 修改 `src/lib/validation.ts`

在 `MAX_FIELD_LENGTHS` 定義中加入 `maxPrice: MAX_ORDER_PRICE`，並從 `@/lib/constants` import `MAX_ORDER_PRICE`。

### Step 3: 修改 API routes

**`src/app/api/orders/[id]/accept/route.ts`**：
- 加入 import：`import { PLATFORM_FEE_RATE } from '@/lib/constants'`
- 行 130, 162, 196：將 `Math.floor(order.price * 0.05)` 改為 `Math.floor(order.price * PLATFORM_FEE_RATE)`

**`src/app/api/orders/[id]/cancel/route.ts`**：
- 加入 import：`import { CANCELLATION_FEE_RATE } from '@/lib/constants'`
- 行 67：將 `Math.floor(order.price * 0.1)` 改為 `Math.floor(order.price * CANCELLATION_FEE_RATE)`

**`src/app/api/schedule/confirm/route.ts`**：
- 加入 import：`import { PLATFORM_FEE_RATE } from '@/lib/constants'`
- 行 76：將 `Math.floor(order.price * 0.05)` 改為 `Math.floor(order.price * PLATFORM_FEE_RATE)`

**`src/app/api/dispatchers/settlement/route.ts`**：
- 加入 import：`import { PLATFORM_FEE_RATE } from '@/lib/constants'`
- 行 67, 92：將 `Math.floor(order.price * 0.05)` 改為 `Math.floor(order.price * PLATFORM_FEE_RATE)`

### Step 4: 修改 Frontend Pages

**`src/app/dashboard/driver/page.tsx`**：
- 加入 import：`import { DRIVER_EARNINGS_RATE, CANCELLATION_FEE_RATE } from '@/lib/constants'`
- 行 131：將 `Math.floor(tx.amount * 0.95)` 改為 `Math.floor(tx.amount * DRIVER_EARNINGS_RATE)`
- 行 290：將 `Math.floor(order.price * 0.1)` 改為 `Math.floor(order.price * CANCELLATION_FEE_RATE)`

**`src/app/dashboard/driver/order/[id]/page.tsx`**：
- 加入 import：`import { CANCELLATION_FEE_RATE } from '@/lib/constants'`
- 行 96：將 `Math.floor(order.price * 0.1)` 改為 `Math.floor(order.price * CANCELLATION_FEE_RATE)`

**`src/app/dashboard/dispatcher/page.tsx`**：
- 加入 import：`import { DEFAULT_ORDER_PRICE } from '@/lib/constants'`
- 行 164：將 `price: item.price ?? 800` 改為 `price: item.price ?? DEFAULT_ORDER_PRICE`
- 行 217：將 `price: item.editedPrice ?? item.price ?? 800` 改為 `price: item.editedPrice ?? item.price ?? DEFAULT_ORDER_PRICE`

### Step 5: 修改 Components

**`src/components/driver/SettlementTab.tsx`**：
- 加入 import：`import { DRIVER_EARNINGS_RATE, WEEKLY_SETTLEMENT_TARGET } from '@/lib/constants'`
- 行 115：將 `Math.floor(tx.amount * 0.95)` 改為 `Math.floor(tx.amount * DRIVER_EARNINGS_RATE)`
- 行 235：將 `Math.floor(tx.amount * 0.95)` 改為 `Math.floor(tx.amount * DRIVER_EARNINGS_RATE)`
- 行 142：將 `>= 5000` 改為 `>= WEEKLY_SETTLEMENT_TARGET`
- 行 145：將 `/ 5000` 改為 `/ WEEKLY_SETTLEMENT_TARGET`

**`src/components/driver/SmartSchedulePanel.tsx`**：
- 加入 import：`import { PLATFORM_FEE_RATE } from '@/lib/constants'`
- 行 238：將 `Math.floor(rec.price * 0.05)` 改為 `Math.floor(rec.price * PLATFORM_FEE_RATE)`

### Step 6: 修改 lib 檔案

**`src/lib/auth.ts`**：
- 加入 import：`import { NEW_USER_BONUS } from '@/lib/constants'`
- 行 89：將 `balance: 500` 改為 `balance: NEW_USER_BONUS`

### Step 7: Build 驗證

```bash
npm run build
```
預期：編譯成功，無錯誤。

### Step 8: Commit

```bash
git add src/lib/constants.ts src/lib/validation.ts src/lib/auth.ts
git add src/app/api/orders/[id]/accept/route.ts
git add src/app/api/orders/[id]/cancel/route.ts
git add src/app/api/schedule/confirm/route.ts
git add src/app/api/dispatchers/settlement/route.ts
git add src/app/dashboard/driver/page.tsx
git add src/app/dashboard/driver/order/[id]/page.tsx
git add src/app/dashboard/dispatcher/page.tsx
git add src/components/driver/SettlementTab.tsx
git add src/components/driver/SmartSchedulePanel.tsx
git commit -m "refactor: 抽出魔法數字為具名常數於 constants.ts"
```

---

## 驗收標準

- [ ] `npm run build` 全程無錯誤
- [ ] `constants.ts` 包含所有業務規則常數（PLATFORM_FEE_RATE, DRIVER_EARNINGS_RATE, CANCELLATION_FEE_RATE, WEEKLY_SETTLEMENT_TARGET, NEW_USER_BONUS, DEFAULT_ORDER_PRICE, MAX_ORDER_PRICE）
- [ ] 所有使用 `0.05` / `0.1` / `0.95` 計算手續費的地方改為使用常數
- [ ] 所有使用 `5000` 週結算目標的地方改為使用常數
- [ ] 所有使用 `500` 新用戶贈點的地方改為使用常數
- [ ] 所有使用 `800` 預設金額的地方改為使用常數
- [ ] 所有使用 `100000` 最大金額的地方改為使用常數
- [ ] 無任何地方使用硬編碼的魔法數字（業務規則相關）
