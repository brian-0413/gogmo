# 小隊互助系統實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 司機組成小隊並在隊內轉單，降低退單率。轉單費 5%，比退單 10% 便宜。

**Architecture:** 在現有 Prisma schema 新增 Squad / SquadMember / OrderTransfer 三個 model。小隊 CRUD 走 RESTful API，轉單狀態走狀態機。通知機制先做 SSE 即時推送。

**Tech Stack:** Next.js 14 App Router + TypeScript + Prisma ORM + SSE 即時通知

---

## 檔案架構

| 類型 | 檔案 | 負責 |
|------|------|------|
| Prisma | `prisma/schema.prisma` | 新增 Squad, SquadMember, OrderTransfer models |
| API | `src/app/api/squads/route.ts` | 小隊 CRUD（建立/查詢/解散/退出） |
| API | `src/app/api/squads/invite/route.ts` | 邀請成員 |
| API | `src/app/api/squads/join/route.ts` | 加入小隊 |
| API | `src/app/api/squads/leave/route.ts` | 退出小隊 |
| API | `src/app/api/orders/[id]/transfer-request/route.ts` | 發起轉單請求 |
| API | `src/app/api/orders/[id]/transfer-accept/route.ts` | 隊友接受轉單 |
| API | `src/app/api/orders/[id]/transfer-approve/route.ts` | 派單方同意 |
| API | `src/app/api/orders/[id]/transfer-reject/route.ts` | 派單方拒絕 |
| API | `src/app/api/squads/events/route.ts` | SSE 小隊通知 |
| API | `src/app/api/dispatchers/events/route.ts` | 派單方 SSE（加轉單通知） |
| Types | `src/types/index.ts` | 新增 Squad/Transfer TypeScript 介面 |
| Page | `src/app/dashboard/driver/page.tsx` | 加入「我的小隊」Tab |
| Component | `src/components/driver/SquadTab.tsx` | 小隊管理 UI |
| Component | `src/components/driver/SquadTransferBanner.tsx` | 轉單請求橫幅（隊友視角） |
| Component | `src/components/dispatcher/TransferConfirmBanner.tsx` | 派單方轉單確認橫幅 |
| Dispatcher | `src/app/dashboard/dispatcher/page.tsx` | 行控中心 SSE 加入轉單監聽 |

---

## Task 1: Prisma Schema 新增

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 新增 TransferStatus enum**

在 `enum TransactionType` 後面新增：

```prisma
enum TransferStatus {
  PENDING_SQUAD    // 等待隊友接
  PENDING_DISPATCHER // 等待派單方確認
  APPROVED          // 已完成
  REJECTED          // 派單方拒絕
  CANCELLED         // 已取消
  EXPIRED           // 過期（行程鎖定）
}
```

- [ ] **Step 2: 新增 Squad model（在 Driver model 前）**

```prisma
model Squad {
  id        String        @id @default(cuid())
  name      String
  maxMembers Int          @default(10)
  createdAt DateTime      @default(now())
  updatedAt DateTime     @updatedAt

  members   SquadMember[]
  transfers OrderTransfer[]

  @@map("squads")
}
```

- [ ] **Step 3: 新增 SquadMember model（在 Squad model 後）**

```prisma
model SquadMember {
  id        String   @id @default(cuid())
  squadId   String
  squad     Squad    @relation(fields: [squadId], references: [id], onDelete: Cascade)
  driverId  String   @unique  // 一個司機只能在一個小隊
  joinedAt  DateTime @default(now())

  @@unique([squadId, driverId])
  @@index([squadId])
  @@map("squad_members")
}
```

- [ ] **Step 4: 新增 OrderTransfer model（在 Transaction model 後）**

