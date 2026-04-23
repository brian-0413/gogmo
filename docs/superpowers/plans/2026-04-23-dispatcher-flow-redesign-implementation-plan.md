# 派單中心重構實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重建派單方工作流：AI 只解析五個核心欄位、司機改為「申請接單」、派單方批准後才填寫詳細資訊

**Architecture:**
- 新流程核心改變：`PUBLISHED` 訂單讓司機「申請接單」→ `ASSIGNED` → 派單方審核批准 + 填詳細資訊 → `ACCEPTED`
- AI 解析目標簡化為：時間、起訖點、金額、車型。其餘資訊在批准時才補填
- 訂單卡支援擴展式司機審查面板（卡片內展開，不換頁）

**Tech Stack:** Next.js 14 App Router, Prisma, TypeScript, Tailwind, SSE

---

## Phase 1：AI 解析改革

### Task 1: 重寫 System Prompt

**Files:**
- Modify: `src/lib/prompts/order-parsing.ts`

- [ ] **Step 1: Read current prompt**

Run: `type src\lib\prompts\order-parsing.ts`

- [ ] **Step 2: Replace prompt content**

新的 system prompt 核心原則：
- 只要求解析五個欄位：`time`、`pickupLocation`、`dropoffLocation`、`price`、`vehicle`（其餘全部放 `notes`）
- `vehicle` 只能填：`SEDAN_5 | SUV_5 | MPV_7 | VAN_9 | CUSTOM`
- `type` 只填：`pickup | dropoff | pickup_boat | dropoff_boat | transfer | charter | pending`
- 不要要求解析乘客資訊（聯絡人/電話/人數/行李），這些是批准時才填的
- 航班解析：接機要有航班、送機可選
- 地點解析規則同現有（接機起點=機場，送機終點=機場）
- 不再要求解析 notes 裡面的詳細資訊
- rejected 條件：完全無法識別、或缺 3 個以上核心欄位
- incomplete 條件：缺 1-2 個核心欄位

```typescript
// 替換 SYSTEM_PROMPT 內容（精簡版）
const SYSTEM_PROMPT = `你是台灣機場接送平台的訂單解析專家。

## 輸出格式
回傳 JSON array，每個元素是一筆訂單：
{
  "rawText": "原始行文字",
  "time": "時間 HH:MM",
  "type": "pickup | dropoff | pickup_boat | dropoff_boat | transfer | charter | pending",
  "vehicle": "SEDAN_5 | SUV_5 | MPV_7 | VAN_9 | CUSTOM",
  "price": 數字或null,
  "pickupLocation": "起點",
  "dropoffLocation": "終點",
  "notes": "原始行完整複製",
  "status": "ok | incomplete | rejected",
  "reason": "當 rejected 或 incomplete 時的原因"
}

## 只解析五個核心欄位
其餘所有資訊（聯絡人、电话、人数、行李、航班詳細等）全部放 notes，不獨立解析。

## 種類判斷
- 有「接」→ pickup（接機）
- 有「送」→ dropoff（送機）
- 基隆港→地點 → pickup_boat
- 地點→基隆港 → dropoff_boat
- 接機：起點=○機，終點=訊息中的地點
- 送機：起點=訊息中的地點，終點=○機

## 車型（只能填這五個值）
- 小車/轎車/L/K/R → SEDAN_5
- 休旅/7人/g → SUV_5
- 7人座/V → MPV_7
- 大車/9人/Vito → VAN_9
- 其他/任意 → CUSTOM

## rejected 條件（status="rejected"）
- 完全無法識別
- 缺少 time + pickupLocation + dropoffLocation 三個核心欄位

## incomplete 條件（status="incomplete"）
- 只缺少 1-2 個核心欄位
- 時間/金額有歧義

使用以下預設日期：{DEFAULT_DATE}`

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts/order-parsing.ts
git commit -m "feat(parse): 簡化AI解析目標為五個核心欄位"
```

---

### Task 2: 更新 parseOrdersV2 输出结构

**Files:**
- Modify: `src/lib/ai.ts`

- [ ] **Step 1: Read normalizeParserOutput**

Run: `type src\lib\vehicle\normalize.ts`

- [ ] **Step 2: 確認 normalizeParserOutput 輸出 vehicleType 為標準 enum**

`normalizeParserOutput` 已經從 `normalizeVehicleInput` 而來，應該輸出 `SEDAN_5 | SUV_5 | MPV_7 | VAN_9 | CUSTOM`。

如果輸出不是標準 enum，修改 `src/lib/vehicle/parser-dictionary.ts` 加入對應。

- [ ] **Step 3: 簡化 validatedOrders mapping**

