# 司機端原型 UI 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 gogmo 司機端原型設計整合進機場接送平台的 driver dashboard，實作 4-Step 行程進度追蹤、強化訊息中心、重新設計帳務頁面。

**Architecture:**
- 在現有 driver dashboard 架構上整合新元件，不破壞現有功能
- 4-Step 行程進度追蹤（開始→抵達→客上→客下）整合進現有 order detail 流程
- 訊息中心新增未讀計數和已讀/未讀狀態管理
- 帳務中心重設為卡片區塊化統計 + 行程記錄/點數記錄切換
- 支援亮色/暗色模式，切換現有 dark mode 机制

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, lucide-react icons

---

## Task 1: 設計 Tokens 對應表

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 讀取現有 globals.css 的 CSS 變數**

```bash
cat src/app/globals.css | head -60
```

- [ ] **Step 2: 新增原型專用額外 tokens**

在 globals.css 末尾新增（亮色模式）：

```css
/* gogmo driver prototype design tokens */
:root {
  --gogmo-red: #FF385C;
  --gogmo-navy: #0C447C;
  --gogmo-gold: #E8A855;
  --gogmo-green: #008A05;
  --gogmo-amber: #B45309;
  --gogmo-pickup-bg: rgba(42, 111, 175, 0.1);
  --gogmo-pickup-text: #2A6FAF;
  --gogmo-pickup-btn: #2A6FAF;
  --gogmo-dropoff-bg: rgba(196, 122, 43, 0.1);
  --gogmo-dropoff-text: #C47A2B;
  --gogmo-dropoff-btn: #C47A2B;
  --gogmo-charter-bg: rgba(109, 61, 184, 0.1);
  --gogmo-charter-text: #6D3DB8;
  --gogmo-charter-btn: #6D3DB8;
}
```

暗色模式 tokens 透過 `.dark` class 覆寫：

```css
.dark {
  --gogmo-bg: #0F0D0B;
  --gogmo-card: #1C1916;
  --gogmo-border: #2E2923;
  --gogmo-text: #F0EBE4;
  --gogmo-sub: #C0B8B0;
  --gogmo-gray: #8A8078;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(driver): 新增 gogmo 原型設計 tokens"
```

---

## Task 2: 4-Step 行程進度追蹤元件

**Files:**
- Create: `src/components/driver/TripProgressTracker.tsx`

- [ ] **Step 1: 建立 TripProgressTracker 元件**

```typescript
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Icon } from '@/lib/icons'

const TRIP_STEPS = [
  { key: 'start',   label: '開始',  desc: '出發前往上車地點', color: '#2A6FAF' },
  { key: 'arrive',  label: '抵達',  desc: '已抵達上車地點',   color: '#B45309' },
  { key: 'onboard', label: '客上',  desc: '乘客已上車',        color: '#FF385C' },
  { key: 'done',    label: '客下',  desc: '乘客已下车，完成', color: '#008A05' },
]

interface TripProgressTrackerProps {
  currentStep: number // -1=未開始, 0=start完成, 1=arrive完成, 2=onboard完成, 3=done
  onAdvance: () => void
  completed: boolean
}

/**
 * 4-Step 行程進度追蹤：
 * 開始 → 抵達 → 客上 → 客下
 * 每步完成後可點擊「下一步」按鈕前進
 */
export function TripProgressTracker({ currentStep, onAdvance, completed }: TripProgressTrackerProps) {
  const nextStep = TRIP_STEPS[currentStep + 1]

  return (
    <div className="bg-white rounded-2xl p-4 mb-4 border border-[#E5E5E5] dark:bg-[#1C1916] dark:border-[#2E2923]">
      {/* Step dots */}
      <div className="flex items-center mb-4">
        {TRIP_STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200"
                style={{
                  background: i <= currentStep ? s.color : 'var(--gogmo-beige, #F4EFE9)',
                  boxShadow: i === currentStep + 1 ? `0 0 0 3px ${s.color}33` : 'none',
                }}
              >
                {i <= currentStep ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-[#aaa]">{i + 1}</span>
                )}
              </div>
              <span
                className="text-[10px] font-bold text-center leading-tight whitespace-nowrap"
                style={{ color: i <= currentStep ? s.color : 'var(--gogmo-gray, #717171)' }}
              >
                {s.label}
              </span>
            </div>
            {i < TRIP_STEPS.length - 1 && (
              <div
                className="flex-1 h-0.5 max-w-7 mx-0.5 rounded-sm transition-all duration-300"
                style={{ background: i < currentStep ? TRIP_STEPS[i].color : 'var(--gogmo-beige, #F4EFE9)' }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Action button */}
      {!completed ? (
        <button
          onClick={onAdvance}
          className="w-full py-4 rounded-xl text-white text-base font-bold transition-all duration-200 shadow-md"
          style={{
            background: nextStep?.color || '#008A05',
            boxShadow: `0 4px 16px ${(nextStep?.color || '#008A05')}44`,
          }}
        >
          {nextStep ? `${nextStep.label}　${nextStep.desc}` : '確認完成'}
        </button>
      ) : (
        <div className="text-center py-3 bg-[#E8F5E8] rounded-xl text-[#008A05] text-[15px] font-bold">
          ✓ 行程完成
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/driver/TripProgressTracker.tsx
git commit -m "feat(driver): 新增 4-Step 行程進度追蹤元件"
```

