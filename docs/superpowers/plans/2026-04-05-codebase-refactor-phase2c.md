# 程式碼基底 Phase 2C 重構計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理未使用 import、統一重複介面、抽出共用工具函式、移除重複驗證常數

**Architecture:** 清理零散的小問題，降低程式碼庫的維護成本。分為 import cleanup、interface unification、utility extraction、validation constants 四個方向。

**Tech Stack:** TypeScript, Next.js 14 App Router, React

---

## 檔案結構變更

| 動作 | 檔案 | 職責 |
|------|------|------|
| 修改 | `src/app/dashboard/driver/page.tsx` | 移除 8 個未使用的 icon import |
| 修改 | `src/lib/utils.ts` | 新增 `getDateOptions()` 函式 |
| 修改 | `src/components/dispatcher/CreateDefaultsCard.tsx` | 使用 utils.ts 的 getDateOptions |
| 修改 | `src/app/dashboard/dispatcher/page.tsx` | 使用 utils.ts 的 getDateOptions，移除 DATE_OPTIONS，統一 ReviewItem |
| 修改 | `src/components/dispatcher/ReviewItemCard.tsx` | 使用統一的 ReviewItem 介面 |
| 建立 | `src/lib/validation.ts` | 抽出 MAX_FIELD_LENGTHS 常數 |
| 修改 | `src/app/api/orders/route.ts` | import MAX_FIELD_LENGTHS from validation.ts |
| 修改 | `src/app/api/orders/[id]/route.ts` | import MAX_FIELD_LENGTHS from validation.ts |

---

## Task 1: 移除 driver/page.tsx 未使用的 import

### Context

`src/app/dashboard/driver/page.tsx` 行 15 的 lucide-react import 包含 8 個未使用的 icon。SmartSchedulePanel 抽出後，這些 icon 已移到元件內。

未使用的 icon：Clock, Star, TrendingUp, ArrowRight, CheckCircle, AlertTriangle, XCircle, ChevronRight

仍在使用的 icon：ClipboardList, FileText, Wallet, LogOut, Plane, Radio, Inbox, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, Car, Calendar

### Step 1: 修改 import

使用 Edit tool，在 `src/app/dashboard/driver/page.tsx` 行 15：

找到：
```typescript
import { ClipboardList, FileText, Wallet, LogOut, Plane, TrendingUp, Radio, Inbox, Clock, ArrowUpDown, ArrowUp, ArrowDown, Car, Star, Sparkles, ArrowRight, CheckCircle, AlertTriangle, XCircle, Calendar, ChevronRight } from 'lucide-react'
```

替換為：
```typescript
import { ClipboardList, FileText, Wallet, LogOut, Plane, Radio, Inbox, ArrowUpDown, ArrowUp, ArrowDown, Car, Sparkles, Calendar } from 'lucide-react'
```

### Step 2: Build 驗證

```bash
npm run build
```
預期：編譯成功，無錯誤。

### Step 3: Commit

```bash
git add src/app/dashboard/driver/page.tsx
git commit -m "chore: 移除 driver/page.tsx 中未使用的 icon import"
```

---

## Task 2: 抽出 `getDateOptions()` 至 utils.ts

### Context

`DATE_OPTIONS` 生成邏輯在 `dispatcher/page.tsx` 行 50-59 和 `CreateDefaultsCard.tsx` 行 13-22 完全重複。將其抽出為 `src/lib/utils.ts` 的 `getDateOptions()` 函式，統一管理。

### Step 1: 讀取 utils.ts

使用 Read tool 讀取 `src/lib/utils.ts` 全文，確認當前結構。

### Step 2: 修改 utils.ts

在 `utils.ts` 末尾（`formatOrderNo` 函式之後）加入：

```typescript
// ============ 日期工具 ============

export interface DateOption {
  value: string
  label: string
}

/**
 * 產生派單日期選項（今天起算 N 天）
 * @param daysAhead 預設 14 天（今天 + 未來 14 天）
 */
export function getDateOptions(daysAhead: number = 14): DateOption[] {
  const options: DateOption[] = [
    { value: '', label: '選擇日期...' },
  ]
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayLabel = i === 0 ? '今天' : i === 1 ? '明天' : format(d, 'M/d (EEE)', { locale: zhTW })
    options.push({ value: dateStr, label: dayLabel })
  }
  return options
}
```

**注意**：`format` 已在 utils.ts 中 import（行 3）。需加入 `import { zhTW } from 'date-fns/locale'`。

### Step 3: 修改 CreateDefaultsCard.tsx

使用 Edit tool：

