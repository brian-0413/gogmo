# 司機端已完成行程列表 + 轉帳狀態同步

## 功能概述

在司機端「帳務中心」Tab 中，新增「已完成行程」列表，顯示派單方轉帳狀態，並透過 SSE 即時同步派單方的操作結果。

### 核心目標

- 司機可在帳務中心查看所有已完成行程
- 轉帳情形為唯讀，跟隨派單方操作自動同步
- 即時性：派單方更新後，司機頁面秒級更新

---

## 資料流

```
派單方點擊「已轉帳」
  → PATCH /api/orders/[id] { transferStatus: 'completed' }
  → DB updatedAt 變動
  → SSE polling 偵測變化
  → /api/dispatchers/events 廣播 ORDER_STATUS_CHANGE（含 transferStatus）
  → 派單方頁面更新 ✅

  → /api/drivers/events 廣播 TRANSFER_STATUS_CHANGE（含 transferStatus）
  → 司機頁面更新 ✅
```

---

## API 變更

### 1. `GET /api/drivers/completed-orders`（新增）

查詢司機已完成的所有訂單。

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "completedAt": "2026-04-05T14:00:00Z",
      "pickupLocation": "桃園機場",
      "dropoffLocation": "板橋市",
      "price": 1400,
      "dispatcher": { "companyName": "XX車隊" },
      "transferStatus": "pending" | "completed"
    }
  ]
}
```

### 2. `GET /api/drivers/events`（擴展）

新增事件類型：

```typescript
type DriverEvent =
  | { type: 'NEW_ORDER'; order: unknown }
  | { type: 'ORDER_STATUS_CHANGE'; orderId: string; status: string; ... }
  | { type: 'TRANSFER_STATUS_CHANGE'; orderId: string; transferStatus: string }
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'ORDER_CANCELLED'; orderId: string }
```

監聽條件：`driverId` = 司機 ID，且 `updatedAt` 變化的訂單中，`status` = `COMPLETED` 的訂單（這些是司機已完成但派單方可能還沒轉帳的）。

### 3. `GET /api/dispatchers/events`（調整）

在 `ORDER_STATUS_CHANGE` 事件中新增 `transferStatus` 欄位。

```typescript
type SSEEvent =
  | { type: 'HEARTBEAT'; timestamp: string }
  | { type: 'ORDER_STATUS_CHANGE'; orderId: string; status: string; transferStatus?: string; ... }
```

查詢條件調整：原本只監聽 `status: ['IN_PROGRESS', 'ARRIVED', 'Picked_UP', 'COMPLETED']`，改為監聽所有派單方的訂單（不限狀態），只要 `updatedAt` 有變化就廣播。

---

## 前端變更

### 司機端「帳務中心」Tab

在現有收益統計卡片（今日/本週/累積）下方，新增「已完成行程」摺疊區塊：

**展開時顯示表格：**

| 日期 | 起訖點 | 金額 | 派單人 | 轉帳情形 |
|------|--------|------|--------|----------|
| 04/05 14:00 | 桃園機場 → 板橋市 | NT$1,400 | XX車隊 | 派單人尚未轉帳 |
| 04/04 16:30 | 松山機場 → 中正區 | NT$1,200 | YY車隊 | 派單人已轉帳 |

**轉帳情形樣式：**
- `pending`：灰底灰字 `派單人尚未轉帳`
- `completed`：綠底綠字 `派單人已轉帳`
- **唯讀**：司機無法點擊編輯，只能看

**SSE 即時同步：**
- 收到 `TRANSFER_STATUS_CHANGE` 事件時，更新對應訂單的 `transferStatus`
- 畫面該列的轉帳情形立即變色

---

## 實作優先順序

1. `GET /api/drivers/completed-orders` API
2. 擴展 `/api/drivers/events` 加入 TRANSFER_STATUS_CHANGE
3. 調整 `/api/dispatchers/events` 加入 transferStatus 欄位
4. 司機端「已完成行程」列表 UI + SSE 接收

---

## 待確認 UX

- [x] 轉帳情形為唯讀，只能同步派單方操作
- [x] SSE 即時同步
- [x] 放在「帳務中心」Tab 的摺疊區塊內
- [x] 派單方端不需調整
