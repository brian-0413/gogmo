---
name: gogmo-order-parser
description: Parse airport transfer order messages from LINE-style dispatcher inputs into structured gogmo orders. Use this skill whenever the user provides Taiwan airport transfer dispatch messages (派單訊息), LINE group order text, or any text containing 接機/送機/桃機/小車/大車 patterns that need to be converted into structured order data. Also use when the user wants to validate, reformat, or rewrite messy dispatch messages into gogmo standard format. The skill handles strict parsing per gogmo specification AND generates "standard format" rewrites to gradually educate dispatchers toward the platform's preferred format.
---

# gogmo Order Parser

把派單方在 LINE 風格貼上來的訊息，解析成 gogmo 結構化訂單。

## 設計哲學

**這個 skill 不是萬能解析器**。它的目標不是「無論派單方怎麼亂貼都解析出來」，而是：

1. **嚴格依照 [gogmo 標準格式](./references/gogmo-order-format-spec.md)** 解析合規訊息（fast path）
2. **對不合規訊息「友善退回」**：生成「改寫後的標準格式」回饋給派單方，潛移默化教育（slow path）
3. **拒絕做過度推測**：不猜「明天 = 哪天」、不繼承「全域預設價」、不合併「一套不拆」

換句話說，**解析的成本不該由平台承擔，應該由派單方學習標準格式來消除**。

## 核心解析流程

對於每一段輸入訊息，依序執行：

### Step 1: 雜訊過濾

直接丟棄以下訊息片段（不嘗試解析，但記錄到 `noise_filtered`）：
- 群組廣告：含 `✈️包車找我`、`好友已🈵`、`接單@後私訊` 等行銷詞
- 系統訊息：`xxx 已退出群組`、`xxx 加入群組`
- 純表情或貼圖文字
- 空白行

### Step 2: 分塊（Segmentation）

把訊息切成**訂單塊**。分塊規則：
- **空行** = 強分隔符
- **時間戳開頭**（如 `15:33 小鈺 ...`）= LINE 訊息分界，前面 `15:33` 是發送時間（**不是訂單時間**），要剝離
- **`==========` `--------` `....` 等分隔線** = 訂單群組分界
- **編號開頭**（`A2`、`(1)`、`=1-2=`）= 訂單編號，保留作為 `dispatcher_ref`

### Step 3: 嚴格格式檢查

對每個訂單塊，檢查是否符合 [gogmo 標準格式](./references/gogmo-order-format-spec.md)：

**必填五欄位**：
1. `date`：必須是明確日期（`4/19`、`2026/4/19`），**禁止接受**「明天/後天/今晚」等相對日期
2. `time`：必須是 24 小時制 `HH:MM`，**禁止接受**「早上/晚上/七點半」
3. `type`：必須是 `接機 / 送機 / 包車 / 接駁` 之一
4. `location`：必須有區級以上具體地點
5. `price`：必須是純數字

**選填三欄位**：`vehicle_type`、`flight_number`、`special_requirements`

### Step 4: 信心評分

每個欄位給 confidence（0.0–1.0），並在最後給整筆訂單一個 `overall_confidence`。

評分規則（這是 **AI 自評 + 規則校驗** 的混合做法）：

| 情境 | confidence |
|---|---|
| 欄位明確且唯一解 | 0.95–1.0 |
| 欄位有解，但格式非標準（如「桃機」而非「TPE」） | 0.7–0.9 |
| 欄位需要從上下文推測（如群組標題的日期繼承） | 0.4–0.7 |
| 欄位只能用業界常識補（如「送機」預設終點 = 桃機） | 0.3–0.5 |
| 欄位無法解析 | 0.0–0.2 |

> **重要**：對於需要 < 0.7 信心才能解析的訂單，整筆 `parse_status` 應為 `needs_review`，並在 `rewrite_suggestion` 提供標準格式範例。

### Step 5: 輸出結構化結果 + 改寫建議

對每筆訂單輸出 JSON，並對不合規訂單**附上 rewrite_suggestion**（標準格式版本）。

## 輸出 Schema

```json
{
  "parse_metadata": {
    "input_message_id": "string",
    "parsed_at": "ISO8601",
    "total_orders_detected": 0,
    "noise_filtered_count": 0,
    "duplicate_warning": null
  },
  "orders": [
    {
      "id": "uuid",
      "parse_status": "accepted | needs_review | rejected",
      "overall_confidence": 0.0,
      "fields": {
        "date": { "value": "2026-04-19", "confidence": 0.95, "raw": "4/19" },
        "time": { "value": "22:10", "confidence": 1.0, "raw": "22:10" },
        "type": { "value": "pickup", "confidence": 1.0, "raw": "接機" },
        "origin": { "value": "TPE", "confidence": 0.9, "raw": "(隱含)" },
        "destination": { "value": "台北市大安區信義路四段", "confidence": 0.95, "raw": "大安區信義路" },
        "price": { "value": 850, "confidence": 1.0, "raw": "$850" },
        "vehicle_type": { "value": "small", "confidence": 0.9, "raw": "小車" },
        "flight_number": { "value": "CI920", "confidence": 1.0, "raw": "CI920" },
        "special_requirements": { "value": ["after_23h_surcharge"], "confidence": 0.7, "raw": "(如超過23:00搭車+$100深夜自取)" }
      },
      "rejection_reasons": [],
      "rewrite_suggestion": null,
      "raw_segment": "原始訊息片段",
      "dispatcher_ref": "A2"
    }
  ],
  "rejected_messages": [
    {
      "raw": "0:05三重送",
      "reasons": ["missing_date", "missing_price"],
      "rewrite_suggestion": "請改寫為：4/19 00:05 送機 三重區 700"
    }
  ]
}
```