---

## Task 3: 更新 OrderCard FULL Mode 整合 TripProgressTracker

**Files:**
- Modify: `src/components/driver/OrderCard.tsx:150-300` (approximately)

- [ ] **Step 1: 讀取 OrderCard full mode 實作**

找到 full mode（compact=false）的 JSX return 區塊，確認狀態按鈕邏輯位置。

- [ ] **Step 2: 在 ACCEPTED 狀態的按鈕區塊新增「執行行程」邏輯**

在 `showActions && status === 'ACCEPTED'` 區塊中，当前行有「執行行程」按鈕。點擊後開啟 TripProgressTracker。

新增 state：
```typescript
const [showTripTracker, setShowTripTracker] = useState(false)
const [tripStep, setTripStep] = useState(-1)
```

在「執行行程」按鈕的 onClick：
```typescript
onClick={() => setShowTripTracker(true)}
```

在卡片內（條件渲染）：
```typescript
{showTripTracker && (
  <TripProgressTracker
    currentStep={tripStep}
    onAdvance={() => setTripStep(s => s + 1)}
    completed={tripStep >= 3}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/driver/OrderCard.tsx
git commit -m "feat(driver): OrderCard 整合 4-Step 行程進度追蹤"
```

---

## Task 4: 訊息中心增強（未讀計數 + 已讀管理）

**Files:**
- Modify: `src/app/dashboard/driver/page.tsx` (messages tab section)

- [ ] **Step 1: 找到 messages tab 的 JSX 實作位置**

在 driver/page.tsx 中搜尋「訊息中心」或「messages」tab 的渲染邏輯。

- [ ] **Step 2: 新增未讀計數 Badge**

在 tab bar 的 messages icon 旁邊新增紅色未讀計數 Badge：
```tsx
{activeTab === 'messages' && (
  <div className="absolute -top-1 -right-2 bg-[#FF385C] text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
    {unreadCount}
  </div>
)}
```

- [ ] **Step 3: 新增「全部已讀」按鈕**

在訊息列表頂部，當 unreadCount > 0 時顯示「全部已讀」按鈕：
```tsx
{unreadCount > 0 && (
  <button
    onClick={() => setMessages(p => p.map(m => ({ ...m, unread: false })))}
    className="text-[#FF385C] text-xs font-bold border border-[#FF385C] rounded-full px-3 py-1.5"
  >
    全部已讀
  </button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/driver/page.tsx
git commit -m "feat(driver): 訊息中心新增未讀計數與已讀管理"
```

---

## Task 5: 帳務中心重設（卡片區塊化統計）

**Files:**
- Modify: `src/components/driver/SettlementTab.tsx`

- [ ] **Step 1: 讀取 SettlementTab 實作**

確認現有結構，找到 `return` 區塊頂部的統計卡片渲染位置。

- [ ] **Step 2: 重設統計卡片為雙欄佈局**

現有多是單欄統計。根據原型，改為左右雙欄：
- 左：「今日收入」+ 金額 + 完成趟數
- 右：「帳戶餘額」+ 金額 + 點數連結

使用 `grid grid-cols-2 gap-3` 佈局，每個統計卡使用：
```tsx
<div className="bg-white border border-[#E5E5E5] rounded-xl p-3.5 dark:bg-[#1C1916] dark:border-[#2E2923]">
  <div className="text-[11px] text-[#717171] mb-1.5">今日收入</div>
  <div className="font-mono-nums text-[26px] font-black text-[#FF385C] leading-none mb-1.5">
    ${todayIncome.toLocaleString()}
  </div>
  <div className="text-[11px] text-[#717171]">{todayCount} 趟完成</div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/driver/SettlementTab.tsx
git commit -m "feat(driver): 帳務中心改為雙欄統計卡片"
```

