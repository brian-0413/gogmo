# gogmo Order Parser Skill v1.2

把 LINE 風格的派單訊息解析成 gogmo 結構化訂單。

**設計核心**：嚴格規範優先 + AI 不過度推測 + rewrite_suggestion 教育派單方走向標準格式 + 用「分級服務」與「機制設計」取代「懲罰與收費」。

## 資料夾結構

```
gogmo-order-skill/
├── README.md                              ← 你正在看這份
├── SKILL.md                               ← 主檔（給 AI 看的解析規則）
├── gogmo-order-format-spec.md             ← 派單方規範（給人類看）
├── references/
│   ├── gogmo-order-format-spec.md         ← 同上的副本
│   ├── vocabulary.md                      ← 詞彙對照表
│   ├── edge-cases.md                      ← 12 個邊界案例
│   └── real-examples.md                   ← 10 個真實案例與正解 JSON
└── claude-code-prompts/                   ← 給 Claude Code 的開發提示詞（6 份）
    ├── 01-daily-quota-tier.md             ← 每日上限 + 會員分級（最優先）
    ├── 02-surge-pricing.md                ← 一鍵加價 + 防剝削（最優先）
    ├── 03-real-name-registration.md       ← 實名註冊
    ├── 04-batch-import.md                 ← 批次匯入
    ├── 05-dispatcher-preferences.md       ← 派單偏好
    └── 06-duplicate-merge.md              ← 重複訂單自動合併
```

## 兩份文件，兩種讀者

| 文件 | 讀者 | 用途 |
|---|---|---|
| `gogmo-order-format-spec.md` | **派單方（人類）** | 教派單方該怎麼寫訂單訊息 |
| `SKILL.md` | **AI（Claude）** | 教 AI 該怎麼解析派單訊息 |

兩份文件**必須保持同步** —— 修改任一份時，記得檢查另一份是否需要對應更新。

## Claude Code 開發提示詞 ⭐ 6 份

按照「商業策略邏輯」排序的開發優先級：

### 第一階段：建立平台正常運作的「免費 + 防濫用」基礎（必做）

| 順序 | 提示詞 | 預估時間 | 為什麼重要 |
|---|---|---|---|
| **1** | `01-daily-quota-tier.md` | 1 天 | **防 API 帳單爆炸的核心** + 未來付費方案的鋪墊 |
| **2** | `02-surge-pricing.md` | 2-3 天 | **取代「重複貼單」的正當機制** + 平台核心競爭力 |
| **3** | `03-real-name-registration.md` | 1-2 天 | **防人頭帳號** + 實名讓平台可信 |
| **4** | `06-duplicate-merge.md` | 0.5 天 | 重複貼單自動合併（搭配加價單，雙保險） |

第一階段做完，平台就有完整的「不收費也能正常運作」基礎。

### 第二階段：提升派單方體驗（次要）

| 順序 | 提示詞 | 預估時間 | 為什麼重要 |
|---|---|---|---|
| 5 | `04-batch-import.md` | 1 天 | 大幅減少派單方逐筆貼的痛苦 |
| 6 | `05-dispatcher-preferences.md` | 0.5-1 天 | 累積使用後的優化 |

每份提示詞都是獨立的，可以分次餵給 Claude Code。

## 三種使用情境

### 情境 1：Claude Code 寫 parser 程式碼

把整個資料夾放進 gogmo 專案的 `docs/ai-rules/`，然後告訴 Claude Code：

```
請依照 docs/ai-rules/gogmo-order-skill/SKILL.md 的規則，
用 TypeScript 在 lib/parser/ 下實作 parseOrder() 函式
```

### 情境 2：後端 API 當 system prompt

```typescript
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  system: SKILL_MD_CONTENT,
  messages: [{ role: "user", content: rawDispatchMessage }],
  temperature: 0
});
```

### 情境 3：人類派單方教育

把 `gogmo-order-format-spec.md` 放在 gogmo App 內的「派單規範」頁面、LINE Bot 的歡迎訊息附件、派單方 onboarding 流程。

## 雙模式：strict vs lenient

| 模式 | 行為 | 適用 |
|---|---|---|
| **strict** | 不合規訊息直接退回 | 正式環境 |
| **lenient**（預設） | 盡量解析，標 `needs_review` | MVP 冷啟動期 |

## 信心分數

- `>= 0.85`：直接派出
- `0.7–0.85`：標 `needs_review`
- `< 0.7`：退回改寫

## 商業策略：完全免費 + 機制設計防濫用 + 分級變現

| 防濫用機制 | 取代了什麼 |
|---|---|
| 每日 100 單上限（基本免費） | 「重貼收費 NT$5」的懲罰機制 |
| 進階派單會員（500 單/日） | 從「擋使用」變「升級誘因」 |
| 一鍵加價 + 加價單列表 | 「重複貼單」的傳統 LINE 行為 |
| 重複訂單自動合併 | 「重貼罰款」的對抗式設計 |
| 實名註冊 + 手機驗證 | 「人頭帳號隨意註冊」的漏洞 |
| 信譽分數（即將推出） | 「人為審核」的高成本 |

**核心理念**：用機制設計讓「壞行為變得沒意義」、用分級服務讓「重度使用者願意付費」，而不是用懲罰機制管理派單方。

## 不接受的訂單類型（重要）

平台**主動拒絕**以下類型的訂單，理由完整記錄在 spec.md「平台不接受的情境」：

1. **套裝單（一套不拆）**：強制拆成獨立訂單，引導派單方改用「分配總價 + 一鍵加價」
2. **範圍價格 / 模糊敘述**
3. **純廣告**

## 版本

- **v1.0**（2026-04-18）：初版
- **v1.1**（2026-04-19）：拿掉「重複貼單收費」、軟化違規處理、新增「即將推出」標記
- **v1.2**（2026-04-19）：
  - 新增「為什麼用 gogmo」段落，明確平台優勢
  - **套裝單改為「強制拆分」**（平台不接受套裝派單）
  - 新增「實名註冊」要求
  - 新增「每日 100 單上限 + 會員分級」（取代速率限制）
  - 新增「一鍵加價」功能與防剝削機制（位於行程卡片、6 小時內啟用、加價歷史公開、價格下限保護）
  - 新增 3 份 Claude Code 提示詞、調整提示詞排序

## 維護週期

- **每週**：根據新派單模式，更新 `references/edge-cases.md`
- **每月**：擴充 `references/real-examples.md`
- **每季**：檢視 `gogmo-order-format-spec.md`，調整規範鬆緊

---

**設計者筆記**：這份 skill 的價值不在「解析準確率」，而在於**重新定義派單方與平台的契約**。當派單方逐漸習慣標準格式 + 平台規範，AI 解析就退化成簡單的格式驗證，整套系統的成本才能規模化。
