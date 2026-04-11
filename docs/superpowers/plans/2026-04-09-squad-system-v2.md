# 小隊互助系統 v2 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作小隊互助系統 v2：派單方核准→小隊支援池搶單、bonus 點數機制、3% 轉單費、邀請制、管理員費率參數

**Architecture:** 流程重構：司機發起 → 派單方核准 → 小隊池公開搶單 → 接手成功後扣 3% + 轉 bonus。bonus 在發起時預扣，退還時機：派單方拒絕/撤回/超時鎖定。

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM v7, SSE 即時通知

---

## 現有程式碼分析

### 現有流程（需重構）
```
司機發起 → PENDING_SQUAD → 廣播給小隊（跳過派單方核准!）
```

### 新流程（v2）
```
司機發起 → PENDING_DISPATCHER → 派單方核准 → PENDING_SQUAD → 小隊池搶單 → APPROVED
                 ↓拒絕/撤回/超時
               CANCELLED/EXPIRED（退還 bonus）
```

### 現有 Schema（需變更）
- `OrderTransfer.transferFee`：目前計算 5%，需改為 3%
- `OrderTransfer.bonusPoints`：尚不存在，需新增
- `OrderTransfer.status`：需調整流程（見上）

---

## Task 1: Schema + Constants 更新

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/constants.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Prisma schema — 新增 bonusPoints，transferFee 說明改為 3%**

```prisma
model OrderTransfer {
  // ... existing fields ...
  bonusPoints  Int @default(0) // bonus 點數
  // transferFee: 說明改為 (訂單金額 * 3%)，在接手成功後扣
  // status: PENDING_DISPATCHER（等待派單方核准）→ PENDING_SQUAD（等待小隊搶單）→ APPROVED / CANCELLED / EXPIRED / REJECTED
}
```

- [ ] **Step 2: Update constants.ts**

```typescript
/** 轉單手續費比率（3%） */
export const TRANSFER_FEE_RATE = 0.03

/** 小隊鎖定小時數（行程前 N 小時鎖定） */
export const TRANSFER_LOCK_HOURS = 1

/** bonus 最低點數 */
export const MIN_BONUS_POINTS = 10
```

- [ ] **Step 3: Update types/index.ts — OrderTransfer 介面新增 bonusPoints**

```typescript
export interface OrderTransfer {
  // ... existing fields ...
  bonusPoints?: number  // 新增
}
```

- [ ] **Step 4: Run Prisma db push**

