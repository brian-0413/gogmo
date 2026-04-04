# 司機行程狀態更新規格

## 功能概述

司機接單後，可在手機上逐步更新訂單執行狀態（開始 → 抵達 → 客上 → 客下），派單方行控中心的卡片即時同步顯示進度燈號。

### 核心目標

- 司機操作直覺：4鍵依序執行，全螢幕專注畫面
- 派單方掌控：行控中心一眼看到司機當前在哪個階段
- 數據沉澱：每步時間戳記可用於回顧與分析

---

## 司機端畫面流程

### 1. 行程列表（我的行程 Tab）

司機點擊任一行程卡片 → 進入訂單詳情頁（全螢幕替換）

列表卡片狀態徽章即時更新：
- ACCEPTED → 「已接單」（橘色 `#F59E0B`）
- IN_PROGRESS（已開始後）→ 「進行中」（藍色 `#0C447C`）+ 亮燈
- ARRIVED → 「已抵達」（藍色 `#0C447C`）
- COMPLETED → 「已完成」（綠色 `#008A05`）

### 2. 訂單詳情頁（全螢幕）

司機點擊卡片後進入，佔滿手機螢幕，可滑回列表。

#### Header
```
← 返回
```

#### Body
```
#YYYYMMDD-XXXX           ← 單號（全寬黑底白字橫幅）

●───○───○───○           ← 進度條
開始  抵達  客上  客下

04/01 (二) 14:00  接機
桃園機場 → 板橋市
乘客：王小明
2人 / 2件行李

📞 0912-345-678   ← 點擊可撥號
BR123
```

#### 按鈕列
```
[取消退單] [ 開始 ] [ 抵達 ] [ 客上 ] [ 客下 ]
```

### 3. 按鈕邏輯

#### 狀態鎖定（3小時門檻）

| 當前狀態 | 行程距開車時間 | 退單 | 開始 | 抵達 | 客上 | 客下 |
|----------|---------------|------|------|------|------|------|
| ACCEPTED | ≥3 小時 | 可點 | 反白 | 反白 | 反白 | 反白 |
| ACCEPTED | <3 小時 | 反白 | 可點 | 反白 | 反白 | 反白 |
| IN_PROGRESS | — | 反白 | — | 可點 | 反白 | 反白 |
| ARRIVED | — | 反白 | — | — | 可點 | 反白 |
| PICKED_UP | — | 反白 | — | — | — | 可點 |

#### 4鍵依序執行規則

- 只有前一步完成，後面的按鈕才會亮起
- 不可跳步（未按「開始」就不能按「抵達」）
- 「客下」按下去後跳出確認視窗：「確認已抵達目的地？行程將標記為完成並計入帳務。」

#### 「客下」完成後

- 狀態變更為 COMPLETED
- `completedAt` 寫入資料庫
- 自動歸入帳務中心（司機端、派單方端）
- 畫面顯示「行程已完成」提示，2秒後自動返回列表

---

## 派單方行控中心

### 卡片進度條（取代狀態徽章）

每張已接單的卡片顯示4格進度燈號：

```
#20260401-001
●───●───○───○   司機：王大明
開始  抵達  客上  客下

04/01 (二) 14:00  接機  NT$1,400
桃園機場 → 板橋市
```

### 燈號含義

| 符號 | 狀態 | 意義 |
|------|------|------|
| ●（亮起） | 已執行 | 司機已按過該按鈕 |
| ○（暗起） | 未執行 | 尚未執行該步驟 |
| ○（閃爍） | 即將亮起 | 司機剛按了前一鍵，該燈即將亮起（動畫提示） |

### 即時同步

- 使用 SSE（Server-Sent Events）推播，派單方行控中心實時接收狀態更新
- 當司機按「開始」，派單方卡片「開始」燈號立即亮起
- 不需手動刷新頁面

---

## 資料庫變更

### Prisma Schema 異動

```prisma
model Order {
  // ... 現有欄位 ...

  // 狀態時間戳記（新增）
  startedAt    DateTime?  // 司機按「開始」
  arrivedAt   DateTime?  // 司機按「抵達」
  pickedUpAt   DateTime?  // 司機按「客上」

  // 注意：completedAt 已存在
}

// OrderStatus 新增一個狀態
enum OrderStatus {
  PENDING      // 待審核（草稿）
  PUBLISHED    // 已發布
  ASSIGNED     // 已指派司機
  ACCEPTED     // 司機已接單
  IN_PROGRESS  // 行程開始（司機按開始）
  ARRIVED      // 已抵達（司機按抵達）
  PICKED_UP    // 乘客已上車（司機按客上）
  COMPLETED    // 已完成
  CANCELLED    // 已取消
}
```

### 狀態流程圖

```
ACCEPTED → IN_PROGRESS → ARRIVED → PICKED_UP → COMPLETED
  (接單)     (開始)      (抵達)     (客上)      (客下)
                              ↘ (拒絕/退單) → PUBLISHED
```