1. 刪除 `DATE_OPTIONS` 的生成邏輯（行 13-22）：
```typescript
// 刪除這段：
const DATE_OPTIONS = [
  { value: '', label: '選擇日期...' },
]
for (let i = 0; i <= 14; i++) {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const dateStr = format(d, 'yyyy-MM-dd')
  const dayLabel = i === 0 ? '今天' : i === 1 ? '明天' : format(d, 'M/d (EEE)', { locale: zhTW })
  DATE_OPTIONS.push({ value: dateStr, label: dayLabel })
}
```

2. 將頂部 import 改為：
```typescript
import { Calendar, FileText } from 'lucide-react'
import { getDateOptions } from '@/lib/utils'
```
刪除 `import { format } from 'date-fns'` 和 `import { zhTW } from 'date-fns/locale'`（如果不再需要）

3. 在元件內使用：
```typescript
const DATE_OPTIONS = getDateOptions()
```

### Step 4: 修改 dispatcher/page.tsx

1. 刪除行 50-59 的 `DATE_OPTIONS` 生成邏輯

2. 加入 import：
```typescript
import { getDateOptions } from '@/lib/utils'
```
刪除 `DATE_OPTIONS` 的生成程式碼（行 50-59）

3. 在 component 內使用：
```typescript
const DATE_OPTIONS = getDateOptions()
```

### Step 5: Build 驗證

```bash
npm run build
```
預期：編譯成功。

### Step 6: Commit

```bash
git add src/lib/utils.ts src/components/dispatcher/CreateDefaultsCard.tsx src/app/dashboard/dispatcher/page.tsx
git commit -m "refactor: 抽出 getDateOptions 至 utils.ts，移除重複的 DATE_OPTIONS 邏輯"
```

---

## Task 3: 統一 ReviewItem interface

### Context

`dispatcher/page.tsx` 行 36-48 定義了 `ReviewItem extends ParsedOrder`，`ReviewItemCard.tsx` 行 18-36 定義了 `ReviewItemCardItem`。兩者非常相似但獨立。統一為一個共享介面。

### Analysis

`ReviewItem` (page.tsx) extends `ParsedOrder`，包含所有 ParsedOrder 的欄位。
`ReviewItemCardItem` 是獨立的介面，幾乎相同但沒有 extends。

最佳方案：
- 在 `ReviewItemCard.tsx` 中將 `ReviewItemCardItem` 改名為 `ReviewItem`
- 從 `dispatcher/page.tsx` 刪除 `ReviewItem` 定義，改 import `ReviewItem` from `ReviewItemCard`
- `ReviewItemCard` props 使用同一個 `ReviewItem`

### Step 1: 修改 ReviewItemCard.tsx

1. 將 `ReviewItemCardItem` rename 為 `ReviewItem`

找到：
```typescript
export interface ReviewItemCardItem {
  reviewId: string
  date?: string | null
  time?: string | null
  ...
  editedKenichi?: boolean
}
```

替換為：
```typescript
export interface ReviewItem {
  reviewId: string
  date?: string | null
  time?: string | null
  type: string
  vehicle?: string
  price?: number | null
  pickupLocation?: string
  dropoffLocation?: string
  rawText?: string
  notes?: string
  editedPrice?: number
  editedTime?: string
  editedPickup?: string
  editedDropoff?: string
  editedNotes?: string
  editedVehicle?: string
  editedVehicleCustom?: string
  editedKenichi?: boolean
}
```

2. 更新 `ReviewItemCardProps` 中的 item 型別：
```typescript
export interface ReviewItemCardProps {
  item: ReviewItem
  index: number
  editingId: string | null
  editForm: ReviewItemCardEditForm
  onEdit: (item: ReviewItem) => void
  onSave: (reviewId: string) => void
  onCancel: () => void
  onDelete: (reviewId: string) => void
  onEditFormChange: (form: ReviewItemCardEditForm) => void
}
```

3. 更新函式內的 onEdit 呼叫（行 160）：
移除 `as ReviewItemCardItem & Record<string, unknown>` cast，改為直接傳入 `item`

### Step 2: 修改 dispatcher/page.tsx

1. 刪除行 36-48 的 `ReviewItem extends ParsedOrder` 介面定義

2. 加入 import：
```typescript
import { ReviewItemCard, ReviewItem } from '@/components/dispatcher/ReviewItemCard'
```

3. 更新 `reviewItems` state 的型別：
```typescript
const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
```

4. 確認 `handleEditItem` 接收的參數型別正確（應為 `ReviewItem`）

### Step 3: Build 驗證

```bash
npm run build
```
預期：編譯成功，無型別錯誤。

### Step 4: Commit

