# 程式碼基底 Phase 1 重構計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 整理重複常數、抽出 SettlementTab 元件、統一類型定義、拆分 auth route 為 HTTP 動詞分檔

**Architecture:** 將 `src/lib/ai.ts` 中已 export 的顯示用常數集中到 `src/lib/constants.ts`，並新增缺少的常數（STATUS_LABELS、STATUS_TAG_STYLE、TYPE_TAG_STYLE），再在所有消費端移除重複定義。同時將 driver/page.tsx 中龐大的 balance tab 邏輯抽出為獨立元件，最後將 auth route 依 HTTP 動詞分檔。

**Tech Stack:** TypeScript, Next.js 14 App Router, React

---

## 檔案結構變更

| 動作 | 檔案 | 職責 |
|------|------|------|
| 建立 | `src/lib/constants.ts` | 統一的 UI 常數（LABELS、COLORS、STYLE） |
| 修改 | `src/lib/ai.ts` | 移除已遷移的常數（VEHICLE_LABELS、TYPE_LABELS、PLATETYPE_LABELS），改由 constants.ts re-export |
| 修改 | `src/components/dispatcher/OrderCard.tsx` | import constants 取代內聯定義 |
| 修改 | `src/components/driver/OrderCard.tsx` | import constants 取代內聯定義 |
| 修改 | `src/app/dashboard/driver/order/[id]/page.tsx` | import constants 取代內聯定義 |
| 修改 | `src/app/dashboard/driver/page.tsx` | import constants + 抽出 SettlementTab 元件 |
| 建立 | `src/components/driver/SettlementTab.tsx` | 從 driver/page.tsx balance tab 抽出的獨立元件 |
| 修改 | `src/app/api/auth/[[...nextauth]]/route.ts` | 拆分為 POST (login) + 保留 GET (session/NextAuth) |
| 修改 | `src/app/api/auth/register/route.ts` | 確認已是獨立檔案 |
| 建立 | `src/app/api/auth/login/route.ts` | 從 auth route 抽出 login 邏輯 |

---

## Task 1: 建立 `src/lib/constants.ts` 並重構所有消費端

### Step 1: 建立 `src/lib/constants.ts`

```typescript
// UI Display Constants — 統一全站種類/車型/狀態顯示用常數

import type { OrderType, VehicleType, PlateType, OrderStatus } from '@/types'

// ============ 種類標籤 ============
export const TYPE_LABELS: Record<OrderType, string> = {
  pickup: '接機',
  dropoff: '送機',
  pickup_boat: '接船',
  dropoff_boat: '送船',
  transfer: '接駁',
  charter: '包車',
  pending: '待確認',
}

// ============ 車型標籤 ============
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  small: '小車',
  suv: '休旅車',
  van9: '9人座',
  any: '任意車型',
  any_r: '任意R牌',
  pending: '待確認',
}

// ============ 車牌標籤 ============
export const PLATETYPE_LABELS: Record<PlateType, string> = {
  R: 'R牌',
  T: 'T牌',
  any: '任意',
}

// ============ 種類標籤樣式（背景+文字色） ============
export const TYPE_COLORS: Record<OrderType, { bg: string; text: string }> = {
  pickup:       { bg: '#E6F1FB', text: '#0C447C' },
  dropoff:      { bg: '#FFF3E0', text: '#92400E' },
  pickup_boat:  { bg: '#E0F7FA', text: '#006064' },
  dropoff_boat: { bg: '#E0F7FA', text: '#006064' },
  transfer:     { bg: '#F4EFE9', text: '#717171' },
  charter:      { bg: '#F3E8FF', text: '#6B21A8' },
  pending:      { bg: '#F4EFE9', text: '#717171' },
}

// ============ 種類 Badge 樣式（字串 key，用於 type 可能為 string 的場景） ============
export const TYPE_TAG_STYLE: Record<string, string> = {
  pickup:       'bg-[#E6F1FB] text-[#0C447C]',
  dropoff:      'bg-[#FFF3E0] text-[#92400E]',
  pickup_boat:  'bg-[#E0F7FA] text-[#006064]',
  dropoff_boat: 'bg-[#E0F7FA] text-[#006064]',
  transfer:     'bg-[#F4EFE9] text-[#717171]',
  charter:      'bg-[#F3E8FF] text-[#6B21A8]',
  pending:      'bg-[#F4EFE9] text-[#717171]',
}

// ============ 狀態標籤 ============
export const STATUS_LABELS: Record<string, string> = {
  PENDING:    '待接單',
  PUBLISHED:  '待接單',
  ASSIGNED:   '已指派',
  ACCEPTED:   '已接單',
  IN_PROGRESS: '進行中',
  ARRIVED:    '已抵達',
  PICKED_UP:  '乘客已上車',
  COMPLETED:  '已完成',
  CANCELLED:  '已取消',
}

// ============ 狀態 Badge 樣式 ============
export const STATUS_TAG_STYLE: Record<string, string> = {
  PENDING:    'bg-[#FCEBEB] text-[#A32D2D]',
  PUBLISHED:  'bg-[#FCEBEB] text-[#A32D2D]',
  ASSIGNED:   'bg-[#FFF3E0] text-[#B45309]',
  ACCEPTED:   'bg-[#FFF3E0] text-[#B45309]',
  IN_PROGRESS: 'bg-[#E6F1FB] text-[#0C447C]',
  ARRIVED:    'bg-[#E6F1FB] text-[#0C447C]',
  PICKED_UP:  'bg-[#E6F1FB] text-[#0C447C]',
  COMPLETED:  'bg-[#E8F5E8] text-[#008A05]',
  CANCELLED:  'bg-[#FCEBEB] text-[#A32D2D]',
}
```

