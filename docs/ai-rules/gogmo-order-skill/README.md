# gogmo Order Parser Skill

把 LINE 風格的派單訊息解析成 gogmo 結構化訂單。**設計核心：嚴格規範優先，AI 不過度推測，用 rewrite_suggestion 教育派單方走向標準格式。**

## 資料夾結構

```
gogmo-order-skill/
├── README.md                              ← 你正在看這份
├── SKILL.md                               ← 主檔（給 AI 看的解析規則）
├── gogmo-order-format-spec.md             ← 派單方規範（給人類看）
└── references/
    ├── gogmo-order-format-spec.md         ← 同上的副本，方便 AI 解析時對照
    ├── vocabulary.md                      ← 詞彙對照表（機場、車型、航空代碼等）
    ├── edge-cases.md                      ← 12 個邊界案例與處理規則
    └── real-examples.md                   ← 10 個真實案例與正解 JSON（同時是測試集）
```

## 兩份文件，兩種讀者

| 文件 | 讀者 | 用途 |
|---|---|---|
| `gogmo-order-format-spec.md` | **派單方（人類）** | 教派單方該怎麼寫訂單訊息 |
| `SKILL.md` | **AI（Claude）** | 教 AI 該怎麼解析派單訊息 |

兩份文件**必須保持同步** —— 修改任一份時，記得檢查另一份是否需要對應更新。例如：
- 規範新增「特殊需求」欄位 → AI skill 也要加上對應的解析規則
- AI 解析發現新型態的訊息 → 規範要決定接受 / 拒絕，並更新 spec

## 三種使用情境

### 情境 1：Claude Code 寫 parser 程式碼

```
你（在 Claude Code 裡）：
請依照 gogmo-order-skill/SKILL.md 的規則，
用 TypeScript 寫一個 parseOrder() 函式
```

Claude Code 會讀 SKILL.md、references/，自動實作出符合規範的 parser。

### 情境 2：後端 API 當 system prompt

把 `SKILL.md` 主檔當作 Claude API 的 system prompt：

```typescript
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  system: SKILL_MD_CONTENT,
  messages: [
    { role: "user", content: rawDispatchMessage }
  ],
  temperature: 0
});
```

Claude API 會依照 SKILL.md 的規則，輸出符合 schema 的 JSON。

### 情境 3：人類派單方教育

把 `gogmo-order-format-spec.md` 放在：
- gogmo App 內的「派單規範」頁面
- LINE Bot 的歡迎訊息附件
- 派單方上手 onboarding 流程

當 AI 退回不合規訊息時，附上 `rewrite_suggestion` 並導向這份規範。

## 雙模式：strict vs lenient

| 模式 | 行為 | 適用 |
|---|---|---|
| **strict**（預設） | 不合規訊息直接退回，要求改寫 | 正式環境、有用戶教育預算 |
| **lenient** | 盡量解析，標 `needs_review`，但仍提供 rewrite_suggestion | MVP 冷啟動期，先讓派單方願意用 |

呼叫 parser 時透過 `parse_mode` 參數指定。建議路線：
1. 上線初期用 `lenient`，收集真實訊息
2. 累積 1-2 個月後，逐步轉 `strict`
3. 觀察派單方流失率，決定是否回退

## 信心分數（confidence score）

每個欄位都有 0.0–1.0 的信心值。**用途**：
- `>= 0.9`：直接顯示為正常欄位
- `0.7–0.9`：UI 用黃色高亮，提醒派單方檢查
- `< 0.7`：標 `needs_review`，要求派單方確認後才能派出

整筆訂單也有 `overall_confidence`，供前端決定要不要顯示警告 banner。

## 維護週期

- **每週**：根據新出現的派單模式，更新 `references/edge-cases.md`
- **每月**：擴充 `references/real-examples.md`（加新案例 + 補測試）
- **每季**：檢視 `gogmo-order-format-spec.md`，調整規範鬆緊
- **隨時**：如果發現 AI 解析品質下降，先看是否有新型態訊息沒覆蓋到，再改 SKILL.md

## 版本

- **v1.0**（2026-04-18）：初版
- 配套 gogmo 平台版本：≥ MVP

---

**設計者筆記**：這份 skill 的價值不在「解析準確率」，而在於**重新定義派單方與平台的契約**。當派單方逐漸習慣標準格式，AI 解析就退化成簡單的格式驗證，整套系統的成本才能規模化。
