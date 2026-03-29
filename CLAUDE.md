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

## 目前已知問題
- 司機儀表板 availableOrders.map 錯誤（修復中）

## 測試帳號
- 司機：driver1@test.com
- 車頭：dispatcher1@test.com
