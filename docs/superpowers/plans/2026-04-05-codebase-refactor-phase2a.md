# 程式碼基底 Phase 2A 重構計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復 `OrderCard` 編輯模式重複表單 bug、將派單方 SettlementTab 和司機端 SmartSchedulePanel 抽出為獨立元件

**Architecture:** 將 dashboard page 內嵌套函式抽出為獨立元件檔案，降低 page 的複雜度。`dispatcher/page.tsx` 和 `driver/page.tsx` 分別抽出各自的子元件。

**Tech Stack:** TypeScript, Next.js 14 App Router, React

---

## 檔案結構變更

| 動作 | 檔案 | 職責 |
|------|------|------|
| 建立 | `src/components/dispatcher/SettlementTab.tsx` | 派單方 SettlementTab，從 page 內嵌套函式抽出 |
| 建立 | `src/components/driver/SmartSchedulePanel.tsx` | 司機端智慧排班結果面板，從 page 抽出 |
| 修改 | `src/components/dispatcher/OrderCard.tsx` | 移除編輯模式下重複的表單區塊 |
| 修改 | `src/app/dashboard/dispatcher/page.tsx` | 移除內嵌 SettlementTab，改 import 獨立元件 |
| 修改 | `src/app/dashboard/driver/page.tsx` | 移除內嵌 SmartSchedulePanel，改 import 獨立元件 |

---

## Task 1: 修復 `OrderCard` 編輯模式重複表單 bug

### Context

`src/components/dispatcher/OrderCard.tsx` 在 `isEditing = true` 時，`時間/金額/人數/行李/備註` 欄位出現了兩次。原因：行 240-274 的編輯區塊正常渲染，行 276-328 是完全重複的內容。

### Step 1: 讀取檔案並確認問題

使用 Read tool 讀取 `src/components/dispatcher/OrderCard.tsx`，行 240-328 を確認。

### Step 2: 刪除重複區塊

使用 Edit tool，刪除行 276-328（`{/* Editable fields */}` 開始到 `}` 結尾的部分）：

找到 old_string 為：
```
      {/* Editable fields */}
      {isEditing && (
        <div className="space-y-2 mb-3">
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">時間</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={editForm.scheduledTime}
              onChange={e => setEditForm(f => ({ ...f, scheduledTime: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">金額</label>
              <input type="number" className={inputClass} value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">人數</label>
              <input type="number" className={inputClass} value={editForm.passengerCount} onChange={e => setEditForm(f => ({ ...f, passengerCount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">行李</label>
              <input type="number" className={inputClass} value={editForm.luggageCount} onChange={e => setEditForm(f => ({ ...f, luggageCount: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">備註</label>
            <input type="text" className={inputClass} value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="填寫備註" />
          </div>
        </div>
      )}
```

替換為空字串（完全刪除）。

### Step 3: Build 驗證

```bash
npm run build
```
預期：編譯成功，編輯模式下表單只出現一次。

### Step 4: Commit

```bash
git add src/components/dispatcher/OrderCard.tsx
git commit -m "fix: 移除 OrderCard 編輯模式下重複的表單欄位"
```

---

## Task 2: 抽出派單方 `SettlementTab` 元件

### Context

`src/app/dashboard/dispatcher/page.tsx` 行 108-365 包含一個名為 `SettlementTab` 的嵌套函式組件，約 257 行。它已經是獨立結構，只是巢嵌在 page 檔案內。將其抽出為 `src/components/dispatcher/SettlementTab.tsx`。

### Dependencies

此元件依賴：
- `Button` from `@/components/ui/Button`
- `useState`, `useCallback`, `useEffect` from React
- `format`, `parseISO` from `date-fns`
- `XLSX` from `xlsx`
- lucide-react icons: `ClipboardList`, `Download`, `Clock`, `TrendingUp`

### Step 1: 讀取完整程式碼

使用 Read tool 讀取 `src/app/dashboard/dispatcher/page.tsx` 行 1-110（import + SettlementData interface）以及行 108-365（SettlementTab 完整函式）。

### Step 2: 建立 `src/components/dispatcher/SettlementTab.tsx`

建立檔案，包含：
- `'use client'` 標記
- 所有必要的 import
- `SettlementData` interface（行 101-106 的定義）
- 完整的 `SettlementTab` 函式（行 108-365 的內容）

**重要**：SettlementTab prop 介面改為：
```typescript
interface SettlementTabProps {
  token: string | null
}
```

### Step 3: 修改 `src/app/dashboard/dispatcher/page.tsx`

- 刪除行 1-110 的 import 中屬於 SettlementTab 的部分（`parseISO`、`format`、`XLSX`、相關 lucide icons），但**保留**其他 import
- 刪除行 101-106 的 `SettlementData` interface
- 刪除行 108-365 的 `SettlementTab` 函式定義
- 在頂部加入 import：
  ```typescript
  import { SettlementTab } from '@/components/dispatcher/SettlementTab'
  ```
- 找到行 1023（`{activeTab === 'settlement' && (`），將內嵌的 `<SettlementTab token={token} />` 替換（應該已經是這樣，但如果原本是內嵌函式呼叫則需調整）

### Step 4: Build 驗證

```bash
npm run build
```
預期：編譯成功，SettlementTab 元件獨立運作。

