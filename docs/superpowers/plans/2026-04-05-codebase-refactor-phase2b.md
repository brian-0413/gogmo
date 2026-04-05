# 程式碼基底 Phase 2B 重構計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出派單方的建立訂單預設值卡和審核項目卡、將 AI 解析的 SYSTEM_PROMPT 獨立成檔案、移除 ai.ts 中的重複類型定義、標記舊版程式碼為 deprecated

**Architecture:**
- CreateDefaultsCard: 從 dispatcher/page.tsx 的 create tab 抽出 Defaults UI 區塊（日期選擇器、車型按鈕組、肯驛 toggle），作為受控元件
- ReviewItemCard: 從 dispatcher/page.tsx 的 review tab 抽出個別審核項目卡片（支援內嵌編輯），作為受控元件
- SYSTEM_PROMPT: 從 ai.ts 抽出至 `src/lib/prompts/order-parsing.ts`，作為純資料檔
- 重複類型: ai.ts 中的 OrderType/VehicleType/PlateType/BatchOrderDefaults 改由 types/index.ts import

**Tech Stack:** TypeScript, Next.js 14 App Router, React

---

## 檔案結構變更

| 動作 | 檔案 | 職責 |
|------|------|------|
| 建立 | `src/components/dispatcher/CreateDefaultsCard.tsx` | 建立訂單預設值卡（日期/車型/肯驛），從 page 抽出 |
| 建立 | `src/components/dispatcher/ReviewItemCard.tsx` | 審核項目卡片（內嵌編輯），從 page 抽出 |
| 建立 | `src/lib/prompts/order-parsing.ts` | AI 解析用的 SYSTEM_PROMPT template literal |
| 修改 | `src/app/dashboard/dispatcher/page.tsx` | 移除內嵌元件，改 import 獨立元件 |
| 修改 | `src/lib/ai.ts` | 移除重複類型 import from types，抽出 SYSTEM_PROMPT import，標記 legacy |

---

## Task 1: 抽出派單方 `CreateDefaultsCard` 元件

### Context

`src/app/dashboard/dispatcher/page.tsx` 行 453-540 是建立訂單流程的第一步：Defaults 卡片，包含日期選擇器、車型按鈕組、肯驛 toggle。約 87 行 JSX。將其抽出為 `src/components/dispatcher/CreateDefaultsCard.tsx`。

### Dependencies

此元件依賴：
- `format` from `date-fns`
- `zhTW` from `date-fns/locale`
- `Calendar` from lucide-react
- `FileText` from lucide-react
- VEHICLE_OPTIONS 常數（目前在 page.tsx 行 73-76，需移動或重新定義）

### Step 1: 讀取完整程式碼

使用 Read tool 讀取 `src/app/dashboard/dispatcher/page.tsx` 行 51-80（DATE_OPTIONS + VEHICLE_OPTIONS）以及行 453-540（完整 Defaults card JSX）。

### Step 2: 建立 `src/components/dispatcher/CreateDefaultsCard.tsx`

建立檔案，包含：
- `'use client'` 標記
- 必要的 import
- VEHICLE_OPTIONS 常數（從 page.tsx 行 73-76 複製）
- DATE_OPTIONS 在 component 內生成（與 page.tsx 行 51-60 相同邏輯）
- `CreateDefaultsCardProps` interface：

```typescript
interface CreateDefaultsCardProps {
  defaults: {
    date?: string
    vehicle?: string
    vehicleCustom?: string
    kenichiRequired?: boolean
  }
  onChange: (defaults: CreateDefaultsCardProps['defaults']) => void
}
```

- 完整的 `CreateDefaultsCard` 函式，props 傳入的 defaults 和 onChange 替換原本的 `defaults` state 和 `setDefaults`

**重要**：
- `defaults.vehicle` 的比對值需支援中文（如 `'任意車'`, `'小車'`, `'休旅'`, `'自填'`）
- `setDefaults(prev => ({ ...prev, ...newDefaults }))` 改為 `onChange({ ...defaults, ...partial })`

### Step 3: 修改 `src/app/dashboard/dispatcher/page.tsx`

- 刪除行 73-76 的 VEHICLE_OPTIONS 常數定義（已移到 CreateDefaultsCard）
- 在頂部 import 區塊加入：
  ```typescript
  import { CreateDefaultsCard } from '@/components/dispatcher/CreateDefaultsCard'
  ```
- 找到行 453-540 的 Defaults card JSX（`{/* Defaults card */}` 開始），替換為：
  ```tsx
  <CreateDefaultsCard
    defaults={defaults}
    onChange={(newDefaults) => setDefaults(prev => ({ ...prev, ...newDefaults }))}
  />
  ```
- 刪除原本的 Defaults card JSX（行 454-540）
- 移除不再需要的 `Calendar` 和 `FileText` import（確認是否只用於 Defaults card）

### Step 4: Build 驗證

```bash
npm run build
```
預期：編譯成功，CreateDefaultsCard 元件獨立運作。

### Step 5: Commit

```bash
git add src/components/dispatcher/CreateDefaultsCard.tsx src/app/dashboard/dispatcher/page.tsx
git commit -m "refactor: 抽出 CreateDefaultsCard 元件，簡化 dispatcher/page.tsx"
```