---

## API 變更

### 現有 API 修改

#### `PATCH /api/orders/[id]`

擴展 `_action = 'status'` 的行為：

```typescript
// 新增支援的狀態值
const validTransitions: Record<string, string[]> = {
  ACCEPTED: ['IN_PROGRESS'],  // 原本是 ARRIVED
  IN_PROGRESS: ['ARRIVED'],
  ARRIVED: ['PICKED_UP'],
  PICKED_UP: ['COMPLETED'],
  COMPLETED: [],
}

// 每個狀態寫入對應時間戳記
if (status === 'IN_PROGRESS') updateData.startedAt = new Date()
if (status === 'ARRIVED')    updateData.arrivedAt = new Date()
if (status === 'PICKED_UP')  updateData.pickedUpAt = new Date()
```

#### 新增 API

**`POST /api/orders/[id]/status`**（專用於司機狀態更新）

可替代 PATCH，語義更清晰。

Request:
```json
{
  "action": "start" | "arrive" | "pickup" | "complete"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "orderId": "xxx",
    "status": "IN_PROGRESS",
    "startedAt": "2026-04-01T14:00:00Z",
    "nextAction": "arrive" // 下一個可執行的動作提示
  }
}
```

### SSE 推播

**`GET /api/dispatchers/events`**（派單方用）

新增事件類型：

```typescript
type DriverEvent =
  | { type: 'ORDER_STATUS_CHANGE'; orderId: string; status: string; timestamp: string }
  | ...
```

派單方行控中心接收 `ORDER_STATUS_CHANGE` 事件後，更新卡片燈號。

---

## 實作檔案清單

### 前端

| 檔案 | 變更內容 |
|------|---------|
| `src/app/dashboard/driver/page.tsx` | 列表中 ACCEPTED 卡片有「進入詳情」按鈕 |
| `src/app/dashboard/driver/order/[id]/page.tsx` | **新增** — 訂單詳情全螢幕頁面 |
| `src/app/dashboard/dispatcher/page.tsx` | 卡片加入進度條燈號，接收 SSE 更新 |
| `src/components/driver/OrderDetailActions.tsx` | **新增** — 4鍵按鈕列（含狀態邏輯） |
| `src/components/driver/ProgressBar.tsx` | **新增** — 進度條元件（司機端 + 派單方共用） |
| `src/types/index.ts` | OrderStatus 加入 IN_PROGRESS/ARRIVED/PICKED_UP |
| `src/lib/utils.ts` | 時間格式化 helper |

### 後端

| 檔案 | 變更內容 |
|------|---------|
| `src/app/api/orders/[id]/route.ts` | PATCH status 擴展支援新狀態 + 時間戳記 |
| `src/app/api/orders/[id]/status/route.ts` | **新增** — 專用狀態更新端點 |
| `src/app/api/dispatchers/events/route.ts` | 新增 ORDER_STATUS_CHANGE 推播事件 |
| `prisma/schema.prisma` | Order model 新增 startedAt/arrivedAt/pickedUpAt 欄位 |

### 設計

| 檔案 | 變更內容 |
|------|---------|
| `src/app/dashboard/driver/order/[id]/page.tsx` | 進度條 4 格，● = 已亮，○ = 未亮 |
| 派單方卡片 | 進度條取代狀態徽章文字 |

---

## 時間戳記用途

| 欄位 | 意義 | 用途 |
|------|------|------|
| `startedAt` | 司機出發時間 | 司機回顧、派單方掌控、效率分析 |
| `arrivedAt` | 司機抵達上車點時間 | 同上 |
| `pickedUpAt` | 乘客上車時間 | 同上 |
| `completedAt` | 行程完成時間 | 已有，計入帳務 |

---

## 開發優先順序

1. Prisma schema 異動 + `npm run db:push`
2. API：狀態端點支援新狀態 + 時間戳記寫入
3. API：SSE 推播 ORDER_STATUS_CHANGE
4. 前端：司機端訂單詳情頁（進度條 + 4鍵按鈕）
5. 前端：派單方行控中心卡片進度條 + SSE 接收
6. 串接：司機按鈕 → API → SSE → 派單方燈號亮起
7. 完整測試

---

## 待確認 UX 細節

- [x] 司機按「客上」後：保持當前畫面，只有「客下」亮起
- [x] 訂單詳情頁：全螢幕替換，非 Bottom Sheet
- [x] 行程列表：不可快速切換其他行程，需返回後再點
- [x] 返回列表：不需要確認
- [x] 「客下」：需要確認視窗
- [x] 乘客電話：顯示且可點擊撥號
- [x] 進度條：司機端和派單方端都要有
- [x] 派單方燈號：閃爍提示下一燈即將亮起
- [x] 時間戳記：記錄每步時間
