# Claude Code 提示詞：一鍵加價 + 加價單列表 + 防剝削機制

> **複製以下內容，貼給 Claude Code 開發。**  
> 預估開發時間：2-3 天（含防剝削機制）  
> 優先級：⭐⭐⭐⭐⭐（最高，這是「重複貼單」的替代方案，是平台核心競爭力）

---

## 提示詞本體

```
請依照以下需求實作 gogmo 的「一鍵加價」功能，包含完整的防剝削機制。

## 背景脈絡
請先閱讀 docs/ai-rules/gogmo-order-skill/gogmo-order-format-spec.md 的「一鍵加價」段落。

簡言之：派單方常會發出沒人接的單，傳統做法是「重複貼單」騷擾司機。我們改為「一鍵加價」—— 派單方可以提高訂單價格，吸引司機在「加價單列表」優先挑選。

但加價機制有「先低價搶置頂、再加價回正常價」的剝削風險，必須設計嚴謹的防範機制。

## 功能需求

### 資料模型

Order 模型新增欄位：
- originalPrice: Int（訂單建立時的原始價格，永久不變）
- currentPrice: Int（目前價格 = originalPrice + 累積加價）
- isSurge: Boolean @default(false)（是否為加價單）
- surgeEnabled: Boolean @default(true)（是否允許加價，false = 永久禁用加價）
- surgeCount: Int @default(0)（已加價次數，上限 3）
- scheduledAt: DateTime（訂單預定時間，用於計算「6 小時內」啟用加價按鈕）

新增 OrderSurgeHistory 模型：
- id: String @id @default(cuid())
- orderId: String
- previousPrice: Int
- surgeAmount: Int（這次加價多少，例：+50）
- newPrice: Int（加價後新價格）
- surgedAt: DateTime @default(now())
- surgedBy: String（派單方 userId）

新增 RegionPriceStats 模型（用於價格下限保護）：
- id: String @id @default(cuid())
- region: String（區域，例：「大安區」）
- timeSlot: String（時段，例：「night_pickup」夜間接機）
- airport: String?（機場代碼，可為 null）
- vehicleType: String?（車型）
- avgPrice: Int（歷史平均價）
- sampleSize: Int（樣本數）
- updatedAt: DateTime @updatedAt
- @@unique([region, timeSlot, airport, vehicleType])

### 加價按鈕的啟用條件

新增 lib/orders/surgeEligibility.ts：

  function canSurge(order: Order): {
    canSurge: boolean;
    reason?: string;
  } {
    // 檢查 1：訂單必須未被司機接單
    if (order.status !== 'PENDING') {
      return { canSurge: false, reason: 'ORDER_ALREADY_TAKEN' };
    }
    
    // 檢查 2：必須在預定時間前 6 小時內
    const hoursUntilScheduled = (order.scheduledAt - now()) / 3600000;
    if (hoursUntilScheduled > 6) {
      return { canSurge: false, reason: 'TOO_EARLY' };  // UI 顯示「預定時間前 6 小時可啟用加價」
    }
    
    // 檢查 3：必須未過期
    if (hoursUntilScheduled < 0) {
      return { canSurge: false, reason: 'EXPIRED' };
    }
    
    // 檢查 4：surgeEnabled 必須為 true（低價陷阱保護，見下方）
    if (!order.surgeEnabled) {
      return { canSurge: false, reason: 'SURGE_DISABLED_LOW_PRICE' };
    }
    
    // 檢查 5：surgeCount < 3
    if (order.surgeCount >= 3) {
      return { canSurge: false, reason: 'MAX_SURGE_REACHED' };
    }
    
    return { canSurge: true };
  }

### API 端點

POST /api/orders/[id]/surge
- 入參：{ surgeAmount: number }（建議值：50, 100, 200，自訂金額也可）
- 邏輯：
  1. 呼叫 canSurge() 驗證
  2. 在 transaction 中：
     - 寫入 OrderSurgeHistory
     - 更新 order.currentPrice += surgeAmount
     - 更新 order.surgeCount++
     - 更新 order.isSurge = true
     - 推播通知所有相關司機：「💰 加價單通知：[區域][類型] 現價 [新價]」
  3. 回傳更新後的 order

GET /api/orders/[id]/surge-history
- 取得該訂單的完整加價歷史（給司機端展示透明度）

GET /api/orders/surge-list
- 取得所有目前加價中的訂單
- 按「加價幅度」排序（surgeAmount 累計值大者在前）
- 司機端「💰 加價單列表」分頁使用

### 防剝削機制（重點）

#### 機制 1：價格下限保護

在訂單建立時呼叫 lib/orders/priceFloorChecker.ts：

  async function checkPriceFloor(order: NewOrder): Promise<{
    isBelow: boolean;
    floorPrice: number;
    avgPrice: number;
    suggestion: string;
  }> {
    // 1. 根據 order 的 region/timeSlot/airport/vehicleType 查詢 RegionPriceStats
    // 2. 取得 avgPrice
    // 3. floorPrice = avgPrice * 0.8
    // 4. 若 order.price < floorPrice：
    //    - 標 surgeEnabled = false（永久禁用該訂單的加價功能）
    //    - 在 UI 顯示警告：「您的價格 X 低於該區域均價 Y 的 80%」
    //    - 派單方仍可堅持發單，但無法後續加價
  }

呼叫時機：
- POST /api/orders 建立訂單時
- 派單方在 UI 輸入價格時即時呼叫（GET /api/orders/price-check）顯示提示

#### 機制 2：加價歷史完全公開

司機端的訂單詳情頁，若 isSurge == true，必須顯示：

  「📈 此訂單為加價單」
  
  加價歷史：
  ┌────────────────────────────────────┐
  │ 原價：NT$ 600                       │
  │ +50 (4/19 16:00) → NT$ 650          │
  │ +100 (4/19 18:00) → NT$ 750         │
  │ ────────────────────────────────── │
  │ 現價：NT$ 750                       │
  └────────────────────────────────────┘

司機可以看到完整脈絡，自行判斷是否為健康定價或低價陷阱。

#### 機制 3：加價次數上限 = 3

在 canSurge() 已實作。第 4 次加價會被擋。

UI 提示：「此訂單已加價 3 次（上限），無法再加價」

#### 機制 4：加價單比例監控（後台）

新增 cron job（每日 0:30 執行）：
- 計算每位派單方近 7 日的「加價單筆數 / 總訂單數」
- 若比例 > 30%，標記為「異常加價傾向」
- 在派單方 App 內顯示提示卡片：
  「🔍 您近 7 日有 X% 訂單需要加價才能成交，這可能表示初始定價偏低。建議查看區域均價，調整定價策略以提升司機接單意願」
- 同時記入「信譽分數」扣分項（信譽分數功能上線後生效）

### UI 需求

#### 派單方端

**1. 行程卡片右上角的「💰 加價」按鈕**

訂單列表中每張訂單卡片，在右上角顯示加價按鈕。按鈕狀態：

| 狀態 | 顯示 | 互動 |
|---|---|---|
| 可加價（時間 < 6 小時且 surgeEnabled） | `💰 加價` 金色按鈕 | 可點擊，彈出加價選單 |
| 太早（時間 > 6 小時） | `🕐 預定前 6 小時可加價` 灰色 | 不可點擊 |
| 已加價 3 次 | `💰 已加滿（3/3）` 灰色 | 不可點擊 |
| surgeEnabled = false（低價） | `🚫 此訂單無法加價` 灰色 + ⓘ tooltip | 不可點擊，hover 顯示原因 |
| 訂單已被接單 | 不顯示按鈕 | - |

**2. 加價彈窗**

點擊「💰 加價」後彈出：
```
為訂單加價
原價：NT$ 600 → 現價：NT$ 600