### Step 5: Commit

```bash
git add src/components/dispatcher/SettlementTab.tsx src/app/dashboard/dispatcher/page.tsx
git commit -m "refactor: 抽出派單方 SettlementTab 元件，簡化 dispatcher/page.tsx"
```

---

## Task 3: 抽出司機端 `SmartSchedulePanel` 元件

### Context

`src/app/dashboard/driver/page.tsx` 行 749-1010 是智慧排班結果面板，約 261 行 JSX，包含觸發行程、時間軸預覽、銜接標籤說明、推薦清單（可點選加入）、總收入預估與確認按鈕。將其抽出為 `src/components/driver/SmartSchedulePanel.tsx`。

### Dependencies

此元件依賴：
- `useState` from React
- `format`, `parseISO` from `date-fns`
- `zhTW` from `date-fns/locale`
- lucide-react icons: `Sparkles`, `CheckCircle`, `AlertTriangle`, `XCircle`, `ChevronRight`
- `OrderCard` from `@/components/driver/OrderCard`

### Props Interface

```typescript
interface SmartSchedulePanelProps {
  scheduleResult: {
    currentOrders: Array<{ id: string; scheduledTime: string; type: string; status: string; pickupLocation: string; dropoffLocation: string; price: number }>
    currentOrder: { id: string; scheduledTime: string; type: string; pickupLocation: string; dropoffLocation: string; price: number } | null
    availableCount: number
    recommendations: Array<{
      id: string; orderDate: string; orderSeq: number
      type: string; vehicle: string; scheduledTime: string; price: number
      pickupLocation: string; dropoffLocation: string; passengerName: string
      passengerCount: number; luggageCount: number; flightNumber: string
      kenichiRequired: boolean; reason: string
      tightnessLabel: string; tightnessLevel: string
      recommendType: 'pickup' | 'dropoff'
    }>
    timeline: Array<{ time: string; label: string; orderId?: string; price?: number; isTrigger?: boolean }>
    totalIncome: number
  } | null
  filteredScheduleRecs: {
    recs: Array<{ id: string; orderDate: string; orderSeq: number; type: string; vehicle: string; scheduledTime: string; price: number; pickupLocation: string; dropoffLocation: string; passengerName: string; passengerCount: number; luggageCount: number; flightNumber: string; kenichiRequired: boolean; reason: string; tightnessLabel: string; tightnessLevel: string; recommendType: 'pickup' | 'dropoff' }>
    label: string
    sortHint: string
  }
  selectedScheduleOrders: string[]
  onToggleOrder: (orderId: string) => void
  onConfirmSchedule: () => void
  onClear: () => void
  scheduleConfirming: boolean
}
```

### Step 1: 讀取完整程式碼

使用 Read tool 讀取 `src/app/dashboard/driver/page.tsx` 行 740-1015。

### Step 2: 建立 `src/components/driver/SmartSchedulePanel.tsx`

建立檔案：
- `'use client'` 標記
- 必要的 import
- `SmartSchedulePanelProps` interface
- 完整的 `SmartSchedulePanel` 函式

**重要**：把原本在 page.tsx 中的 handler callbacks（`handleConfirmSchedule`、`toggleScheduleOrder` 等）改為透過 props 傳入，SmartSchedulePanel 只負責 UI 渲染。

### Step 3: 修改 `src/app/dashboard/driver/page.tsx`

- 加入 import：`import { SmartSchedulePanel } from '@/components/driver/SmartSchedulePanel'`
- 找到行 749-1010 的智慧排班結果面板 JSX，替換為：
  ```tsx
  <SmartSchedulePanel
    scheduleResult={scheduleResult}
    filteredScheduleRecs={filteredScheduleRecs}
    selectedScheduleOrders={selectedScheduleOrders}
    onToggleOrder={toggleScheduleOrder}
    onConfirmSchedule={handleConfirmSchedule}
    onClear={() => { setScheduleResult(null); setMatchResults(null); setSelectedScheduleOrders([]) }}
    scheduleConfirming={scheduleConfirming}
  />
  ```
- 刪除原本的行 749-1010 的 JSX
- **注意**：`filteredScheduleRecs` 和 `selectedScheduleOrders` 仍在 page 中定義（作為 state 和 computed value），這些保持不動

### Step 4: Build 驗證

```bash
npm run build
```
預期：編譯成功，智慧排班面板正常運作。

### Step 5: Commit

```bash
git add src/components/driver/SmartSchedulePanel.tsx src/app/dashboard/driver/page.tsx
git commit -m "refactor: 抽出 SmartSchedulePanel 元件，簡化 driver/page.tsx"
```

---

## 驗收標準

- [ ] `npm run build` 全程無錯誤
- [ ] `dispatcher/OrderCard.tsx` 編輯模式下表單只出現一次
- [ ] `dispatcher/SettlementTab.tsx` 獨立元件存在並正常運作
- [ ] `driver/SmartSchedulePanel.tsx` 獨立元件存在並正常運作
- [ ] `driver/page.tsx` 和 `dispatcher/page.tsx` 明顯變短
- [ ] 智慧排班功能仍正常運作（可選擇推薦訂單並確認）
- [ ] 派單方帳務中心仍正常運作（查詢、下載 Excel、切換轉帳狀態）
