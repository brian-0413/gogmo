# 機場接送派單平台

## 技術棧
- Next.js 14 App Router + TypeScript
- Prisma ORM + PostgreSQL (Supabase, Transaction Pooler port 6543)
- 自定義 JWT 認證（無 NextAuth.js）
- Tailwind CSS + 自定義元件（shadcn/ui 改造）
- 部署：Zeabur

## 常駐工程團隊

本專案隨需啟動 4 位工程師協同作業：

| 代號 | 角色 | 負責範圍 |
|------|------|---------|
| **A（前）** | 前端工程師 | React/Next.js UI 元件、使用者介面、使用者體驗 |
| **B（後）** | 後端工程師 | API 設計、資料庫、伺服器端邏輯、認證 |
| **C（測）** | 測試工程師 | QA 測試、功能驗證、錯誤修復、迴歸測試 |
| **D（文）** | 文件工程師 | 技術文件、使用者操作文件、行銷/廣告文件 |

### 協同流程

```
老闆提出需求
    ↓
brainstorm（討論需求）→ 規格文件
    ↓
分派 ABC 各自處理，過程中互相交流問題與解決方案
    ↓
C 驗證所有功能正確，確認無錯誤
    ↓
D 撰寫產品文件（技術文件、使用者文件、廣告宣傳文件）
    ↓
git commit + push + 更新 CURRENT_WORK.md
```

### 發動觸發

老闆提出任何需求或問題時，**立即啟動 brainstorm**，隨即分派 ABC，任務完成後交給 D 寫文件。

### 溝通約定

- A/B/C 可隨時互相諮詢技術問題、討論實作方向
- C 的測試結果應即時回饋給 A/B，發現問題立刻修正
- D 在文件初稿完成後，主動詢問是否需要調整內容方向
- 所有工程師均遵循 Karpathy 編碼原則

## 專案結構
- src/app/api/ — API routes
- src/app/dashboard/driver/ — 司機端
- src/app/dashboard/dispatcher/ — 派單方端
- prisma/schema.prisma — 資料庫 schema

## 商業邏輯
- 司機預充值點數，每接一單扣 5% 媒合費
- 派單方端上傳訂單，初期免費，後期收 2-3%
- 訂單狀態流程：待指派 → 已接單 → 進行中 → 已完成

## 訂單解析規則
本平台處理台灣機場接送 LINE 群組訂單，格式極不統一。
詳細解析規則和範例見 docs/order-parsing-rules.md
測試案例見 docs/order-parsing-test-cases.md

核心重點：
- 派單方貼單三步驟：設定預設值 → 貼單解析 → 確認編輯上架
- 預設值（日期、種類、車型、車牌）由派單方在 UI 上手動選擇，必選欄位沒填完鎖定文字框
- 種類整批統一，一次只能選一種（接機/送機/交通接駁/包車）
- 解析器只需從每行提取：時間、地點（上下車點）、金額覆蓋，其餘全當備註
- 接機：pickup = 機場，dropoff = 從文字提取；送機：pickup = 從文字提取，dropoff = 機場
- 確認頁面支援：逐筆勾選、金額編輯、備註編輯、地點編輯
- 確認後立刻上牆，司機馬上看到
- 車型分類：小車(5人座)、休旅(7人座)、9人座、任意、任意R牌
- 大車可接小車的單，小車不能接大車的單
- 車牌分 R牌(租賃車) 和 T牌(計程車)，需分開標記
- 機場簡稱：桃機(TPE)、松機(TSA)、小港(KHH)、清泉崗(RMQ)
- 開發訂單相關功能時，務必先讀 docs/order-parsing-rules.md

## API 統一回傳格式
{ success: boolean, data: any, error?: string }

## 重要實作細節
- 派單方行控中心 Stats 區塊：6 格（接機/送機/待接單/已接單/進行中/已完成），無 icon，數字 `text-[36px]` 粗體
- `DispatcherOrderCard` 元件：支援內嵌編輯（無需 modal），司機已接單後（ACCEPTED/ARRIVED/IN_PROGRESS/COMPLETED）鎖定編輯/刪除
- SSE `/api/drivers/events`：polling 3 秒，連線時廣播所有 PUBLISHED 訂單
- 設計系統：暖米白背景（#FAF7F2）、黑體數字（`font-mono-nums`）、單號黑體黑字（20px）
- AI 訂單解析：用 Claude Haiku API，偵測機場（TPE/TSA/KHH/RMQ）和基隆港接送船

## 開發規範
- 所有 UI 文字使用繁體中文
- commit message 用中文
- 不使用 emoji
- 每次修改後要 git commit

### Karpathy 編碼原則（自動套用）
寫程式時遵循以下原則，降低 LLM 常見的編碼錯誤：

1. **Think Before Coding** — 不要假設、不隱藏疑惑。主動說明假設，有疑慮就停下來問。
2. **Simplicity First** — 用最少程式碼解決問題。不做推測性功能或抽象化，200 行能完成的話就不寫 2000 行。
3. **Surgical Changes** — 只碰必要的部分。不改不相關的程式碼，只清理自己產生的垃圾。
4. **Goal-Driven Execution** — 每個任務都要有可驗證的成功標準（不是「讓它運作」，而是「驗證 X 行為正確」）。

## 創意開發流程（最重要）

老闆是機場接送的專業司機，擁有實務經驗和創意想法，但沒有程式背景。
所有新功能都必須走完以下正規流程，**嚴禁直接實作**：

### 流程步驟

```
有新想法 → brainstorm 討論需求 → 建立規格文件 → 分派 ABC 實作 → C 測試驗證 → D 撰寫文件 → commit → 更新 CURRENT_WORK.md
```