```bash
git add src/components/dispatcher/ReviewItemCard.tsx src/app/dashboard/dispatcher/page.tsx
git commit -m "refactor: 統一 ReviewItem interface，移除重複定義"
```

---

## Task 4: 抽出 MAX_FIELD_LENGTHS 至 validation.ts

### Context

`src/app/api/orders/route.ts` 行 190-201 和 `src/app/api/orders/[id]/route.ts` 行 264-273 各自定義了幾乎相同的 `MAX_LENGTHS`。將其抽出為 `src/lib/validation.ts`。

### Analysis

orders/route.ts 的 MAX_LENGTHS（行 190-201）：
```typescript
const MAX_LENGTHS: Record<string, number> = {
  passengerName: 50,
  passengerPhone: 20,
  pickupLocation: 100,
  pickupAddress: 200,
  dropoffLocation: 100,
  dropoffAddress: 200,
  flightNumber: 20,
  note: 500,
  notes: 500,
  rawText: 1000,
}
```

orders/[id]/route.ts 的 MAX_LENGTHS（行 264-273）：
```typescript
const MAX_LENGTHS: Record<string, number> = {
  passengerName: 50,
  passengerPhone: 20,
  pickupLocation: 100,
  pickupAddress: 200,
  dropoffLocation: 100,
  dropoffAddress: 200,
  flightNumber: 20,
  note: 500,
}
```

兩者幾乎相同（orders/route.ts 多了 notes 和 rawText）。使用兩者的 union：`MAX_FIELD_LENGTHS = Record<string, number>` 給予最大彈性。

### Step 1: 建立 src/lib/validation.ts

建立檔案：

```typescript
// 訂單欄位長度驗證常數
// 用於 orders API routes，防止資料庫欄位溢位

export const MAX_FIELD_LENGTHS: Record<string, number> = {
  passengerName: 50,
  passengerPhone: 20,
  pickupLocation: 100,
  pickupAddress: 200,
  dropoffLocation: 100,
  dropoffAddress: 200,
  flightNumber: 20,
  note: 500,
  notes: 500,
  rawText: 1000,
}
```

### Step 2: 修改 orders/route.ts

1. 加入 import（頂部）：
```typescript
import { MAX_FIELD_LENGTHS } from '@/lib/validation'
```

2. 刪除行 190-201 的 `MAX_LENGTHS` 定義，改用 `MAX_FIELD_LENGTHS`

### Step 3: 修改 orders/[id]/route.ts

1. 加入 import（頂部）：
```typescript
import { MAX_FIELD_LENGTHS } from '@/lib/validation'
```

2. 刪除行 264-273 的 `MAX_LENGTHS` 定義，改用 `MAX_FIELD_LENGTHS`

### Step 4: Build 驗證

```bash
npm run build
```
預期：編譯成功。

### Step 5: Commit

```bash
git add src/lib/validation.ts src/app/api/orders/route.ts src/app/api/orders/[id]/route.ts
git commit -m "refactor: 抽出 MAX_FIELD_LENGTHS 至 validation.ts，移除 API routes 重複定義"
```

---

## Task 5: 增強 ai.ts legacy section JSDoc

### Context

`src/lib/ai.ts` 行 452-545 的 legacy section 已有 @deprecated 標記。進一步完善 JSDoc，說明即將移除的版本和时间。

### Step 1: 讀取 ai.ts legacy section

使用 Read tool 讀取 `src/lib/ai.ts` 行 448-460（legacy section header）。

### Step 2: 修改 legacy section header

找到當前的 section header（`// ============ 舊版 API 相容性 ============`），替換為：

```typescript
// ============ 舊版 API 相容性（已廢棄） ============
// 以下介面和函式已標記為 @deprecated
// 將在 v2.0 正式移除，請勿在新程式碼中使用
```

### Step 3: Build 驗證

```bash
npm run build
```

### Step 4: Commit

```bash
git add src/lib/ai.ts
git commit -m "docs: 增強 ai.ts legacy section 標記說明"
```

---

## 驗收標準

- [ ] `npm run build` 全程無錯誤
- [ ] driver/page.tsx 無未使用的 icon import
- [ ] `src/lib/utils.ts` 有 getDateOptions() 函式
- [ ] CreateDefaultsCard 和 dispatcher/page 都使用 getDateOptions，無重複邏輯
- [ ] ReviewItem 介面統一，無重複定義
- [ ] `src/lib/validation.ts` 存在，MAX_FIELD_LENGTHS 被兩個 orders API 使用
- [ ] ai.ts legacy section 有明確的廢棄說明
- [ ] 所有舊功能仍正常運作