```prisma
model OrderTransfer {
  id            String          @id @default(cuid())
  orderId       String
  order         Order           @relation(fields: [orderId], references: [id])
  fromDriverId  String
  toDriverId    String?         // null = 還在等隊友接
  squadId       String
  squad         Squad           @relation(fields: [squadId], references: [id])
  reason        String?         // 轉單原因
  transferFee   Int             // 轉單費用（訂單金額 * 5%）
  status        TransferStatus @default(PENDING_SQUAD)
  dispatcherNote String?        // 派單方備註
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([orderId])
  @@index([fromDriverId])
  @@index([toDriverId])
  @@index([squadId])
  @@index([status])
  @@map("order_transfers")
}
```

- [ ] **Step 5: 更新 Driver model（加入 relations）**

在 `orders Order[]` 後加入：

```prisma
  squadMembership SquadMember?
  foundedSquads   Squad[]         @relation("SquadFounder")
  transfersOut    OrderTransfer[] @relation("TransferFrom")
  transfersIn     OrderTransfer[] @relation("TransferTo")
```

- [ ] **Step 6: 更新 Order model（加入 relations）**

在 `transactions Transaction[]` 後加入：

```prisma
  isLocked        Boolean         @default(false)
  transfers       OrderTransfer[]
```

- [ ] **Step 7: Run Prisma migrate**

```bash
npx prisma migrate dev --name add_squad_system --env-file .env
```

