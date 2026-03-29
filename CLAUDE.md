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

## 開發規範
- 所有 UI 文字使用繁體中文
- commit message 用中文
- 不使用 emoji
- 每次修改後要 git commit
- API 回傳格式統一為 { success: boolean, data: any, error?: string }

## 訂單解析規則
本平台處理台灣機場接送 LINE 群組訂單，格式極不統一。
詳細解析規則見 docs/order-parsing-rules.md

核心重點：
- 訂單只需精確提取 5 個欄位：日期、時間、種類（接機/送機/交通接駁/包車）、車型、金額
- 其餘內容全文保留到「備註」欄位，讓司機自行閱讀
- 車型分類：小車(5人座)、休旅(7人座)、9人座、任意、任意R牌
- 大車可接小車的單，小車不能接大車的單
- 車牌分 R牌(租賃車) 和 T牌(計程車)，需分開標記
- 機場簡稱：桃機(TPE)、松機(TSA)、小港(KHH)、清泉崗(RMQ)
- 開發訂單相關功能時，務必先讀 docs/order-parsing-rules.md

## 測試帳號
- 司機：driver1@test.com
- 車頭：dispatcher1@test.com