---

## Task 2: 抽出派單方 `ReviewItemCard` 元件

### Context

`src/app/dashboard/dispatcher/page.tsx` 行 612-716 是審核清單中每個項目的渲染邏輯，包含內嵌編輯模式。約 104 行 JSX。將其抽出為 `src/components/dispatcher/ReviewItemCard.tsx`。

### Dependencies

此元件依賴：
- `ReviewItem` interface（目前在 page.tsx 行 37-49，需保留在 page.tsx 或移到 shared types）
- `PRICE_OPTIONS` 常數（目前在 page.tsx 行 62-71，需移動）
- `TYPE_LABELS` from `@/lib/ai`（或從 constants）
- `Clock` from lucide-react
- `Button` from `@/components/ui/Button`

### Step 1: 讀取完整程式碼

使用 Read tool 讀取 `src/app/dashboard/dispatcher/page.tsx` 行 37-49（ReviewItem interface）以及行 612-716（完整 review item JSX）。

### Step 2: 建立 `src/components/dispatcher/ReviewItemCard.tsx`

建立檔案：
- `'use client'` 標記
- import: `Button` from `@/components/ui/Button`, `Clock` from lucide-react
- 複製 PRICE_OPTIONS（從 page.tsx 行 62-71）
- `ReviewItemCardProps` interface：

```typescript
interface ReviewItemCardProps {
  item: {
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
    editedKenichi?: boolean
  }
  index: number
  editingId: string | null
  editForm: {
    scheduledTime?: string
    price?: number
    pickupLocation?: string
    dropoffLocation?: string
  }
  onEdit: (item: ReviewItemCardProps['item']) => void
  onSave: (reviewId: string) => void
  onCancel: () => void
  onDelete: (reviewId: string) => void
  onEditFormChange: (form: ReviewItemCardProps['editForm']) => void
}
```

- 完整的 `ReviewItemCard` 函式
- 編輯模式時：顯示時間/費用/上車地點/下地點表單
- 顯示模式時：顯示 badge 區、金額、路線、原始文字

**重要**：
- 所有 `item.xxx` 存取需對應到 item 的實際欄位
- `item.type` 的 badge 樣式（接機/送機等）使用 `TYPE_LABELS` 或內聯 logic
- 刪除按鈕呼叫 `onDelete(item.reviewId)`

### Step 3: 修改 `src/app/dashboard/dispatcher/page.tsx`

- 刪除行 62-71 的 PRICE_OPTIONS（已移到 ReviewItemCard）
- 在頂部 import 區塊加入：
  ```typescript
  import { ReviewItemCard } from '@/components/dispatcher/ReviewItemCard'
  ```
- 找到行 613-716 的 review items map loop（`{reviewItems.map((item, idx) => (` 開始），替換為：
  ```tsx
  {reviewItems.map((item, idx) => (
    <ReviewItemCard
      key={item.reviewId}
      item={item}
      index={idx}
      editingId={editingId}
      editForm={editForm}
      onEdit={handleEditItem}
      onSave={handleSaveEdit}
      onCancel={() => setEditingId(null)}
      onDelete={handleDeleteItem}
      onEditFormChange={setEditForm}
    />
  ))}
  ```
- 刪除原本的 map loop JSX（行 614-716）
- 移除不再需要的 `Clock` import（確認是否只用在 review tab）

### Step 4: Build 驗證

```bash
npm run build
```
預期：編譯成功，ReviewItemCard 元件獨立運作。

### Step 5: Commit

```bash
git add src/components/dispatcher/ReviewItemCard.tsx src/app/dashboard/dispatcher/page.tsx
git commit -m "refactor: 抽出 ReviewItemCard 元件，簡化 dispatcher/page.tsx"
```

---

## Task 3: 抽出 `SYSTEM_PROMPT` 至獨立檔案

### Context

`src/lib/ai.ts` 行 341-441 是約 101 行的 SYSTEM_PROMPT template literal。將其抽出為 `src/lib/prompts/order-parsing.ts`，ai.ts import 該檔案。

### Step 1: 讀取完整程式碼

使用 Read tool 讀取 `src/lib/ai.ts` 行 339-445（SYSTEM_PROMPT 定義 + LLMParseResult interface + parseBatchOrdersLLM 函式開頭）。

### Step 2: 建立 `src/lib/prompts/order-parsing.ts`

建立 `src/lib/prompts/` 目錄（如果不存在），建立 `order-parsing.ts`：

```typescript
// AI Order Parsing System Prompt

const SYSTEM_PROMPT = `你是台灣機場接送平台的訂單解析專家。負責將 LINE 群組的訂單訊息解析成結構化 JSON。

## 輸出格式
...（完整內容從 ai.ts 行 341-441 複製）
`.replace('{DEFAULT_DATE}', new Date().toISOString().split('T')[0])

export { SYSTEM_PROMPT }
```

**重要**：
- 保留 `.replace('{DEFAULT_DATE}', ...)` 的 runtime replace 邏輯（因為日期是動態的）
- 這是一個純資料檔，無 React dependency