### parse_status 三態

- `accepted`：所有必填欄位都有，`overall_confidence >= 0.85`，可直接派出
- `needs_review`：可解析但有低信心欄位，需派單方在 UI 上確認
- `rejected`：缺必填欄位或格式嚴重不符，**附上 rewrite_suggestion**，要派單方修正後重貼

## 改寫建議（rewrite_suggestion）的撰寫原則

這是 skill 的**核心教育機制**。每次退回都是一次教學機會。

### 撰寫格式

```
⚠️ [簡短指出問題]
✏️ 建議改寫：`[標準格式範例]`
📖 為什麼：[一句話解釋]
```

### 範例

**輸入**：`0:05三重送`  
**rewrite_suggestion**：
```
⚠️ 缺日期、缺價格、缺機場
✏️ 建議改寫：`4/19 00:05 送機 三重區 700`
📖 為什麼：「送」字預設終點是桃園機場，但日期和價格不能省。
```

**輸入**：`明天早上桃園接機`  
**rewrite_suggestion**：
```
⚠️ 「明天」「早上」是相對描述，AI 不會猜
✏️ 建議改寫：`4/19 08:00 接機 [你的目的地] [價格]`
📖 為什麼：跨日訊息很容易把「明天」算錯，明寫日期最安全。
```

**輸入**：套裝訂單「一套不拆」格式  
**處理**：拆成獨立訂單（每筆獨立解析、獨立計價）  
**rewrite_suggestion**：
```
⚠️ 偵測到套裝單寫法（「一套不拆」「=N-M=」「+」連接）
✏️ 已將這 N 筆訂單自動拆分為獨立訂單
📖 為什麼：平台不接受套裝派單（成本高、智慧排程更優）。如希望司機接整套，建議：
  1. 把總價平均分配到每筆訂單
  2. 對其中任一筆使用「一鍵加價」吸引司機
```

## 何時讀取 reference 附錄

主檔涵蓋核心規則。遇到以下情況時，載入對應附錄：

| 情況 | 載入附錄 |
|---|---|
| 不確定派單方規範細節 | `references/gogmo-order-format-spec.md` |
| 遇到不認識的車型/地點/航班代碼 | `references/vocabulary.md` |
| 遇到不確定的訊息模式 | `references/edge-cases.md` |
| 想看真實案例對照 | `references/real-examples.md` |

## 嚴格禁止事項

❌ **禁止做以下「智能補救」**：
- 不猜相對日期（「明天」永遠標 `needs_review`，不自動填值）
- 不繼承全域預設價（`任意R $700` 開頭的訊息，下面的訂單**不**自動套用 700，要求派單方明寫）
- 不合併「一套不拆」訂單（**強制拆成獨立訂單**，平台不支援套裝派單）
- 不去重複訊息（如果偵測到 5 筆相同訂單，全部解析，但在 `parse_metadata.duplicate_warning` 標記，由前端決定如何顯示）

❌ **禁止隱藏失敗**：
- 任何低信心或缺欄位都必須明確標記
- 寧可 reject 100 筆要派單方修正，不可錯派 1 筆給司機

✅ **唯一可接受的隱含規則**：
- 「接機」預設 `origin = 桃園機場 (TPE)`，`destination = 訊息中的地點`
- 「送機」預設 `destination = 桃園機場 (TPE)`，`origin = 訊息中的地點`
- （此規則 confidence 上限 0.9，因為派單方可能指其他機場）

## 雙模式：嚴格 vs 寬鬆

skill 支援兩種解析模式，由呼叫方傳入 `parse_mode`：

### `strict` 模式（預設，正式環境用）
- 不合規訂單一律 `rejected`
- 強制要求改寫
- 適合：有用戶教育成本的 B2B 場景

### `lenient` 模式（MVP / 過渡期用）
- 不合規訂單盡量解析為 `needs_review`，並降低 confidence
- 同樣產生 `rewrite_suggestion`，但不強制阻擋
- 適合：冷啟動期，要先讓派單方願意用平台

預設用 `strict`。如果呼叫方未指定，回傳結果中的 `parse_metadata.mode_used` 要明確標示。

## 開發者使用方式

### 場景 1：Claude Code 寫 parser 程式

讀本 SKILL.md 主檔即可了解規則。實作時直接把 SKILL.md 的規則翻譯成程式碼（regex + LLM 混合 pipeline）。如果遇到具體格式疑問，再讀 `references/` 附錄。

### 場景 2：後端 API 當 system prompt

把本 SKILL.md 主檔當 system prompt 傳給 Claude API。輸入用戶貼上的派單訊息，要求輸出 JSON（符合上方 Schema）。建議搭配：
- 模型：Claude Haiku 或 Sonnet（成本/品質平衡）
- 溫度：0.0（要可重現）
- 強制 JSON 輸出（用 tool use 或 prompt instruction）

### 場景 3：產生 rewrite_suggestion 給派單方看

當 `parse_status == "rejected"`，把 `rewrite_suggestion` 透過 LINE Bot 或 App 通知回給派單方。久了派單方會學會標準格式。

---

**版本**：v1.2（2026-04）  
**配套文件**：`gogmo-order-format-spec.md`（給派單方看的規範，必須與本 skill 保持同步）

## 變更歷史

- **v1.2**：對齊 spec.md v1.2 —— 套裝單改為「強制拆分為獨立訂單」（平台不接受套裝派單），rewrite_suggestion 引導派單方使用「分配總價 + 一鍵加價」替代方案
- **v1.1**：套裝訂單的 rewrite_suggestion 不再假設「綁定派單按鈕」已存在
- **v1.0**：初版