### Step 2: 修改 `src/lib/ai.ts` — 移除已遷移的常數，改為 re-export

在 `ai.ts` 的結尾（`PLATETYPE_LABELS` 之後），刪除 `VEHICLE_LABELS`、`TYPE_LABELS`、`PLATETYPE_LABELS` 的定義，改為：

```typescript
// Re-export from constants.ts for backward compatibility
export { VEHICLE_LABELS, TYPE_LABELS, PLATETYPE_LABELS } from './constants'
```

### Step 3: 修改 `src/components/dispatcher/OrderCard.tsx`

- 刪除第 52-84 行的 `TYPE_TAG_STYLE`、`STATUS_TAG_STYLE`、`TYPE_LABELS`、`STATUS_LABELS`、`VEHICLE_LABELS` 內聯定義
- 在 import 區塊頂部加入：
  ```typescript
  import { TYPE_TAG_STYLE, STATUS_TAG_STYLE, TYPE_LABELS, STATUS_LABELS, VEHICLE_LABELS } from '@/lib/constants'
  ```
- 第 113 行 `const typeTagStyle = TYPE_TAG_STYLE[order.type || ''] || 'bg-[#F4EFE9] text-[#717171]'` 保持不變（string key 的 STYLE map 可正常運作）

### Step 4: 修改 `src/components/driver/OrderCard.tsx`

- 刪除第 15-52 行的 `TYPE_COLORS`、`VEHICLE_LABELS`、`TYPE_LABELS` 內聯定義
- 在 import 區塊頂部加入：
  ```typescript
  import { TYPE_COLORS, VEHICLE_LABELS, TYPE_LABELS } from '@/lib/constants'
  ```
- `TYPE_LABELS` 和 `VEHICLE_LABELS` 直接替換；`TYPE_COLORS` 直接替換

### Step 5: 修改 `src/app/dashboard/driver/order/[id]/page.tsx`

- 刪除第 14-31 行的 `TYPE_LABELS`、`TYPE_COLORS`、`VEHICLE_LABELS` 內聯定義
- 在頂部 import 區塊加入：
  ```typescript
  import { TYPE_LABELS, TYPE_COLORS, VEHICLE_LABELS } from '@/lib/constants'
  ```
- 第 174 行 `const typeColor = TYPE_COLORS[order.type] ?? ...` 直接使用
- 第 175 行 `const orderTypeLabel = TYPE_LABELS[order.type] ?? ...` 直接使用
- 第 224 行 `VEHICLE_LABELS[order.vehicle] ?? ...` 直接使用

### Step 6: Build 驗證

```bash
npm run build
```
預期：編譯成功，所有常數從 constants.ts 統一輸出，消費端無重複定義。

### Step 7: Commit

