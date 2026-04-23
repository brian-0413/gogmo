# Claude Code 提示詞：批次匯入功能

> **複製以下內容，貼給 Claude Code 開發。**  
> 預估開發時間：1 天  
> 優先級：⭐⭐⭐⭐（高，可以快速減少派單方逐筆貼單的痛苦）

---

## 提示詞本體

```
請依照以下需求實作 gogmo 的「批次匯入訂單」功能。

## 背景脈絡
請先閱讀 docs/ai-rules/gogmo-order-skill/gogmo-order-format-spec.md，了解派單方目前的痛點：他們在 LINE 群裡會一次貼 10-50 筆訂單，但 gogmo 目前只能一筆一筆建立。批次匯入功能讓他們可以一次處理整批訂單。

## 功能需求

### 三種匯入來源

#### 1. 純文字貼上（最常用）
派單方直接複製整段 LINE 訊息貼進來，例如：

  4/19 桃機-接
  20:10 接 彰化社頭 1800
  18:55 接 彰化北斗 2000
  19:00 接 台中南屯 1800

系統呼叫現有的 parseOrder() 函式（在 lib/parser/）批次解析，回傳每筆訂單的解析結果。

#### 2. CSV / Excel 上傳
支援上傳 .csv / .xlsx 檔案，欄位為：
- 必填：date, time, type, location, price
- 選填：vehicle_type, flight_number, special_requirements

提供模板下載（GET /api/orders/import/template）。

#### 3. 從歷史訂單複製
顯示派單方過去 30 天的訂單列表，可勾選多筆「複製」為新訂單（修改日期後送出）。

### API 端點

POST /api/orders/import
- 入參：
  {
    source: 'text' | 'csv' | 'history',
    payload: string | File | string[] (orderIds),
    parseMode: 'strict' | 'lenient' (預設 lenient)
  }
- 回傳：
  {
    parseResults: [
      {
        rawSegment: string,
        parsedOrder: { ...六大欄位... } | null,
        parseStatus: 'accepted' | 'needs_review' | 'rejected',
        confidence: number,
        rejectionReasons: string[],
        rewriteSuggestion: string | null
      }
    ],
    summary: {
      total: number,
      accepted: number,
      needsReview: number,
      rejected: number
    }
  }

POST /api/orders/import/confirm
- 入參：經派單方確認 / 修改後的訂單陣列
- 邏輯：批次寫入資料庫，回傳建立的 order ids
- 重要：用 Prisma transaction，要嘛全成功要嘛全回滾

### UI 流程

#### Step 1: 選擇匯入來源
三個 tab：「貼上文字」/「上傳檔案」/「從歷史複製」

#### Step 2: 預覽解析結果
表格呈現所有解析後的訂單：
- 綠色列：accepted（可直接送出）
- 黃色列：needs_review（顯示低信心欄位，要求派單方確認）
- 紅色列：rejected（顯示 rewriteSuggestion，派單方可現場修正）

每列右側有「編輯」按鈕，可在彈窗中修正。

#### Step 3: 批次送出
派單方點「全部建立訂單」，系統執行 POST /api/orders/import/confirm。

#### Step 4: 結果摘要
「✅ 成功建立 18 筆，⚠️ 跳過 2 筆（缺價格）」+ 一鍵跳轉到「派單列表」。

### 規模限制
- 單次匯入上限：100 筆訂單
- 超過時 UI 提示：「請分批匯入，每次上限 100 筆」
- 後端強制檢查，避免被惡意攻擊

### 與 AI 解析整合
- text 來源直接呼叫 parseOrder()
- csv / xlsx 來源跳過 AI 解析，但仍套用 SKILL.md 的欄位驗證規則（在 lib/parser/validators.ts）
- history 來源直接複製欄位，不需要解析

## 測試需求
- 用 docs/ai-rules/gogmo-order-skill/references/real-examples.md 的 10 個案例當測試資料
- 測試「貼上 100 筆訂單」的效能（< 5 秒回傳）
- 測試 transaction 的 rollback 機制（模擬中途寫入失敗）

## 完成標準
1. 三種匯入來源都能跑通
2. UI 預覽頁能正確顯示三種顏色狀態
3. 100 筆訂單的解析效能 < 5 秒
4. 模板檔案能下載

請一次完成不要分批，最後寫一份簡短的 CHANGELOG.md 說明這次新增的內容。
```

---

## 給你的補充說明

- 這份功能會大量呼叫 Anthropic API（一次匯入 100 筆 = 100 次 API 呼叫）。建議：
  - 用 Claude Haiku（成本最低）
  - 考慮 batch processing（Anthropic 的 Message Batches API，可降 50% 成本）
- 完成後 spec.md 裡「批次匯入 🚧 即將推出」可以改成「批次匯入功能已上線」
- 模板下載建議放 public/templates/order-import-template.xlsx，方便靜態 serve