### Step 3: 修改 `src/lib/ai.ts`

- 刪除行 341-441 的 SYSTEM_PROMPT 定義
- 在頂部（其他 imports 之後）加入：
  ```typescript
  import { SYSTEM_PROMPT } from './prompts/order-parsing'
  ```
- 確認 ai.ts 中其他使用 SYSTEM_PROMPT 的地方（LlmParseResult 和 parseBatchOrdersLLM）仍然正常運作

### Step 4: Build 驗證

```bash
npm run build
```
預期：編譯成功，SYSTEM_PROMPT 從獨立檔案載入。

### Step 5: Commit

```bash
git add src/lib/prompts/order-parsing.ts src/lib/ai.ts
git commit -m "refactor: 抽出 SYSTEM_PROMPT 至獨立檔案，分離 prompt 內容與解析邏輯"
```

---

## Task 4: 移除 `ai.ts` 重複的類型定義

### Context

`src/lib/ai.ts` 行 8-38 定義了 `OrderType`、`VehicleType`、`PlateType`、`BatchOrderDefaults`，這些與 `src/types/index.ts` 行 40-38 完全重複。刪除重複定義，改為從 `src/types/index.ts` import。

### Dependencies

此任務需確保 `src/types/index.ts` 已有：
- `OrderType` export（行 40）✅
- `VehicleType` export（行 41）✅
- `PlateType` export（行 42）✅

### Step 1: 分析差異

使用 Read tool 比對：
- `src/lib/ai.ts` 行 8-38 vs
- `src/types/index.ts` 行 40-42

確認：
- `OrderType`: 完全相同
- `VehicleType`: ai.ts 多了 `'any_r'`（types/index.ts 行 41 已有 `any_r`）
- `PlateType`: 完全相同
- `BatchOrderDefaults`: ai.ts 獨有（行 30-38），這不是 types/index.ts 的類型，應保留

### Step 2: 修改 `src/lib/ai.ts`

- 刪除行 8-10 的 `OrderType`、`VehicleType`、`PlateType` export
- 在頂部（第一個 import 之後）加入：
  ```typescript
  import type { OrderType, VehicleType, PlateType } from '@/types'
  ```
- `BatchOrderDefaults` interface（行 30-38）保留不動（這是 parsing 專用的 defaults 結構）
- `ParseStatus`、`ParsedOrder` 保留不動（parsing 專用）
- 確認其他用到 `OrderType`、`VehicleType`、`PlateType` 的地方仍然正常（如 `ParsedOrder.vehicle: VehicleType` 等）

### Step 3: Build 驗證

```bash
npm run build
```
預期：編譯成功，所有類型從 types/index.ts 統一輸出。

### Step 4: Commit

```bash
git add src/lib/ai.ts
git commit -m "refactor: ai.ts 移除重複類型定義，改由 types/index.ts import"
```

---

## Task 5: 標記 legacy code 為 deprecated

### Context

`src/lib/ai.ts` 行 554-624 的 `LegacyParsedOrder` 和 `parseOrderText` 標記為 legacy。`Grep` 搜尋顯示這兩個 symbol 沒有其他檔案引用。

### Step 1: 確認無其他引用

使用 Grep tool 搜尋 `LegacyParsedOrder` 和 `parseOrderText` 在整個 src/ 目錄的引用：

```bash
grep -rn "LegacyParsedOrder\|parseOrderText" src/
```
預期：只有 ai.ts 自身定義，無其他引用。

### Step 2: 加入 @deprecated JSDoc

使用 Edit tool，在 `LegacyParsedOrder` interface 定義上方（行 554）加入：

```typescript
/**
 * @deprecated 舊版解析邏輯，已被 parseBatchOrders / parseBatchOrdersLLM 取代，預計下個 major version 移除
 */
export interface LegacyParsedOrder {
```

在 `parseOrderText` 函式定義上方（行 573）加入：

```typescript
/**
 * @deprecated 舊版單行解析，已被 parseBatchOrders / parseBatchOrdersLLM 取代，預計下個 major version 移除
 */
export function parseOrderText(rawText: string): LegacyParsedOrder {
```

### Step 3: Commit

```bash
git add src/lib/ai.ts
git commit -m "docs: 標記 LegacyParsedOrder 與 parseOrderText 為 deprecated"
```

---

## 驗收標準

- [ ] `npm run build` 全程無錯誤
- [ ] `src/components/dispatcher/CreateDefaultsCard.tsx` 獨立元件存在，日期/車型/肯驛功能正常
- [ ] `src/components/dispatcher/ReviewItemCard.tsx` 獨立元件存在，內嵌編輯正常
- [ ] `src/lib/prompts/order-parsing.ts` 存在，SYSTEM_PROMPT 正確載入
- [ ] `src/lib/ai.ts` 中無重複的 OrderType/VehicleType/PlateType 定義
- [ ] `LegacyParsedOrder` 和 `parseOrderText` 有 @deprecated 標記
- [ ] `dispatcher/page.tsx` 明顯變短（預期減少約 200 行）
- [ ] 所有舊功能仍正常運作（建立訂單流程、審核流程、AI 解析）