Run: `npx prisma db push`
Expected: Schema updated, bonusPoints column added

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/constants.ts src/types/index.ts
git commit -m "feat: 小隊 v2 — Schema 更新 bonusPoints、TRANSFER_FEE_RATE 改 3%、TRANSFER_LOCK_HOURS=1"
```

---

## Task 2: transfer-request API 重構

**Files:**
- Modify: `src/app/api/orders/[id]/transfer-request/route.ts`

**行為變更：**
- 發起時狀態 = `PENDING_DISPATCHER`（等待派單方核准）
- 計算 bonusPoints（預扣檢查）
- 廣播給派單方（SQUAD_TRANSFER_PENDING）
- 3% 轉單費此時不扣，等接手成功後在 pool claim 時扣

- [ ] **Step 1: Rewrite POST handler**

```typescript
// POST /api/orders/[id]/transfer-request — 發起轉單請求
// 1. 驗證司機身份 + 訂單歸屬 + 狀態
// 2. 行程前 1 小時鎖定檢查（scheduledTime - now <= 1小時 → 不可發起）
// 3. bonusPoints 預扣檢查（司機餘額 >= bonusPoints）
// 4. 建立 OrderTransfer，status = PENDING_DISPATCHER
// 5. 廣播 SQUAD_TRANSFER_PENDING 到派單方（broadcastDispatcherEvent）
```

Key changes from existing:
- `status: 'PENDING_DISPATCHER'` (not `PENDING_SQUAD`)
- Add `bonusPoints` field to request body and DB write
- Add bonus pre-deduction: `driver.balance -= bonusPoints`
- Add Transaction record for bonus lock
- Broadcast to dispatcher, not squad

- [ ] **Step 2: Add GET handler** (查詢轉單狀態)

```typescript
// GET /api/orders/[id]/transfer-request — 查詢是否有進行中的轉單請求
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/[id]/transfer-request/route.ts
git commit -m "feat: 小隊 v2 — transfer-request 重構（派單方核准流程 + bonus 預扣）"
```

---

## Task 3: transfer-approve API 重構

**Files:**
- Modify: `src/app/api/orders/[id]/transfer-approve/route.ts`

**行為變更：**
- 確認 status = `PENDING_DISPATCHER`（非 `PENDING_SQUAD`）
- 批准後改為 `PENDING_SQUAD`，廣播給小隊
- 不再直接變更訂單司機（等搶單）
- 不再扣 3%（等搶單成功後在 pool claim 時扣）

- [ ] **Step 1: Rewrite approve handler**

```typescript
// POST /api/orders/[id]/transfer-approve
// 1. 驗證派單方身份 + 訂單歸屬
// 2. 確認 status = PENDING_DISPATCHER
// 3. 更新 status = PENDING_SQUAD
// 4. 廣播 SQUAD_POOL_NEW 到小隊全成員
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/[id]/transfer-approve/route.ts
git commit -m "feat: 小隊 v2 — transfer-approve 重構（進入小隊池，不直接換司機）"
```

---

## Task 4: transfer-reject API 更新

**Files:**
- Modify: `src/app/api/orders/[id]/transfer-reject/route.ts`

**行為變更：**
- status = `PENDING_DISPATCHER` → `REJECTED`
- **退還 bonus 點數**給原司機（預扣扣的退回去）
- 退還時建立 Transaction type: `RECHARGE`

- [ ] **Step 1: Update reject handler — add bonus refund**

```typescript
// 在更新 status 為 REJECTED 之前：
if (transfer.bonusPoints > 0) {
  await tx.driver.update({
    where: { id: transfer.fromDriverId },
    data: { balance: { increment: transfer.bonusPoints } },
  })
  await tx.transaction.create({
    data: {
      driverId: transfer.fromDriverId,
      amount: transfer.bonusPoints,  // 正數 = 收入
      type: 'RECHARGE',
      status: 'SETTLED',
      description: `轉單被拒絕，bonus ${transfer.bonusPoints} 點已退還`,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/[id]/transfer-reject/route.ts
git commit -m "feat: 小隊 v2 — transfer-reject 新增 bonus 退還邏輯"
```

---

## Task 5: transfer-withdraw API（派單方撤回）

**Files:**
- Create: `src/app/api/orders/[id]/transfer-withdraw/route.ts`

**行為：**
- 派單方在行程前 1 小時內可撤回處於 `PENDING_SQUAD` 的轉單
- 退還 bonus 點數給原司機
- 退還 3% 轉單費給原司機（因為沒人接手所以不該扣）
- 狀態改為 `CANCELLED`
- 廣播 `TRANSFER_WITHDRAWN` 給小隊 + 派單方

- [ ] **Step 1: Create withdraw API**

```typescript
// POST /api/orders/[id]/transfer-withdraw
// Body: { transferId: string }
// 1. 驗證派單方身份 + 訂單歸屬
// 2. 確認 status = PENDING_SQUAD
// 3. 確認 scheduledTime - now <= 1小時
// 4. 退還 bonusPoints + 3% 給原司機（Transaction type: RECHARGE x2）
// 5. 更新 status = CANCELLED
// 6. 廣播 TRANSFER_WITHDRAWN
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/[id]/transfer-withdraw/route.ts
git commit -m "feat: 小隊 v2 — 新增派單方撤回 API"
```

---

## Task 6: 小隊支援池 API

**Files:**
- Create: `src/app/api/squads/pool/route.ts` (GET)
- Create: `src/app/api/squads/pool/[transferId]/claim/route.ts` (POST)

**GET /api/squads/pool：**
- 取得司機所屬小隊的所有 `PENDING_SQUAD` 狀態轉單
- 排除原司機自己（司機不能搶自己的單）
- 排除自己已搶過的

**POST /api/squads/pool/[transferId]/claim：**
- 司機搶單，先搶先贏
- 在 transaction 內：
  1. 確認 transfer.status = PENDING_SQUAD（防競態）
  2. 設定 toDriverId = currentDriver
  3. 設定 status = APPROVED
  4. 更新 order.driverId = toDriverId
  5. 扣 fromDriver 3% 轉單費（Transaction）
  6. 將 bonusPoints 從 fromDriver 轉給 toDriver（Transaction x2）
- 廣播 TRANSFER_APPROVED 給小隊 + 派單方

- [ ] **Step 1: Create pool GET API**

```typescript
// GET /api/squads/pool
// 取得小隊支援池（所有 PENDING_SQUAD 轉單，排除自己）
// 回傳：{ transfers: OrderTransfer[] }
```

- [ ] **Step 2: Create pool claim API**

```typescript
// POST /api/squads/pool/[transferId]/claim
// 搶單核心 transaction：
// 1. SELECT FOR UPDATE on transfer (防止 race condition)
// 2. 確認 status = PENDING_SQUAD
// 3. 確認 order.scheduledTime - now > 1小時
// 4. 設定 toDriverId, status = APPROVED
// 5. 更新 order.driverId
// 6. 扣 fromDriver 3%：balance -= transferFee
// 7. 扣 fromDriver bonus：balance -= bonusPoints
// 8. 給 toDriver bonus：balance += bonusPoints
// 9. 建立 Transaction records
// 10. 廣播
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/squads/pool/route.ts
git add src/app/api/squads/pool/[transferId]/claim/route.ts
git commit -m "feat: 小隊 v2 — 小隊支援池 API（GET pool + POST claim）"
```

---

## Task 7: 轉單歷史 API + 邀請制重構

**Files:**
- Modify: `src/app/api/squads/invite/route.ts`
- Modify: `src/app/api/squads/join/route.ts`
- Modify: `src/app/api/squads/route.ts` (GET squad)
- Create: `src/app/api/squads/respond/route.ts` (邀請回應 accept/reject)

**邀請制變更：**
- 現有：邀請人直接輸入 email，被邀請人直接加入
- 新流程：
  1. 小隊長輸入**車號**搜尋司機 → 建立 `SquadInvite`（pending）
  2. 被邀請司機收到 SSE 通知
  3. 被邀請人至 SquadTab 看到待回應邀請 → accept/reject
  4. accept → 建立 SquadMember
  5. reject → 刪除 SquadInvite

- [ ] **Step 1: 新增 SquadInvite model**

```prisma
model SquadInvite {
  id        String   @id @default(cuid())
  squadId   String
  squad     Squad   @relation(fields: [squadId], references: [id])
  driverId  String  // 被邀請司機
  status    String  @default("pending") // pending / accepted / rejected
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: 修改 invite API（車號搜尋 + 建立邀請）**

```typescript
// POST /api/squads/invite
// Body: { licensePlate: string }
// 1. 以車號搜尋司機（模糊比對 licensePlate）
// 2. 檢查司機是否已有小隊
// 3. 檢查小隊是否已滿
// 4. 建立 SquadInvite（pending）
// 5. 廣播 SQUAD_INVITE 到該司機的 SSE
```

- [ ] **Step 3: 建立 respond API**

```typescript
// POST /api/squads/respond
// Body: { inviteId: string, action: "accept" | "reject" }
// accept: 建立 SquadMember，刪除 SquadInvite
// reject: 刪除 SquadInvite
```

- [ ] **Step 4: 修改 GET /api/squads — 回傳待回應邀請**

```typescript
// GET /api/squads
// 回傳中增加 pendingInvites: SquadInvite[]
// （讓司機在 SquadTab 看到有待處理邀請）
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
npx prisma db push
git add src/app/api/squads/invite/route.ts src/app/api/squads/respond/route.ts src/app/api/squads/route.ts
git commit -m "feat: 小隊 v2 — 邀請制重構（車號搜尋 + 同意流程）"
```

---

## Task 8: Cron 鎖定 API 更新

**Files:**
- Modify: `src/app/api/cron/lock-orders/route.ts`

**行為變更：**
- 行程前 3 小時 → **行程前 1 小時**鎖定
- 對 PENDING_SQUAD 轉單：
  - 標記為 EXPIRED
  - 退還 bonusPoints 給原司機
  - 退還（不存在的）3% 不需退

- [ ] **Step 1: Update cron lock API**

```typescript
// 行程前 1 小時鎖定（TRANSFER_LOCK_HOURS = 1）
// EXPIRED 時退還 bonusPoints
// 廣播 TRANSFER_EXPIRED 到小隊
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/lock-orders/route.ts
git commit -m "feat: 小隊 v2 — Cron 鎖定改為 1 小時 + EXPIRED 退還 bonus"
```

---

## Task 9: 派單方轉單橫幅 UI 更新

**Files:**
- Modify: `src/components/dispatcher/TransferConfirmBanner.tsx`
- Modify: `src/app/dashboard/dispatcher/page.tsx` (SSE listener)

**行為變更：**
- 派單方看到轉單請求（`SQUAD_TRANSFER_PENDING`）
- 顯示：原司機名、轉單原因、bonus 點數
- 按鈕：「同意進入小隊池」（非直接換司機）
- 按鈕：「拒絕」（退還 bonus）

- [ ] **Step 1: Update TransferConfirmBanner**

```typescript
// 接收 SQUAD_TRANSFER_PENDING 事件
// 顯示轉單原因 + bonus 點數（而非直接顯示接手司機）
// 「同意」→ API: transfer-approve（進入小隊池）
// 「拒絕」→ API: transfer-reject（退還 bonus）
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dispatcher/TransferConfirmBanner.tsx
git commit -m "feat: 小隊 v2 — 派單方橫幅更新（顯示 bonus + 進入小隊池流程）"
```

---

## Task 10: SquadTab 小隊支援池 UI

**Files:**
- Modify: `src/components/driver/SquadTab.tsx`

**新增區塊：**
- 「小隊支援池」Tab 或區塊（與成員列表並列）
- 顯示所有 PENDING_SQUAD 轉單
- 每張卡：行程資訊、原司機、bonus 點數、「我要支援」按鈕
- 車型相容性檢查提示
- SSE 即時更新（新單到來時刷新列表）
- 「待回應邀請」區塊（accept/reject 按鈕）

- [ ] **Step 1: Add SSE listener for SQUAD_POOL_NEW**

```typescript
// 監聽 SSE 事件：SQUAD_POOL_NEW, TRANSFER_APPROVED, TRANSFER_EXPIRED, TRANSFER_WITHDRAWN
// 有事件時重新 fetch pool
```

- [ ] **Step 2: Add Pool section UI**

```tsx
// 切換 Tab：成員列表 / 支援池
// Pool section: GET /api/squads/pool
// 轉單卡：顯示時間/地點/車資/bonus/原司機
// 「我要支援」按鈕 → POST /api/squads/pool/[id]/claim
```

- [ ] **Step 3: Add Invite Response section**

```tsx
// 待回應邀請列表（from GET /api/squads）
// accept / reject 按鈕 → POST /api/squads/respond
```

- [ ] **Step 4: Commit**

```bash
git add src/components/driver/SquadTab.tsx
git commit -m "feat: 小隊 v2 — SquadTab 新增支援池 UI + 搶單 + 邀請回應"
```

---

## Task 11: 發起轉單表單 UI

**Files:**
- Modify: `src/components/driver/OrderCard.tsx`（行程卡片上的「請求小隊支援」按鈕）
- Create: `src/components/driver/TransferRequestForm.tsx`（發起轉單表單 modal/panel）

**表單內容：**
- 轉單原因（文字輸入）
- bonus 點數（數字輸入，最小 10，無上限）
- 顯示即時提示：帳戶餘額 / bonus 點數
- 「確認發出」（建立轉單 + 預扣 bonus）
- 「取消」

- [ ] **Step 1: Create TransferRequestForm component**

```tsx
// Modal 或 inline panel
// Props: order, onSuccess, onCancel
// Input: reason (text), bonusPoints (number, min=10)
// Show: fromDriver balance, bonus deduction preview
// Submit: POST /api/orders/[id]/transfer-request
// On success: show "等待派單方核准" 狀態
```

- [ ] **Step 2: Update OrderCard — 「請求小隊支援」按鈕**

```tsx
// 在 ACCEPTED 狀態訂單卡片：
// [請求小隊支援] 按鈕 → 開啟 TransferRequestForm
// 顯示：轉單費 3%（接手成功後扣）/ 直接退單 10%
```

- [ ] **Step 3: Commit**

```bash
git add src/components/driver/TransferRequestForm.tsx src/components/driver/OrderCard.tsx
git commit -m "feat: 小隊 v2 — 發起轉單表單 UI（bonus 輸入 + 預扣提示）"
```

---

## Task 12: 管理員後台費率參數

**Files:**
- Create: `src/app/api/admin/config/route.ts`
- Create: `src/app/dashboard/admin/page.tsx`
- Create: `src/components/admin/FeeConfigPanel.tsx`

**行為：**
- 管理員登入後可看到「費率設定」面板
- 可調整：接單費率、退單費率、轉單費率、bonus 最低點數
- 即時寫入 `src/lib/constants.ts`（或建立 AdminConfig model）
- 目前 MVP：寫入 `src/lib/constants.ts`，未來遷移到 DB

- [ ] **Step 1: Create admin fee config API + page**

```typescript
// GET /api/admin/config — 取得目前費率
// PUT /api/admin/config — 更新費率（寫入 constants.ts 或 AdminConfig table）
```

- [ ] **Step 2: Create admin dashboard page + FeeConfigPanel**

```tsx
// FeeConfigPanel: 4 個輸入框（接單費率、退單費率、轉單費率、bonus 最低點數）
// 儲存後即時生效
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/config/route.ts src/app/dashboard/admin/page.tsx src/components/admin/FeeConfigPanel.tsx
git commit -m "feat: 小隊 v2 — 管理員後台費率設定"
```

---

## Task 13: 最終 Build 驗證

**Files:**
- None (build check only)

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: No TypeScript errors, all new routes visible

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: 小隊互助系統 v2 — 全部實作完成"
```

---

## 依賴關係圖

```
Task 1 (Schema/Constants) ──→ 所有其他 tasks
Task 2 (transfer-request) ──→ Task 3, 4, 5
Task 3 (approve) ──────────→ Task 10
Task 4 (reject + refund) ──→ Task 5
Task 5 (withdraw) ──────────→ Task 10
Task 6 (pool API) ──────────→ Task 10
Task 7 (invite flow) ────────→ Task 10
Task 8 (cron) ──────────────→ Task 13
Task 9 (banner UI) ──────────→ Task 10
Task 10 (SquadTab pool UI) ──→ Task 13
Task 11 (transfer form) ──────→ Task 13
Task 12 (admin) ──────────────→ Task 13
```

**可並行的 tasks（獨立檔案）：**
- Task 2, 3, 4, 5, 6, 7, 8, 9, 11, 12 可同時 dispatch（各自修改不同檔案）
- Task 10 依賴 Task 2, 3, 4, 5, 6, 7, 9
- Task 13 最後