---

## Task 6: 司機資訊卡抬頭（行照 + 上線狀態）

**Files:**
- Modify: `src/components/driver/SettlementTab.tsx` 或 `src/app/dashboard/driver/page.tsx`

- [ ] **Step 1: 在帳務頁頂部新增司機資訊卡**

根據原型，在統計卡片上方新增一行司機資訊卡：
```tsx
<div className="flex items-center gap-3 bg-white border border-[#E5E5E5] rounded-xl p-3 mb-3 dark:bg-[#1C1916] dark:border-[#2E2923]">
  <div className="w-11 h-11 rounded-xl bg-[#FF385C] text-white flex items-center justify-center text-lg font-black flex-shrink-0">
    {driverName?.charAt(0) || '司'}
  </div>
  <div className="flex-1">
    <div className="text-[15px] font-black text-[#222222] dark:text-[#F0EBE4]">{driverName}</div>
    <div className="text-[12px] text-[#717171] mt-0.5">{vehicleInfo}</div>
  </div>
  <div className="flex items-center gap-1.5 bg-[#F0FDF4] rounded-full px-3 py-1.5">
    <div className="w-1.5 h-1.5 rounded-full bg-[#008A05]" />
    <span className="text-[12px] font-bold text-[#008A05]">上線</span>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/driver/SettlementTab.tsx
git commit -m "feat(driver): 帳務頁新增司機資訊卡抬頭"
```

---

## Task 7: 行程卡片（Schedule）增強 — 狀態顏色優化

**Files:**
- Modify: `src/components/driver/OrderCard.tsx` (compact mode)

- [ ] **Step 1: 讀取 compact mode 的狀態 badge 實作**

確認 STATUS_C 或 OrderStatusBadge 的使用方式。

- [ ] **Step 2: 根據原型調整狀態色彩**

原型使用：
```typescript
const STATUS_C = {
  COMPLETED:  { bg: '#E8F5E8', text: T.green },   // 綠色
  IN_PROGRESS: { bg: '#FFF3E0', text: T.amber },  // 琥珀色
  ACCEPTED:   { bg: '#E8F0FA', text: '#0C447C' },  // 深藍色
}
```

在 compact mode 中，依 order.status 渲染對應的背景/文字色彩。

- [ ] **Step 3: Commit**

```bash
git add src/components/driver/OrderCard.tsx
git commit -m "feat(driver): 行程卡片狀態色彩優化"
```

---

## Task 8: Profile 頁文件到期顯示增強

**Files:**
- Modify: `src/components/driver/ProfileTab.tsx`

- [ ] **Step 1: 讀取文件管理區塊實作**

找到文件狀態的渲染邏輯。

- [ ] **Step 2: 新增「即將到期」警示狀態**

根據原型，當文件接近到期（如 30 天內），顯示琥珀色預警：
```tsx
const getDocStatus = (expiryDate: string) => {
  const daysUntil = differenceInDays(parseISO(expiryDate), new Date())
  if (daysUntil <= 30) return { label: '即將到期', bg: '#FFF3E0', text: '#B45309' }
  return { label: '正常', bg: '#E8F5E8', text: '#008A05' }
}
```

在文件列表每列右側渲染狀態 badge。

- [ ] **Step 3: Commit**

```bash
git add src/components/driver/ProfileTab.tsx
git commit -m "feat(driver): 文件管理新增到期警示狀態"
```

---

## Task 9: 夜間模式微調（對齊原型 Dark Tokens）

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 確認現有 dark mode 的 class 切換機制**

檢查是否為 `.dark` class 覆寫。

- [ ] **Step 2: 新增原型暗色 tokens 到 .dark block**

```css
.dark {
  --gogmo-bg: #0F0D0B;
  --gogmo-card: #1C1916;
  --gogmo-border: #2E2923;
  --gogmo-text: #F0EBE4;
  --gogmo-sub: #C0B8B0;
  --gogmo-gray: #8A8078;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(driver): 夜間模式 tokens 對齊原型"
```

---

## 實作順序建議

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9
```

每個 task 完成後在本 worktree 執行 `npm run build` 確認無編譯錯誤。

---

## 待驗證假設

1. `TripProgressTracker` 可以在 OrderCard 內條件渲染，不影響現有佈局
2. 訊息未讀計數可以透過現有 messages state 管理
3. SettlementTab 的雙欄改動不需要改動 API 或資料結構
