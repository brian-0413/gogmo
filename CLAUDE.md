# 機場接送派單平台

## 技術棧
- Next.js 14 App Router + TypeScript
- Prisma ORM + PostgreSQL (Supabase, Transaction Pooler port 6543)
- 自定義 JWT 認證（無 NextAuth.js）
- Tailwind CSS + 自定義元件（shadcn/ui 改造）
- 部署：Vercel

## 三模型同步工作流
本專案使用 3 個 Claude Code 對話（Haiku/Sonnet/Opus）分擔不同複雜度的問題。
**CURRENT_WORK.md** 是進度同步的核心檔案：
- 每次主要功能完成後，在主要 Claude Code session 更新此檔案
- 每次 commit 順便更新 CURRENT_WORK.md 並 push GitHub
- 其他模型新對話開始時，優先閱讀 CURRENT_WORK.md 掌握最新進度
- CLAUDE.md 是長期穩定的技術/商業脈絡；CURRENT_WORK.md 是動態進度日誌

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

## 創意開發流程（最重要）

老闆是機場接送的專業司機，擁有實務經驗和創意想法，但沒有程式背景。
所有新功能都必須走完以下正規流程，**嚴禁直接實作**：

### 流程步驟

```
有新想法 → brainstorm 討論需求 → 建立規格文件 → 實作 → commit → 更新 CURRENT_WORK.md
```

### 每一步的意義

1. **brainstorm（討論）**：把創意變成完整的產品規格。不急著實作，先問清楚：
   - 誰用這個功能？（司機？派單方？）
   - 在什麼情境下用？（手機？電腦？）
   - 和現有功能的關係是什麼？
   - 有沒有漏掉的使用者角色？
   - 失敗的邊界情況怎麼處理？

2. **規格文件**：brainstorm 完成後，把結論寫成文件放進 `docs/` 資料夾（格式：`YYYY-MM-DD-<功能名>-design.md` 或直接在對應規格文件中新增章節）。

3. **實作**：規格確認後才開始寫程式。

4. **commit + 更新 CURRENT_WORK.md**：功能完成的標準動作。

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

## 測試帳號
- 司機：driver1@test.com
- 派單方：dispatcher1@test.com

## 智慧排單功能
智慧排班單能規格見 docs/smart-scheduling.md