### 每一步的意義

1. **brainstorm（討論）**：把創意變成完整的產品規格。不急著實作，先問清楚：
   - 誰用這個功能？（司機？派單方？）
   - 在什麼情境下用？（手機？電腦？）
   - 和現有功能的關係是什麼？
   - 有沒有漏掉的使用者角色？
   - 失敗的邊界情況怎麼處理？

2. **規格文件**：brainstorm 完成後，把結論寫成文件放進 `docs/` 資料夾（格式：`YYYY-MM-DD-<功能名>-design.md` 或直接在對應規格文件中新增章節）。

3. **分派 ABC**：規格確認後，依據技能分派工作：
   - **A（前端）**：負責 UI 元件、頁面設計、互動體驗
   - **B（後端）**：負責 API 設計、資料庫、伺服器邏輯
   - **C（測試）**：同步規劃測試策略，實作後立即驗證
   - A/B/C 在實作過程中隨時互相交流，發現問題共同解決

4. **C 測試驗證**：所有功能實作完成後，C 執行完整 QA 測試，確認無錯誤

5. **D 撰寫文件**：測試通過後，D 撰寫三類文件：
   - 技術文件（架構、API、資料庫 schema）
   - 使用者文件（操作手冊、功能說明）
   - 行銷文件（產品特色、廣告文案）

6. **commit + 更新 CURRENT_WORK.md**：功能完成的標準動作

### 觸發時機

當老闆提出任何新想法、功能調整、介面改動時，**立刻**引導進入 brainstorm 流程：
> 「這個想法很好！讓我用 brainstorm 技能和你完整討論一下，確保我們把需求想清楚再開始做。」

### 提醒語

遇到老闆想直接開始實作或邊做邊改的情況，溫和提醒：
> 「我們先把需求討論清楚再開始，這樣做出來的東西會更完整。你方便用 brainstorm 討論嗎？」

## 開發流程（常規實作）

1. 收到任務後，先讀取 docs/ 下的相關規則文件
2. 自己規劃需要修改哪些檔案，列出來讓老闆確認
3. 開始實作，每完成一個小功能就自己跑 npm run build 檢查
4. 全部做完跑一次完整 build 確認沒有錯誤
5. git commit 存檔
6. 如果同一個問題修了兩次還沒好，停下來完整回報問題原因
7. 功能完成後：更新 CURRENT_WORK.md → git add + commit → git push

## 禁止事項
- 不要在沒有讀規則文件的情況下開始實作
- 不要一次改太多檔案而不做中間檢查
- 不要猜測需求，不確定的就問我
- ABC 任何一方發現技術問題，應主動諮詢其他兩方，不得獨斷決定

## 測試帳號
- 司機：driver1@test.com
- 派單方：dispatcher1@test.com

## 智慧排單功能
智慧排班單能規格見 docs/smart-scheduling.md

## 車型系統規範（2026-04 重構）

### 標準車型代號

| 代號 | 中文 | 說明 |
|------|------|------|
| `SEDAN_5` | 5 人座轎車 | 小車/轎車 |
| `SUV_5` | 5 人座休旅 | 休旅/SUV（含 7 人座 SUV 行李空間不足視為 5 人座） |
| `MPV_7` | 7 人座 MPV | Sienna、Odyssey、Custin |
| `VAN_9` | 9 人座 | Hiace、Tourneo、Starex、VITO、GRANVIA |
| `CUSTOM` | 自訂車款 | Alphard、V-Class 等指定品牌車款 |

### 派單嚴格度

| 代號 | 說明 |
|------|------|
| `EXACT` | 必須是這個車型 |
| `MIN` | 最低需求，可派更高等級（大車可接小車單） |
| `ANY` | 任意車型 |

### 車牌類型

| 代號 | 說明 |
|------|------|
| `RENTAL` | R 牌（租賃車）— 預設，所有派單接受 |
| `TAXI` | T 牌（計程車）— 僅當 `Order.allowTaxiPlate = true` 才收到派單 |

### 程式碼規則

1. **必須** 從 `@/lib/vehicle` import 所有車型相關物件
2. **禁止** 在程式碼中硬編碼任何車型字串（包括 'small'、'5人座'、'small_suv' 等）
3. **禁止** 重複定義 `VEHICLE_LABELS` 或類似 mapping
4. 處理外部輸入（API body、AI 解析、LINE 訊息）一律走 `normalizeVehicleInput()`
5. 顯示車型中文一律使用 `VEHICLE_LABELS[vehicleType]`
6. 判斷司機可否接單一律使用 `isVehicleCompatible()`

### 新增車型步驟

1. 在 `src/lib/vehicle/types.ts` 加入 enum 值
2. 在 `src/lib/vehicle/labels.ts` 加入中文標籤
3. 在 `src/lib/vehicle/capacity.ts` 加入 spec
4. 在 `src/lib/vehicle/parser-dictionary.ts` 加入常見寫法字典
5. 修改 Prisma schema 的 `VehicleType` enum 並跑 migration
6. 如有需要，在 ESLint 規則中將新代號加入「合法清單」

### CUSTOM 訂單特別說明

選擇 CUSTOM 時需同時填寫 `customVehicleNote`（自由文字描述）。CUSTOM 訂單由派單方手動指派，不會自動派給標準車型司機。

### 向後相容

- `src/lib/vehicle-compat.ts` — 向後相容 re-export，Phase 3 後逐漸移除
- `src/types/index.ts` — VehicleType re-export 即將移除，新程式碼請從 `@/lib/vehicle` import