Expected: Migration created successfully

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: Prisma schema — 小隊互助系統（Squad, SquadMember, OrderTransfer）"
```

---

## Task 2: TypeScript Types 新增

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 新增 TransferStatus type**

```typescript
export type TransferStatus = 'PENDING_SQUAD' | 'PENDING_DISPATCHER' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
```

- [ ] **Step 2: 新增 SquadMember interface**

```typescript
export interface SquadMember {
  id: string
  squadId: string
  driverId: string
  joinedAt: Date | string
  driver?: {
    id: string
    licensePlate: string
    carType: string
    carColor: string
    isPremium: boolean
    user?: {
      id: string
      name: string
      phone: string
    }
  }
}
```

- [ ] **Step 3: 新增 Squad interface**

```typescript
export interface Squad {
  id: string
  name: string
  maxMembers: number
  memberCount: number
  createdAt: Date | string
  members: SquadMember[]
}
```

- [ ] **Step 4: 新增 OrderTransfer interface**

```typescript
export interface OrderTransfer {
  id: string
  orderId: string
  fromDriverId: string
  toDriverId: string | null
  squadId: string
  reason: string | null
  transferFee: number
  status: TransferStatus
  dispatcherNote: string | null
  createdAt: Date | string
  order?: {
    id: string
    scheduledTime: Date | string
    price: number
    pickupLocation: string
    dropoffLocation: string
    type: string
    vehicle: string
  }
  fromDriver?: {
    id: string
    licensePlate: string
    carType: string
    user?: { name: string }
  }
  toDriver?: {
    id: string
    licensePlate: string
    carType: string
    user?: { name: string }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: 新增小隊互助系統 TypeScript 類型定義"
```

---

## Task 3: 小隊 CRUD API

**Files:**
- Create: `src/app/api/squads/route.ts`
- Create: `src/app/api/squads/invite/route.ts`
- Create: `src/app/api/squads/join/route.ts`
- Create: `src/app/api/squads/leave/route.ts`

- [ ] **Step 1: POST /api/squads — 建立小隊**

Body: `{ name: string }`
邏輯：檢查司機是否已在小隊 → 建立 Squad → 建立 SquadMember（建立者是第一個成員）

```typescript
// src/app/api/squads/route.ts
export async function POST(request: NextRequest) {
  // 驗證司機身份
  // 檢查不在其他小隊
  // prisma.squad.create + prisma.squadMember.create
  // 回傳 Squad with members
}
```

- [ ] **Step 2: GET /api/squads — 查詢我的小隊**

```typescript
// GET /api/squads
// 查詢司機的 SquadMember → Squad → 所有 members（含 driver+user）
// 回傳 { squad, members }
```

- [ ] **Step 3: DELETE /api/squads — 解散小隊（建立者專屬）**

```typescript
// DELETE /api/squads
// 只能建立者解散
// prisma.squad.delete(Cascade) 會自動刪除 members
```

- [ ] **Step 4: POST /api/squads/invite — 邀請成員**

Body: `{ driverEmail: string }` 或 `{ driverId: string }`
邏輯：檢查小隊未滿 10 人 → 檢查被邀請人不在其他小隊 → 回傳成功（目前不做正式邀請流程，直接加入）

```typescript
// 實作：被邀請人 email → 找 User → 找 Driver → 建立 SquadMember
```

- [ ] **Step 5: POST /api/squads/join — 加入小隊（由邀請觸發）**

```typescript
// POST /api/squads/join
// Body: { squadId, driverId }
// 檢查 driver 不在其他小隊
// 檢查 squad 未滿
// 建立 SquadMember
```

- [ ] **Step 6: POST /api/squads/leave — 退出小隊**

```typescript
// POST /api/squads/leave
// 刪除 SquadMember
// 如果是建立者且還有其他成員：將最早加入的成員升為建立者
// 如果是最後一人：解散小隊
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/squads/
git commit -m "feat: 小隊 CRUD API（建立/查詢/解散/退出/邀請/加入）"
```

---

## Task 4: 轉單 API

**Files:**
- Create: `src/app/api/orders/[id]/transfer-request/route.ts`
- Create: `src/app/api/orders/[id]/transfer-accept/route.ts`
- Create: `src/app/api/orders/[id]/transfer-approve/route.ts`
- Create: `src/app/api/orders/[id]/transfer-reject/route.ts`

- [ ] **Step 1: POST /api/orders/[id]/transfer-request — 發起轉單請求**

Body: `{ reason?: string }`
邏輯：
- 驗證司機是此訂單的 driverId
- 訂單狀態 = ACCEPTED
- 行程前 3 小時內 → 拒絕（isLocked 檢查）
- 檢查司機有 SquadMember
- 建立 OrderTransfer（status=PENDING_SQUAD, toDriverId=null）
- **注意**：不在這裡扣 5% 費用，等派單方同意後才扣

```typescript
// src/app/api/orders/[id]/transfer-request/route.ts
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // 1. 驗證 DRIVER 身份
  // 2. 查訂單，確認是本人的 ACCEPTED 訂單
  // 3. 檢查 !order.isLocked（行程前3小時）
  // 4. 檢查司機有 SquadMember
  // 5. prisma.orderTransfer.create
  // 6. 廣播 SSE 到 /api/squads/events（通知所有隊友）
  // 7. 回傳 { success: true, transfer }
}
```

- [ ] **Step 2: POST /api/orders/[id]/transfer-accept — 隊友接受轉單**

Body: `{ transferId: string }`
邏輯：
- 驗證司機是 SquadMember（同 Squad）
- 檢查車型相容性（小車不能接大車單）
- 更新 OrderTransfer（toDriverId=司機ID, status=PENDING_DISPATCHER）
- 通知派單方（SSE /api/dispatchers/events）

車型相容規則：
```
接手車型=small: 只能接 small/any 單
接手車型=suv: 只能接 small/suv/any 單
接手車型=van9: 只能接 van9/any/any_r 單
```

```typescript
// src/app/api/orders/[id]/transfer-accept/route.ts
```

- [ ] **Step 3: POST /api/orders/[id]/transfer-approve — 派單方同意**

Body: `{ transferId: string }`
邏輯：
- 驗證 DISPATCHER 身份，是此訂單的派單方
- 更新 OrderTransfer.status = APPROVED
- 更新 Order.driverId = toDriverId
- 從 fromDriver 帳戶扣 5% 轉單費（建立 Transaction type=TRANSFER_FEE）
- 建立 Transaction 記錄

```typescript
// src/app/api/orders/[id]/transfer-approve/route.ts
```

- [ ] **Step 4: POST /api/orders/[id]/transfer-reject — 派單方拒絕**

Body: `{ transferId: string, note?: string }`
邏輯：
- 驗證 DISPATCHER 身份
- 更新 OrderTransfer.status = REJECTED, dispatcherNote = note
- 通知雙方司機（SSE）

```typescript
// src/app/api/orders/[id]/transfer-reject/route.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/orders/\[id\]/transfer-request/
git add src/app/api/orders/\[id\]/transfer-accept/
git add src/app/api/orders/\[id\]/transfer-approve/
git add src/app/api/orders/\[id\]/transfer-reject/
git commit -m "feat: 轉單 API（發起/接受/同意/拒絕）"
```

---

## Task 5: SSE 通知

**Files:**
- Create: `src/app/api/squads/events/route.ts`
- Modify: `src/app/api/dispatchers/events/route.ts`

- [ ] **Step 1: GET /api/squads/events — 小隊 SSE**

原理：司機連線時回傳該小隊的待處理轉單請求，之後有新轉單時推送。

```typescript
// src/app/api/squads/events/route.ts
export async function GET(request: NextRequest) {
  // 驗證司機身份，取得 squadId
  // 查詢該 squad 的 PENDING_SQUAD 轉單
  // 建立 ReadableStream，SSE 格式推送
  // 每次有新轉單時廣播到該 squad 的所有連線
}
```

SSE 格式：`data: {"type":"TRANSFER_REQUEST","transfer":{...}}\n\n`

- [ ] **Step 2: 修改派單方 SSE 加入轉單通知**

在現有 `/api/dispatchers/events` 的 SSE 中，加入監聽 `PENDING_DISPATCHER` 狀態的轉單。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/squads/events/route.ts src/app/api/dispatchers/events/route.ts
git commit -m "feat: SSE 小隊通知 + 派單方轉單通知"
```

---

## Task 6: 司機端 — 我的小隊 Tab

**Files:**
- Modify: `src/app/dashboard/driver/page.tsx`
- Create: `src/components/driver/SquadTab.tsx`
- Create: `src/components/driver/SquadTransferBanner.tsx`

- [ ] **Step 1: 在 driver/page.tsx 加入「我的小隊」Tab**

在現有 Tab 类型中加入 `'squad'`，新增 Tab 按鈕。新 Tab 內容為 `<SquadTab />`。
如果司機不在小隊，顯示「建立小隊」引導頁。

- [ ] **Step 2: SquadTab — 小隊管理頁面**

功能：
- 顯示小隊名稱、成員人數（X/10）
- 成員列表（姓名、車牌、車型、「建立者」標籤）
- 「邀請成員」按鈕（輸入 email 或選擇現有司機）
- 「退出小隊」按鈕（需二次確認）
- 「解散小隊」按鈕（只有建立者可見，需二次確認）

API 呼叫：
- GET /api/squads → 顯示小隊資訊
- POST /api/squads/invite → 邀請成員
- POST /api/squads/leave → 退出
- DELETE /api/squads → 解散

- [ ] **Step 3: SquadTransferBanner — 隊友視角轉單橫幅**

當 SSE 收到 TRANSFER_REQUEST 事件時，在司機儀表板顯示橫幅：
```
「隊友王小明請求支援：4/1 14:00 送機 板橋→桃園 $1,400」
車型：任意 你的車型：休旅 ✓ 相容
[我可以接]  [無法支援]
```
點「我可以接」→ POST /api/orders/[id]/transfer-accept
點「無法支援」→ 關閉橫幅

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/driver/page.tsx src/components/driver/SquadTab.tsx src/components/driver/SquadTransferBanner.tsx
git commit -m "feat: 司機端「我的小隊」Tab + 轉單橫幅"
```

---

## Task 7: 司機端 — 行程卡片「請求小隊支援」按鈕

**Files:**
- Modify: `src/components/driver/OrderCard.tsx`

- [ ] **Step 1: 在 ACCEPTED 訂單卡片加入「請求小隊支援」按鈕**

在行程卡片（ACCEPTED 狀態）下方，原本只有「開始/抵達/客上/客下」按鈕列，加入：
- 「請求小隊支援」（藍色，`bg-[#0C447C]`）
- 「退單」（紅色邊框）

顯示費用說明：
- 請求支援：轉單費 5%（司機填的實拿金額 * 5%）
- 直接退單：退單費 10%

- [ ] **Step 2: 點「請求小隊支援」後的流程**

點擊 → 跳出確認對話框（可填寫原因） → POST /api/orders/[id]/transfer-request
成功後：按鈕變為「等待隊友回應...」（禁用），卡片顯示「等待支援」標籤

- [ ] **Step 3: Commit**

```bash
git add src/components/driver/OrderCard.tsx
git commit -m "feat: 司機行程卡片加入「請求小隊支援」按鈕"
```

---

## Task 8: 派單方端 — 轉單確認 UI

**Files:**
- Modify: `src/app/dashboard/dispatcher/page.tsx`
- Create: `src/components/dispatcher/TransferConfirmBanner.tsx`

- [ ] **Step 1: TransferConfirmBanner — 轉單確認橫幅**

當 SSE 收到 PENDING_DISPATCHER 轉單通知時，在派單方行控中心頂部顯示橫幅：
```
轉單請求
訂單 #20260409-0001
4/1 14:00 送機 板橋→桃園機場 $1,400
原司機：王小明 (ABC-1234) 九人座
接手司機：陳大明 (DEF-5678) 休旅車
轉單費：$70
[同意轉單]  [拒絕]
```
點「同意」→ POST /api/orders/[id]/transfer-approve
點「拒絕」→ POST /api/orders/[id]/transfer-reject

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/dispatcher/page.tsx src/components/dispatcher/TransferConfirmBanner.tsx
git commit -m "feat: 派單方端轉單確認橫幅 UI"
```

---

## Task 9: 訂單鎖定 Cron

**Files:**
- Create: `src/app/api/cron/lock-orders/route.ts`

- [ ] **Step 1: Cron API — 行程前 3 小時自動鎖定**

每分鐘跑一次，查詢所有 ACCEPTED 且 !isLocked 且 scheduledTime - now <= 3小時 的訂單，設定 isLocked=true。
如果這些訂單有 PENDING_SQUAD 的轉單請求，更新為 EXPIRED 並通知司機。

```typescript
// src/app/api/cron/lock-orders/route.ts
export async function GET(request: NextRequest) {
  // 驗證 cron secret（X-Cron-Secret header）
  const threeHoursLater = new Date(Date.now() + 3 * 60 * 60 * 1000)

  // 1. 找出需要鎖定的訂單
  const ordersToLock = await prisma.order.findMany({
    where: {
      status: 'ACCEPTED',
      isLocked: false,
      scheduledTime: { lte: threeHoursLater },
    },
  })

  // 2. 設定 isLocked = true
  // 3. 取消 PENDING_SQUAD 轉單（設為 EXPIRED）
  // 4. 通知相關司機
}
```

**注意**：Zeabur 支援 cron job，URL 設定為 `https://your-domain/api/cron/lock-orders`，頻率每分鐘。

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/lock-orders/route.ts
git commit -m "feat: 訂單鎖定 Cron（行程前3小時自動鎖定）"
```

---

## Task 10: Build 驗證

- [ ] **Step 1: npm run build**

```bash
npm run build
```
Expected: 無 TypeScript 錯誤，無編譯錯誤

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: 小隊互助系統 — Build 驗證通過"
```

---

## 實作順序

1. Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10

每個 Task 完成後立即 `git commit`，最後一次 Task 10 提交後 `git push`。
