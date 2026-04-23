# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 今日開發（2026-04-24）

### [完成] 派單中心重構 + 司機端原型 UI（第二階段）

**Branch**: `main`

**實作內容**：

#### Phase 1：AI 解析改革
- `src/lib/prompts/order-parsing.ts` — System Prompt 重寫為五核心欄位（time/pickupLocation/dropoffLocation/price/vehicle）
- `src/lib/ai.ts` — 簡化 validatedOrders mapping，移除乘客詳細欄位解析

#### Phase 2：申請接單制核心 flow
- `src/app/api/orders/[id]/apply/route.ts` — 新增司機申請接單 API（PUBLISHED → ASSIGNED）
- `src/app/api/orders/[id]/accept/route.ts` — 修改為必須先申請才能接單
- `src/app/api/orders/[id]/dispatcher-approve/route.ts` — 支援 action=approve/reject，批准時填寫詳細資訊
- `src/components/dispatcher/DriverReviewPanel.tsx` — 司機審查面板元件

#### Phase 3：司機端調整
- `src/app/dashboard/driver/page.tsx` — 「接單」改為「申請接單」
- `src/app/dashboard/dispatcher/page.tsx` — ASSIGNED 訂單紅色 badge，審查面板整合

#### Phase 4：同步
- `src/app/api/dispatchers/events/route.ts` — SSE 新增 ASSIGNED 狀態監聽

#### Phase 5：司機端原型 UI（9 tasks）
- `src/app/globals.css` — 新增 --gogmo-* CSS tokens + 暗色模式
- `src/components/driver/TripProgressTracker.tsx` — 4-Step 行程進度追蹤（開始→抵達→客上→客下）
- `src/components/driver/OrderCard.tsx` — 整合 TripProgressTracker
- `src/components/ui/MessageThreadView.tsx` — 未讀計數 Badge + 全部已讀
- `src/components/driver/SettlementTab.tsx` — 雙欄統計卡片（今日收入/帳戶餘額）+ 司機資訊卡
- `src/components/driver/ProfileTab.tsx` — 文件到期警示（30天內琥珀色警告）
- `src/lib/api-utils.ts` — 新增 messages rate limit config

**Commits**：
- `feat(parse): 簡化AI解析目標為五個核心欄位`
- `feat(order): 新增司機申請接單API`
- `feat(order): PUBLISHED訂單需先申請才能接單`
- `feat(order): 批准時支援填寫詳細資訊並更新欄位`
- `feat(dispatcher): 新增司機審查面板元件`
- `feat(driver): 申請接單流程替換直接接單`
- `fix: SSE 通知新增 ASSIGNED 狀態`
- `feat(driver): 新增 gogmo 原型設計 tokens`
- `feat(driver): OrderCard 整合 4-Step 行程進度追蹤`
- `feat(driver): 訊息中心新增未讀計數與已讀管理`
- `feat(driver): 帳務中心改為雙欄統計卡片`
- `feat(driver): 文件管理新增到期警示`
- `merge(driver-prototype): 司機端原型 UI 實作（9 tasks 完成）`

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