[+50]  [+100]  [+200]  [自訂]

加價後現價將顯示為：
NT$ 650 / NT$ 700 / NT$ 800

⚠️ 加價後的現價會公開給司機看到完整加價歷史
   每張訂單最多加價 3 次，目前已加價 0/3 次

[取消]  [確認加價]
```

**3. 訂單列表的加價標記**

加價中的訂單，卡片邊框改為金色，並顯示「💰 加價中」標籤。

#### 司機端

**1. 主要訂單列表**

加價單在主列表中也顯示，但旁邊加 `💰 +150` 標籤（顯示總加價金額）。

**2. 「💰 加價單」獨立分頁**

- 司機 App 底部 navigation 新增「💰 加價單」分頁
- 顯示所有目前的加價單，按加價幅度排序
- 紅點通知：有新加價單時顯示

**3. 加價單詳情頁**

點擊任一加價單，顯示：
- 完整訂單資訊
- 「📈 加價歷史」section（必顯示，不可隱藏）
- 「接單」按鈕

### 整合 - 讓加價單推播給對的人

當訂單被加價時，推播給以下司機：
- 該訂單地理區域（半徑 20 公里）內的活躍司機
- 該訂單時段內可接單的司機（檢查司機的 availableSlots）
- 推播訊息範例：「💰 加價單：4/19 22:10 桃機接機 大安區，現價 NT$ 950（原 NT$ 800）」

## 測試需求
- 測試「6 小時邊界」：5:59 之前可加價、6:01 之後不可
- 測試「加價 3 次後第 4 次被擋」
- 測試「低價訂單 surgeEnabled = false 後永久不能加價」
- 測試「加價歷史正確記錄並公開」
- 測試「加價單列表按加價幅度排序」
- 測試「加價單比例 > 30% 觸發後台警示」

## 完成標準
1. 派單方可以在訂單卡片右上角點加價按鈕
2. 6 小時時間窗正確生效
3. 低於區域均價 80% 的訂單無法加價
4. 司機端有獨立「加價單」分頁
5. 加價歷史完整公開
6. 跑 npm run test 全綠

請一次完成不要分批，最後寫一份簡短的 CHANGELOG.md。
```

---

## 給你的補充說明

**這份提示詞做完後，你的「不收費控制濫貼」策略才算完整**：
- 派單方再也不需要「重貼訂單」吸引司機（重複合併會擋掉）
- 派單方有正當管道（加價）讓難派單變得有吸引力
- 防剝削機制保護司機不被「低價陷阱」騙

**RegionPriceStats 的初始資料怎麼來？**：
- 第一週可以手動 seed 一些常見區域的均價（用你 GoodFriend 既有資料）
- 之後系統自動累積，每日 cron 重算
- 樣本數 < 30 時，floorPrice 暫時放寬到 0（不啟用下限保護），避免冷啟動誤殺

**加價推播會不會打擾司機？**：
- 建議加上「加價單推播偏好」設定，司機可選擇：
  - 全部加價單都通知
  - 只通知 +100 以上的
  - 只通知 +200 以上的
  - 完全關閉（自己去加價分頁看）
- 這部分如果想做可以加進提示詞，但目前不寫以免提示詞太長

**完成後 spec.md 裡「一鍵加價」段落從規劃變實裝**。
