# Claude Code 提示詞：自動合併重複訂單

> **複製以下內容，貼給 Claude Code 開發。**  
> 預估開發時間：0.5 天  
> 優先級：⭐⭐⭐⭐⭐（最高，這是「不收費控制濫貼」的核心機制）

---

## 提示詞本體

```
請依照以下需求實作 gogmo 的「自動合併重複訂單」功能。

## 背景脈絡
請先閱讀 docs/ai-rules/gogmo-order-skill/gogmo-order-format-spec.md 的「系統如何處理重複貼單」段落，以及 references/edge-cases.md 的陷阱 #9。

派單方的痛點：在 LINE 群裡訊息會被洗掉，所以他們習慣每隔 10-20 分鐘就把同一批訂單重貼一次。在 gogmo 上，這個行為會造成：
1. 同一筆訂單在資料庫變成 5 筆
2. 司機看到重複訂單會困惑
3. 系統資源浪費

設計理念：**讓重貼變得「沒意義」，而非用罰款懲罰行為。**

## 功能需求

### 重複偵測邏輯（核心）

新增 lib/orders/duplicateDetector.ts，提供函式：

  isDuplicate(newOrder: Order, existingOrders: Order[]): {
    isDuplicate: boolean;
    matchedOrderId?: string;
    similarity: number;  // 0.0 - 1.0
    matchedFields: string[];
  }

判定規則（all-AND，全部符合才算重複）：
1. 同一派單方（dispatcherId 相同）
2. 30 分鐘內建立（createdAt 差 < 30 min）
3. 以下欄位「全部相同」（normalized 後比對）：
   - date（精確相等）
   - time（精確相等）
   - type（pickup / dropoff / charter / transfer 相同）
   - location（去除空白標點後字串相等，或編輯距離 < 3）
   - price（精確相等，若都為 null 也算相同）

similarity 計算：
- 5/5 欄位相同 → 1.0
- 4/5 欄位相同 → 0.8（仍標 isDuplicate = true，但 UI 提示「類似訂單」）
- < 4/5 → isDuplicate = false

### 重複處理策略

新增 enum DuplicateAction：
- AUTO_MERGE（預設）：自動丟棄新的，保留既有的，回傳既有訂單 id
- WARN_AND_KEEP：保留新的，但前端顯示警告 banner
- ASK_USER：彈出對話框讓派單方選擇

在 DispatcherPreference 模型新增欄位：
- duplicateHandling: 'auto_merge' | 'warn_and_keep' | 'ask_user' @default('auto_merge')

### 整合到訂單建立流程

修改 POST /api/orders（建立訂單的端點）：

  // pseudocode
  const newOrder = parseInputToOrder(input);
  const recentOrders = await getRecentOrdersByDispatcher(dispatcherId, '30min');
  
  const dupCheck = isDuplicate(newOrder, recentOrders);
  
  if (dupCheck.isDuplicate) {
    const preference = await getPreference(dispatcherId);
    
    switch (preference.duplicateHandling) {
      case 'auto_merge':
        // 不建立新訂單，直接回傳既有訂單
        return { 
          status: 'merged', 
          orderId: dupCheck.matchedOrderId,
          message: '⚠️ 偵測到重複訂單，已自動合併' 
        };
      
      case 'warn_and_keep':
        const order = await createOrder(newOrder);
        return { 
          status: 'created_with_warning', 
          orderId: order.id,
          duplicateOf: dupCheck.matchedOrderId 
        };
      
      case 'ask_user':
        return { 
          status: 'requires_decision', 
          newOrder, 
          existingOrder: dupCheck.matchedOrderId 
        };
    }
  }
  
  return { status: 'created', orderId: created.id };

### 派單方端 UI

#### 訂單列表
- 重複合併的訂單，顯示「♻️ 已合併 N 次重複貼單」標記
- 點擊可看到合併歷史（時間戳列表）

#### Toast 通知
派單方貼上重複訂單時，顯示 Toast：
「⚠️ 這筆訂單已在派單中（30 分鐘前建立），系統已自動合併。司機若有興趣會主動聯繫。」

#### 設定頁
派單偏好新增「重複訂單處理」選項：
- 自動合併（推薦，預設）
- 保留並警告
- 每次詢問

### 後台統計

新增 GET /api/admin/duplicate-stats（僅管理員）：
- 取得最近 7 天的「重複貼單統計」
- 排序派單方的重複次數，找出濫貼者
- 為未來「信譽分數」功能鋪路

## 測試需求
- 測試 30 分鐘邊界：29:59 算重複，30:01 不算
- 測試 location 編輯距離：「大安區信義路」vs「大安區信義路四段」應算重複
- 測試三種 duplicateHandling 行為差異
- 測試「不同派單方貼相同訂單」不應算重複（避免誤判）

## 完成標準
1. 自動合併行為符合預期（不建立資料庫重複紀錄）
2. UI 有合併標記 + Toast 通知
3. 派單偏好設定頁可切換三種模式
4. 後台統計頁能看到重複次數排行
5. 跑 npm run test 全綠

請一次完成不要分批，最後寫一份簡短的 CHANGELOG.md 說明這次新增的內容。
```

---

## 給你的補充說明

- **這份是四個提示詞中最重要的一份**。沒有這個，你的「不收費控制濫貼」策略就沒辦法實現
- 30 分鐘的窗口是經驗值，可以先設這個，之後根據實際數據調整
- 後台統計頁先做簡單版即可，未來「信譽分數」功能才需要完整的儀表板
- 完成後 spec.md 裡「自動合併」就從規劃變成已實裝
