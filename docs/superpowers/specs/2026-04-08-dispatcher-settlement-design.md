# 派單方帳務中心（結算系統）設計規格

## 1. 功能定位

幫派單方快速對帳用。派單方每天派很多單，需要一個工具讓他們清楚知道：
- 哪些行程已完成？
- 該付多少錢給哪位司機？
- 哪些已經轉帳了？哪些還沒轉？

## 2. 現有基礎

派單方後台已有一個「結算」Tab（`SettlementTab.tsx`），包含基本的日期篩選和轉帳清單。本規格在現有基礎上加強 Stats 區塊和轉帳操作邏輯。

## 3. 資料說明

- **轉帳金額**：顯示派單方當初派單的「全額」，與司機的 5% 平台費無關（平台費以司機「儲值」方式收取）
- **轉帳標記**：派單方手動標記「已轉帳」後，系統通知司機，不可撤回

## 4. UI 設計

### 4.1 Stats 區塊（6 格）

| 格 | 標題 | 內容 |
|----|------|------|
| 1 | 完成行程 | 該區間已完成行程總筆數 |
| 2 | 總派車金額 | 該區間所有完成行程的金額總和（NT$） |
| 3 | 待轉帳筆數 | transferStatus = pending 的筆數 |
| 4 | 待轉帳金額 | 待轉帳筆數的金額總和（NT$） |
| 5 | 已轉帳筆數 | transferStatus = completed 的筆數 |
| 6 | 已轉帳金額 | 已轉帳筆數的金額總和（NT$） |

### 4.2 篩選工具列

- 日期區間：起始日期 + 結束日期（input type="date"）
- 快速按鈕：今日、近7天、近30天
- 轉帳狀態篩選：全部 / 待轉帳 / 已轉帳（下拉選單）

### 4.3 轉帳清單表格

| 欄位 | 說明 |
|------|------|
| 單號 | 訂單編號（#YYYYMMDD-XXXX 格式） |
| 司機姓名 | 司機名稱 |
| 車牌 | 車牌號碼 |
| 完成日期 | 行程完成時間（MM/dd HH:mm） |
| 司機銀行帳號 | 銀行代碼 + 帳號末3碼（隱碼：XXX****YYY） |
| 金額 | 全額 NT$（font-mono-nums） |
| 轉帳狀態 | 按鈕（見下節） |

### 4.4 轉帳狀態按鈕邏輯

**待轉帳狀態（可點擊）**：
- 顯示「待轉帳」（橙色按鈕）
- 點擊後彈出確認對話：「確定已轉帳 NT$X,XXX 給司機 XXX 嗎？此操作無法撤銷。」
- 確認後：
  1. API 更新 transferStatus = 'completed'
  2. **發送通知給司機**（告知款項已轉帳）
  3. 按鈕改為灰色鎖定狀態

**已轉帳狀態（鎖定，不可逆）**：
- 顯示「已轉帳」（綠色，disabled）
- 按鈕不可點擊，無論如何都無法還原
- 目的是杜絕派單方已轉帳卻標示未轉帳、或來回修改造成司機對帳困難

### 4.5 下載 Excel

- 按鈕：下載 Excel
- 匯出欄位：單號、完成日期、司機姓名、車牌、金額（NT$）、銀行代碼、銀行帳號（末4碼隱碼）、轉帳狀態
- 檔名：`轉帳清單_YYYYMMDD_YYYYMMDD.xlsx`

## 5. API 設計

### GET /api/dispatchers/settlement

現有端點，加強回傳資料。

**Query Parameters**：
- `startDate`：起始日期（YYYY-MM-DD）
- `endDate`：結束日期（YYYY-MM-DD）

**回應**：
```json
{
  "success": true,
  "data": {
    "completedOrdersCount": 25,
    "totalAmount": 68000,
    "pendingCount": 8,
    "pendingAmount": 24000,
    "completedCount": 17,
    "completedAmount": 44000,
    "orders": [
      {
        "id": "uuid",
        "orderDate": "20260408",
        "orderSeq": 1,
        "price": 1200,
        "completedAt": "2026-04-08T14:30:00.000Z",
        "transferStatus": "pending" | "completed",
        "driver": {
          "user": { "name": "王小明" },
          "licensePlate": "XXX-1234",
          "bankCode": "012",
          "bankAccount": "1234567890"
        }
      }
    ]
  }
}
```

### POST /api/dispatchers/settlement/transfer

按下「已轉帳」時呼叫。

**Request Body**：
```json
{
  "orderId": "uuid"
}
```

**行為**：
1. 更新該筆訂單 `transferStatus = 'completed'`
2. 發送通知給司機（in-app 通知或未來推播）
3. 回傳成功

**Response**：`{ success: true, data: { message: "已標記為已轉帳" } }`

## 6. 待實作項目

- [ ] API：加強 `/api/dispatchers/settlement` 回應（新增 pendingAmount、completedAmount 等欄位）
- [ ] API：新增 `POST /api/dispatchers/settlement/transfer` 端點（含通知司機）
- [ ] 前端：Stats 區塊改為 6 格（含金額統計）
- [ ] 前端：新增轉帳狀態篩選下拉選單
- [ ] 前端：「已轉帳」改為不可逆按鈕（灰色鎖定）
- [ ] 前端：按下「已轉帳」時彈出確認對話 + API 呼叫
- [ ] 前端：下載 Excel 更新含銀行帳號欄位