在 `parseOrdersV2` 的 `validatedOrders` mapping 中，移除以下欄位的解析：
- `contactName` → 不解析
- `contactPhone` → 不解析
- `passengerCount` → 不解析
- `luggageCount` → 不解析
- `specialRequests` → 不解析

這些欄位在新的 `ASSIGNED → ACCEPTED` 流程中由派單方填寫。

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat(parse): 移除AI解析中的乘客詳細欄位"
```

---

## Phase 2：派單方審核 flow（核心）

### Task 3: 新增 `POST /api/orders/[id]/apply`（司機申請接單）

**Files:**
- Create: `src/app/api/orders/[id]/apply/route.ts`
- Test: `src/app/api/orders/[id]/apply/route.ts`（手動測試）

- [ ] **Step 1: 確認現有 accept route 邏輯**

```bash
type src\app\api\orders\[id]\accept\route.ts
```

了解搶單機制（`updateMany` 條件式寫入）、點數扣款、衝突檢查。

- [ ] **Step 2: 建立新的 apply route**

司機按「申請接單」時：
1. 檢查訂單狀態是否為 `PUBLISHED`
2. 將訂單狀態改為 `ASSIGNED`，寫入 `driverId`
3. 不扣點（扣點在派單方批准時）
4. 不做衝突檢查（衝突檢查在批准時）

```typescript
// POST /api/orders/[id]/apply
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 驗證司機身份
  // 檢查訂單 status === 'PUBLISHED'
  // $transaction:
  //   1. updateMany: WHERE id=? AND status='PUBLISHED' → SET status='ASSIGNED', driverId=?
  //   2. 若 count === 0 → 訂單已被別人申請，回 409 Conflict
  //   3. 若成功 → return { success: true }
}
```

- [ ] **Step 3: 測試**

本機發送：
```bash
curl -X POST http://localhost:3000/api/orders/[orderId]/apply \
  -H "Authorization: Bearer [driverToken]"
```

預期：狀態變 ASSIGNED

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/[id]/apply/route.ts
git commit -m "feat(order): 新增司機申請接單API"
```

---

### Task 4: 更新 `POST /api/orders/[id]/accept`（移除直接接單）

**Files:**
- Modify: `src/app/api/orders/[id]/accept/route.ts:98-110`

- [ ] **Step 1: 移除 PUBLISHED 直接接單的邏輯**

修改 `accept route`：
- `status !== 'PUBLISHED'` 時，若 status === 'ASSIGNED' 且 `driverId === 自己` → 可以通過
- 但若 `status === 'PUBLISHED'` → 回「請先申請接單」，不是直接接單

也就是說：`PUBLISHED` 狀態不再能被直接接走，必須先經過 `apply`。

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/[id]/accept/route.ts
git commit -m "feat(order): PUBLISHED訂單需先申請才能接單"
```

---

### Task 5: 新增 `POST /api/orders/[id]/review`（派單方批准 + 填詳細資訊）

**Files:**
- Modify: `src/app/api/orders/[id]/dispatcher-approve\route.ts`
- Create: `src/app/api/orders/[id]/approve\route.ts`（或合併到現有 dispatcher-approve）

- [ ] **Step 1: Read existing dispatcher-approve route**

```bash
type src\app\api\orders\[id]\dispatcher-approve\route.ts
```

- [ ] **Step 2: 更新 dispatcher-approve 支援詳細資訊**

新的 body 格式：
```json
{
  "action": "approve",
  "contactName": "王先生",
  "contactPhone": "0912345678",
  "flightNumber": "CI-100",
  "pickupAddress": "台北市松山區南京東路",
  "dropoffAddress": "桃園國際機場第一航廈",
  "passengerCount": 3,
  "luggageCount": 2,
  "specialRequests": ["安全座椅"],
  "note": "請提早到"
}
```

或 `action: "reject"` 為拒絕。

**實作邏輯：**
1. 驗證派單方身份
2. 檢查訂單狀態 === 'ASSIGNED'
3. 檢查訂單屬於此派單方
4. 若 action === 'approve'：
   - 驗證必填欄位（contactName, contactPhone, 依 type 決定 flightNumber/pickupAddress/dropoffAddress）
   - `prisma.order.update` 寫入詳細資訊 + 狀態改 `ACCEPTED`
   - 扣司機點數（5% 手續費）
   - 建立 Transaction 記錄
5. 若 action === 'reject'：
   - `prisma.order.update` 狀態改回 `PUBLISHED`，driverId 設 null
   - 不扣點

- [ ] **Step 3: 欄位驗證規則**

| 欄位 | 必填條件 |
|------|---------|
| contactName | 必填 |
| contactPhone | 必填 |
| flightNumber | type 含 pickup（接機）必填 |
| pickupAddress | type 含 dropoff（送機）必填 |
| dropoffAddress | type 含 pickup（接機）必填 |
| passengerCount | 必填 |
| luggageCount | 必填 |

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/[id]/dispatcher-approve/route.ts
git commit -m "feat(order): 批准時支援填寫詳細資訊並更新欄位"
```

