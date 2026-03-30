# 機場接送派單平台

## 技術棧
- Next.js 14 App Router
- Prisma ORM + PostgreSQL (Supabase, Transaction Pooler port 6543)
- NextAuth.js 認證
- Tailwind CSS + shadcn/ui
- 部署：Zeabur

## 專案結構
- src/app/api/ — API routes
- src/app/dashboard/driver/ — 司機端
- src/app/dashboard/dispatcher/ — 車頭端
- prisma/schema.prisma — 資料庫 schema

## 商業邏輯
- 司機預充值點數，每接一單扣 5% 媒合費
- 車頭端上傳訂單，初期免費，後期收 2-3%
- 訂單狀態流程：待指派 → 已接單 → 進行中 → 已完成

## 訂單解析規則
本平台處理台灣機場接送 LINE 群組訂單，格式極不統一。
詳細解析規則和範例見 docs/order-parsing-rules.md
測試案例見 docs/order-parsing-test-cases.md

核心重點：
- 車頭貼單三步驟：設定預設值 → 貼單解析 → 確認編輯上架
- 預設值（日期、種類、車型、車牌）由車頭在 UI 上手動選擇，必選欄位沒填完鎖定文字框
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

## 開發規範
- 所有 UI 文字使用繁體中文
- commit message 用中文
- 不使用 emoji
- 每次修改後要 git commit

## 測試帳號
- 司機：driver1@test.com
- 車頭：dispatcher1@test.com