```bash
git add src/lib/constants.ts src/lib/ai.ts src/components/dispatcher/OrderCard.tsx src/components/driver/OrderCard.tsx src/app/dashboard/driver/order/[id]/page.tsx
git commit -m "refactor: 建立 src/lib/constants.ts 統一 UI 常數，移除各處重複定義"
```

---

## Task 2: 抽出 `SettlementTab` 元件

### Context

`src/app/dashboard/driver/page.tsx` 的 balance tab（約 200+ 行）包含：收益統計卡片、已完成行程列表（含 SSE 即時同步）、篩選/排序邏輯。將其抽出為 `src/components/driver/SettlementTab.tsx`，簡化主 page 元件。

### Step 1: 建立 `src/components/driver/SettlementTab.tsx`

完整抽出 balance tab 的 JSX + 相關 state/hooks：

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, TrendingUp, Calendar, ChevronDown, ChevronUp, Clock, CheckCircle } from 'lucide-react'
import { format, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { formatOrderNo } from '@/lib/utils'
import { VEHICLE_LABELS } from '@/lib/constants'

interface CompletedOrder {
  id: string
  completedAt: string
  pickupLocation: string
  dropoffLocation: string
  price: number
  dispatcher: { companyName: string }
  transferStatus?: string
}

interface SettlementTabProps {
  token: string | null
  userId?: string
}

export function SettlementTab({ token, userId }: SettlementTabProps) {
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([])
  const [stats, setStats] = useState({ today: 0, week: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  // ... fetch logic + SSE handler (from current balance tab)
  // Keep the same implementation from driver/page.tsx balance tab

  return (
    <div className="space-y-4">
      {/* 收益統計卡片 */}
      {/* 已完成行程列表 */}
      {/* ... same JSX structure */}
    </div>
  )
}
```

### Step 2: 修改 `src/app/dashboard/driver/page.tsx`

- 刪除 balance tab 的所有 state 和 JSX
- 在頂部加入：
  ```typescript
  import { SettlementTab } from '@/components/driver/SettlementTab'
  ```
- 找到 balance tab JSX 的位置（`{activeTab === 'balance' && (`），替換為：
  ```tsx
  {activeTab === 'balance' && <SettlementTab token={token} userId={user?.id} />}
  ```
- 刪除以下已遷移到 SettlementTab 的 import（按需要）：
  - `format, parseISO, startOfDay, startOfWeek` from date-fns（如果 balance tab 是唯一使用處）
  - `TrendingUp, Calendar` from lucide-react
  - `formatOrderNo` from `@/lib/utils`（如果只用在 balance tab）

### Step 3: Build 驗證

```bash
npm run build
```
預期：編譯成功，SettlementTab 元件獨立運作。

### Step 4: Commit

```bash
git add src/components/driver/SettlementTab.tsx src/app/dashboard/driver/page.tsx
git commit -m "refactor: 抽出 SettlementTab 元件，簡化 driver/page.tsx"
```

---

## Task 3: 統一 `Order` 介面定義

### Context

`Order` 類型在 `src/types/index.ts`、`src/components/driver/OrderCard.tsx`、`src/app/dashboard/driver/order/[id]/page.tsx` 中各有定義，且 dispatcher/OrderCard.tsx 和 driver/order/[id]/page.tsx 各自定義了自己的 `OrderDetail` 介面（非常類似）。建議：讓 `src/types/index.ts` 的 `Order` 為完整定義，各消費端直接使用。

### Step 1: 分析差異

- `types/index.ts` 的 `Order`: 最完整，包含 `completedAt` 和 `kenichiRequired`
- `driver/OrderCard.tsx` 的 `Order`: 使用 `type { Order } from '@/types'`（已引用）
- `driver/order/[id]/page.tsx` 的 `OrderDetail`: 比 `Order` 少了 `completedAt` 和 `kenichiRequired`；多了 `startedAt`、`arrivedAt`、`pickedUpAt`（這些已在 `Order` 的 timestamps 中）
- `dispatcher/OrderCard.tsx` 的 `DispatcherOrder`: 比 `Order` 少了 `orderDate` 和 `completedAt`

### Step 2: 擴充 `src/types/index.ts` 的 `Order` 介面

確保 `Order` 包含所有 timestamps：

```typescript
export interface Order {
  id: string
  orderDate: string
  orderSeq: number
  dispatcherId: string
  driverId?: string
  status: OrderStatus
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  pickupLat?: number
  pickupLng?: number
  dropoffLocation: string
  dropoffAddress: string
  dropoffLat?: number
  dropoffLng?: number
  passengerCount: number
  luggageCount: number
  scheduledTime: Date | string
  price: number
  type: OrderType
  vehicle: VehicleType
  plateType: PlateType
  notes?: string
  note?: string
  rawText?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  startedAt?: Date
  arrivedAt?: Date
  pickedUpAt?: Date
  dispatcher?: Dispatcher
  driver?: Driver
  kenichiRequired?: boolean
  transferStatus?: string
}
```

### Step 3: 修改 `src/app/dashboard/driver/order/[id]/page.tsx`

- 刪除第 33-56 行的 `OrderDetail` 內聯介面定義
- 在頂部 import 加入 `import type { Order } from '@/types'`
- 將第 64 行 `const [order, setOrder] = useState<OrderDetail | null>(null)` 改為 `useState<Order | null>(null)`
- 其餘使用 `order.xxx` 的地方全部保持不變（因為 `OrderDetail` 和 `Order` 的欄位相同）

### Step 4: 修改 `src/components/dispatcher/OrderCard.tsx`

- 刪除第 10-44 行的 `DispatcherOrder` 內聯介面定義
- 在頂部 import 加入 `import type { Order } from '@/types'`
- 將 `DispatcherOrderCardProps` 的 order 型別從 `DispatcherOrder` 改為 `Order`
- 確認所有 `order.xxx` 存取都能通過 TypeScript 編譯

### Step 5: Build 驗證

```bash
npm run build
```
預期：編譯成功，Order 型別統一。

### Step 6: Commit

```bash
git add src/types/index.ts src/app/dashboard/driver/order/[id]/page.tsx src/components/dispatcher/OrderCard.tsx
git commit -m "refactor: 統一 Order 介面定義於 types/index.ts，移除各地內聯重複"
```

---

## Task 4: 拆分 auth route 為 HTTP 動詞分檔

### Context

`src/app/api/auth/[[...nextauth]]/route.ts` 目前包含 POST (login) 和 GET (session) 兩個 handler。將 login 抽出到 `src/app/api/auth/login/route.ts`，讓 `[[...nextauth]]/route.ts` 保持 NextAuth 原生用途。

### Step 1: 讀取 `src/app/api/auth/[[...nextauth]]/route.ts` 全文

使用 Read tool 確認完整的 login handler 邏輯（GET handler 是 NextAuth 預設的 session 端點，不改動）。

### Step 2: 建立 `src/app/api/auth/login/route.ts`

從 `[[...nextauth]]/route.ts` 中提取 POST handler，建立新檔案：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, setAuthCookie } from '@/lib/auth'

// POST /api/auth/login
export async function POST(request: NextRequest) {
  // ... 完整 login 邏輯（從現有檔案複製）
}
```

### Step 3: 修改 `src/app/api/auth/[[...nextauth]]/route.ts`

- 刪除 POST handler（login 邏輯），只保留 NextAuth 預設的 GET handler（或空檔案取決於 NextAuth 版本）
- 若此檔案只做 re-export，考慮刪除並讓 `src/app/api/auth/route.ts` 作為統一路由

### Step 4: Build 驗證

```bash
npm run build
```
預期：登入 API 仍正常運作，POST `/api/auth/login` 可用。

### Step 5: Commit

```bash
git add src/app/api/auth/login/route.ts src/app/api/auth/[[...nextauth]]/route.ts
git commit -m "refactor: 拆分 auth route，login 獨立至 /api/auth/login"
```

---

## 驗收標準

- [ ] `npm run build` 全程無錯誤
- [ ] `src/lib/constants.ts` 是唯一的常數來源（VEHICLE_LABELS、TYPE_LABELS 等）
- [ ] `src/lib/ai.ts` 中移除了重複的常數定義，改為 re-export
- [ ] `src/components/dispatcher/OrderCard.tsx`、`driver/OrderCard.tsx`、`driver/order/[id]/page.tsx` 無內聯常數定義
- [ ] `SettlementTab` 元件獨立，driver/page.tsx 減少約 200 行
- [ ] `Order` 型別統一在 `src/types/index.ts`
- [ ] auth login endpoint 改為 `/api/auth/login`