---

### Task 6: 建立司機審查面板元件

**Files:**
- Create: `src/components/dispatcher/DriverReviewPanel.tsx`

- [ ] **Step 1: 確認現有卡片結構**

```bash
type src\components\dispatcher\OrderCard.tsx
```

- [ ] **Step 2: 建立 DriverReviewPanel 元件**

```typescript
interface DriverReviewPanelProps {
  order: Order
  driver: { name: string; phone: string; licensePlate: string; vehicleType: string; carColor: string }
  onApprove: (detailedInfo: DetailedOrderInfo) => Promise<void>
  onReject: () => Promise<void>
  loading: boolean
}

// 司機基本資訊顯示
// 詳細資訊表單（聯絡人、電話、航班、上下車地址、人數、行李、特殊需求、備註）
// 批准按鍵（disabled 直到必填欄位齊全）
// 拒絕按鍵
// 選項：司機三證（駕照/行照/保險）顯示狀態
```

表單驗證規則同 Task 5 Step 3 表格。

- [ ] **Step 3: Commit**

```bash
git add src/components/dispatcher/DriverReviewPanel.tsx
git commit -m "feat(dispatcher): 新增司機審查面板元件"
```

---

### Task 7: 更新派單方 Dashboard（整合審查面板）

**Files:**
- Modify: `src/app/dashboard/dispatcher/page.tsx`

- [ ] **Step 1: 確認現有訂單列表 fetch 邏輯**

在 `useEffect` fetch orders 的地方，確認有沒有包含 `ASSIGNED` 狀態的訂單。

- [ ] **Step 2: 讀取 ASSIGNED 訂單**

GET `/api/orders?status=ASSIGNED` 取得所有待審核訂單。

- [ ] **Step 3: 新增「待處理」badge**

在 tab 顯示「待處理（N）」紅色 badge，數字為 ASSIGNED 訂單數量。

- [ ] **Step 4: 訂單卡展開面板**

當用戶點「審查」按鍵時，訂單卡展開或彈出 `DriverReviewPanel`，不換頁。

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/dispatcher/page.tsx
git commit -m "feat(dispatcher): 整合司機審查面板至派單方儀表板"
```

---

## Phase 3：司機端調整

### Task 8: 司機端「申請接單」按鍵替換

**Files:**
- Modify: `src/components/driver/OrderCard.tsx`（或 `src/app/dashboard/driver/page.tsx`）

- [ ] **Step 1: 找到司機接單按鍵位置**

在司機 dashboard 的訂單卡上，尋找「接單」相關按鍵。

- [ ] **Step 2: 替換為「申請接單」**

原本「接單」按鍵改為「申請接單」，點擊呼叫 `POST /api/orders/[id]/apply`。

按完後：訂單從司機視角消失（變成 ASSIGNED 狀態）。

- [ ] **Step 3: 處理已申請狀態**

如果訂單狀態已經是 `ASSIGNED` 且 driverId 是自己，顯示「等待審核中」不可點擊。

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/driver/page.tsx
git commit -m "feat(driver): 司機改為申請接單模式"
```

---

## Phase 4：SSE 與狀態同步

### Task 9: 更新派單方 SSE（廣播 ASSIGNED 訂單）

**Files:**
- Modify: `src/app/api/drivers/events/route.ts`（或類似 SSE endpoint）

- [ ] **Step 1: 確認現有 SSE 邏輯**

找到派單方接收即時更新的 endpoint。

- [ ] **Step 2: 廣播 ASSIGNED 訂單給派單方**

當訂單變成 ASSIGNED 時，透過 SSE 通知派單方，出現「待處理」badge。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/drivers/events/route.ts
git commit -m "feat(sse): 派單方及時收到司機申請接單通知"
```

---

## 實作順序建議

```
Phase 1（AI解析改革）
  Task 1 → Task 2

Phase 2（核心審核 flow）
  Task 3 → Task 4 → Task 5 → Task 6 → Task 7

Phase 3（司機端）
  Task 8

Phase 4（同步）
  Task 9
```

---

## 待驗證假設

1. `accept route` 的 `updateMany` 搶單機制可以直接改造用於 `apply`
2. 派單方的 `dispatcher-approve` route 可以直接擴充 body 格式
3. 司機審查面板不需要新增 page，只在現有 dashboard 內 expand

## 尚未實作的周邊

- 司機索取詳細資訊的「聯繫派單方」訊息功能（Phase 4 或单独需求）
- 智慧排單候選恢復邏輯（當派單方拒絕時）
