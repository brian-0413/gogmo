# Claude Code 提示詞：派單偏好功能

> **複製以下內容，貼給 Claude Code 開發。**  
> 預估開發時間：0.5-1 天  
> 優先級：⭐⭐⭐（中，做完能讓派單方少打很多字）

---

## 提示詞本體

```
請依照以下需求實作 gogmo 的「派單偏好」功能。

## 背景脈絡
請先閱讀 docs/ai-rules/gogmo-order-skill/gogmo-order-format-spec.md 與 gogmo-order-skill/references/edge-cases.md（陷阱 #8：全域預設價）。

派單方的痛點：在 LINE 訊息開頭常寫「任意R $700」當作整批的預設值，下面個別訂單只標特殊情況。但 AI 解析時刻意「不繼承」這個預設值（為了減少誤判）。派單偏好功能讓派單方可以一次設定預設值，不用每筆都重複寫。

## 功能需求

### 資料模型

新增 DispatcherPreference 模型：
- id: String @id @default(cuid())
- dispatcherId: String @unique（對應 User）
- defaultVehicleType: String?（小車 / 大車 / 休旅...）
- defaultLicenseType: String?（R / TR / any_R）
- defaultPrice: Int?（預設價格）
- defaultAirport: String?（TPE / TSA / KHH...）
- driverRequirements: Json?（陣列：['no_smoking', 'speak_taiwanese', ...]）
- paymentMethod: String?（customer_pays / bank_transfer）
- batchPriceMode: 'inherit' | 'override' | 'off'
  - inherit：個別訂單沒寫價格時，套用 defaultPrice
  - override：強制所有訂單套用 defaultPrice，個別訂單寫的價格被覆蓋（少見）
  - off：完全不套用（預設）
- updatedAt: DateTime @updatedAt

### API 端點

GET /api/preferences
- 取得當前派單方的偏好設定
- 若無紀錄，回傳全 null 預設值

PUT /api/preferences
- 更新偏好設定
- 入參：DispatcherPreference 部分欄位
- 回傳：更新後的完整偏好

DELETE /api/preferences
- 重置為預設（全部 null）

### UI 需求

設定頁面 /app/settings/dispatcher-preferences：

1. **預設車型** dropdown：小車 / 大車 / 休旅 / 九座 / 不指定
2. **預設牌照類型** dropdown：R / TR / 任意R
3. **預設機場** dropdown：桃園 TPE / 松山 TSA / 高雄 KHH / 台中 RMQ
4. **預設價格** number input + 模式選擇：
   - 「沒寫價格時自動套用」（inherit）
   - 「強制套用，覆蓋個別訂單」（override，警告紅字）
   - 「不套用」（off，預設）
5. **司機要求** checkbox 多選：無菸 / 會台語 / 有 ETC / 不要新手
6. **結帳方式** radio：客人現金 / 客人匯款 / 派單方代收

每個欄位旁邊有 ⓘ 圖標，hover 顯示「此設定如何影響你的訂單建立」。

### 與訂單建立流程整合

#### 在「新增訂單」表單中
若派單方有設定偏好，表單欄位**自動預填**該偏好值，但派單方仍可在當下修改。

#### 在 AI 解析訊息時
修改 lib/parser/parseOrder.ts：
- 解析完成後，對於 confidence < 0.7 或缺欄位的訂單，若派單方有對應偏好，套用偏好值並把 confidence 設為 0.85
- 例如：訂單缺 vehicleType，派單方偏好為「小車」，則自動填入「小車」，confidence 0.85，並在 raw 標註「(來自派單偏好)」

#### batchPriceMode 處理
- inherit：parseOrder 偵測到「價格欄位缺失」時，套用 defaultPrice
- override：parseOrder 強制覆蓋所有訂單的價格（會在 UI 顯示紅色警告 banner）
- off：parseOrder 行為不變，缺價格仍 reject

## 重要設計考量

派單偏好的「預設價格繼承」與 SKILL.md 中嚴禁的「全域預設價繼承」**不衝突**：
- SKILL.md 禁止的：從訊息文字中推測（如開頭 `任意R $700`）→ 風險高
- 派單偏好允許的：派單方主動在設定頁宣告 → 風險可控

請在 UI 上明確告訴派單方：「設定預設價後，你的訊息可以省略價格欄位，AI 會自動補上你設定的價格」。

## 測試需求
- 測試三種 batchPriceMode 行為差異
- 測試「派單方無偏好設定」時，行為與現在一致（不影響現有用戶）
- 測試「設定預設車型 = 小車後，貼純文字訂單」時，車型自動填入

## 完成標準
1. 派單方可以在設定頁完整設定所有偏好
2. 新增訂單表單會根據偏好預填欄位
3. AI 解析會在缺欄位時套用偏好值
4. 跑 npm run test 全綠

請一次完成不要分批，最後寫一份簡短的 CHANGELOG.md 說明這次新增的內容。
```

---

## 給你的補充說明

- 這個功能上線後，要同步更新 SKILL.md 的「嚴格禁止事項」段落，補一句：「但若派單方在設定頁明確設定了預設值，可以套用（信心 0.85）」
- 完成後可以拿掉 spec.md 的「派單偏好 🚧 即將推出」標記
- batchPriceMode 的「override」模式很危險（可能蓋掉派單方臨時改的價格），建議 UI 設計成需要二次確認才能切換
