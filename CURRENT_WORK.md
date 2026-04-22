# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 今日開發（2026-04-22）

### [完成] gogmo 智慧解析 & 智慧排單功能（全四階段）

**Branch**: `main`

**實作內容**：

#### Phase 1：智慧解析後端 + 資料結構
- `prisma/schema.prisma` — 新增 `contactName`, `specialRequests`, `pickupAddresses[]`, `dropoffAddresses[]`, `originalMessage`, `parsedByAI`, `parseConfidence` 欄位
- `src/lib/zones/v2/distance-matrix.ts` — 25 區距離矩陣（車程分鐘）
- `src/lib/zones/v2/address-to-zone.ts` — 地址→區域對應表
- `src/lib/ai/parse-orders.ts` — AI 解析（使用 Haiku）
- `src/app/api/orders/parse/route.ts` — AI 解析 API
- `src/app/api/orders/publish-batch/route.ts` — 批次發布 API

#### Phase 2：智慧解析前端 UI
- `src/app/dispatcher/parse/page.tsx` — 輸入頁（日期/車型/訊息）
- `src/app/dispatcher/parse/review/page.tsx` — 列表確認頁
- `src/app/dispatcher/parse/review/[index]/page.tsx` — 單張編輯頁

#### Phase 3：智慧排單後端演算法
- `src/lib/dispatch/smart-match-v2.ts` — calculateSmartMatch() 核心函式
- `src/app/api/driver/smart-match/route.ts` — GET ?anchorId=xxx

#### Phase 4：智慧排單前端 + 大廳排序篩選
- `src/app/dashboard/driver/smart-match/page.tsx` — 推薦清單頁
- `src/app/dashboard/driver/page.tsx` — 行程卡片智慧排單按鈕改為跳轉新頁

**Commits**：
- `feat(parse): 新增智慧解析 API 與資料結構`
- `feat(parse): 智慧解析前端三步驟頁面`
- `feat(dispatch): 智慧排單演算法與 API`
- `feat(dispatch): 智慧排單前端與大廳排序篩選`

---

## 待辦

- 司機遲到/缺席處理機制
- LINE 通知整合
- Unit tests for smart-match algorithm
