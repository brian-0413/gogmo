# 派單方審核司機接單 — 設計規格

## 1. 需求摘要

司機接單後，須經派單方審核同意，訂單才會正式生效並扣除司機點數。

## 2. 訂單狀態流程

```
司機接單 → ASSIGNED（等待派單方審核）
    ↓
派單方按「同意」→ ACCEPTED（正式接單，扣點）
派單方按「拒絕」→ PUBLISHED（回到池子，司機收到系統訊息）
```

## 3. 實作方案（方案 A — 推薦）

**資料模型**
- `Order.status ASSIGNED` — 現有，用於「等待派單方審核」
- `Order.driverId` — 司機 ID（已存在，接單時寫入）

**API 變更**
- `POST /api/orders/[id]/accept` — 司機接單後改為寫入 `ASSIGNED`，不扣點
- `POST /api/orders/[id]/dispatcher-approve` — 派單方同意：`ASSIGNED` → `ACCEPTED` + 扣點
- `POST /api/orders/[id]/dispatcher-reject` — 派單方拒絕：`ASSIGNED` → `PUBLISHED` + 清空 `driverId` + 發訊息給司機
- `GET /api/dispatcher/pending-approvals` — 取派單方所有 `ASSIGNED` 訂單（連同司機資料）

**Prisma 變更**
- 無需新增狀態，`ASSIGNED` 已是現有值

**派單方行控中心 UI**
- 新增「待同意」Tab，顯示所有 `ASSIGNED` 訂單
- 每張卡片顯示：司機姓名（只顯示名）、車號、車型是否符合（✅/❌）、三證（✅/❌）
- 操作按鈕：「同意」「拒絕」

**司機通知**
- 拒絕時，寫入系統訊息（透過現有 `messages` table）
- 司機在 `driver/page.tsx` 的訊息區塊讀取並顯示

## 4. 實作細節

### 4.1 司機接單 API（accept route）修改

- 司機送出接單申請 → 訂單狀態改為 `ASSIGNED`，`driverId` 寫入司機 ID
- 訂單**立即從接單大廳消失**（`PUBLISHED` 狀態才會出現在大廳）
- **不扣點，不寫 Transaction**
- 審核期間：司機行程中心**看不見**這張單
- 派單方拒絕：狀態回到 `PUBLISHED`，`driverId` 清空，司機收到系統訊息
- 派單方同意：狀態改為 `ACCEPTED`，正式進入司機行程中心

### 4.2 派單方行控中心 — 待同意區塊

- 位置：行控中心現有 Tab 之外，新增「待同意」Tab
- 顯示欄位：訂單編號、上下車地點、時間、司機姓名（只顯示名）、車號、車型是否符合（✅/❌）、三證（✅/❌）
- 操作：同意按鈕、拒絕按鈕
- 拒絕時理由為非必填

### 4.3 司機視角

- 送出接單申請後，大廳立即看不見這張單（狀態已非 `PUBLISHED`）
- 審核期間：行程中心看不見此單（不在 ACCEPTED/ARRIVED/IN_PROGRESS 清單中）
- 派單方同意：訂單出現於行程中心，狀態為 `ACCEPTED`
- 派單方拒絕：訊息區塊顯示「派單方拒絕了您的接單」+ 理由

### 4.4 時區規格（全系統唯一時間）

- 全系統統一使用台北時間（Asia/Taipei, UTC+8）
- 所有 API 輸入/輸出、資料庫儲存均以台北時間為準
- 前端 datetime-local input 無時區後綴，前後端轉換時手動附加 +08:00

### 4.5 逾時自動移除

- Cron Job（`/api/cron/lock-orders`）每 5 分鐘執行一次
- 邏輯：篩選 `scheduledTime + 寬限期（90 分鐘） < now` 且狀態仍為 `PUBLISHED`（沒人接單）的訂單
- 處理：狀態改為 `CANCELLED`，發訊息通知派單方「訂單已因逾時自動取消」
- 寬限期 90 分鐘可透過環境變數 `ORDER_EXPIRE_GRACE_MINUTES` 調整
