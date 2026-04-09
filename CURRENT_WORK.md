# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 專案現況（2026-04-09 早上）

### 最後 commit
```
e16567b feat: 小隊互助系統 — Build 驗證通過
```
落後 origin/main 0 個 commits。

---

## 目前開發階段：小隊互助系統（已完成）

### [完成] 小隊互助系統（2026-04-09）
**Commits**: `497a0aa` → `33a3f37` → `b82bd9d` → `f2c84ea` → `9e06179` → `f386777` → `0fc5d77` → `e16567b`
**功能概述**：Premium 司機專屬功能，小隊內可互相轉單（5% 費用，比退單 10% 便宜）。

**實作內容**：
- **Prisma Schema**：`Squad`（小隊）、`SquadMember`（成員關聯）、`OrderTransfer`（轉單記錄，6狀態）
- **CRUD API**：POST/GET/DELETE 小隊、邀請成員、加入、退出（自動轉讓隊長）、解散
- **轉單 API**：發起轉單 → 隊友接受 → 派單方核准 → 完成（或拒絕）
- **SSE 即時通知**：司機 `/api/squads/events`、派單方 `/api/dispatchers/events`
- **3 小時鎖定 Cron**：`GET /api/cron/lock-orders`，行前三小時自動鎖定訂單
- **司機端 UI**：「我的小隊」Tab（小隊管理、成員列表、邀請、成員離開/解散）
- **司機行程卡片**：ACCEPTED 狀態顯示「請求小隊支援」按鈕
- **派單方 UI**：`TransferConfirmBanner` 橫幅（轉單待核准），SSE 接收即時更新
- **TransferStatus 5 態流程**：PENDING → ACCEPTED → APPROVED / REJECTED / CANCELLED
- **費用計算**：`TRANSFER_FEE_RATE = 0.05`（5%）

**規格文件**：`docs/squad-system.md`
**實作計畫**：`docs/superpowers/plans/2026-04-09-squad-system.md`
**待確認問題**：見下方「早上討論問題」

### 早上討論問題（待確認）
1. 隊友收到轉單請求時，是否有明確橫幅通知？（SquadTab 是否實作轉單橫幅？）
2. 是否要從「直接加入」改為「邀請制」？
3. 派單方不在頁面時的轉單通知，是否需要 push 通知？
4. 小隊名稱是否要 unique（同一 dispatcherId 下）？
5. 隊長刪帳號時，小隊處理邏輯？
6. 是否需要補自動化測試？

---

## 目前開發階段：小車頭專區（已完成）

### [完成] 小車頭 SelfDispatchChat UI 重構（2026-04-09）
**Commit**: `241a199`
**功能概述**：依 mockup 全面重構對話式發單介面。

**實作內容**：
- 日期/時間拆為兩個獨立問題（Step 3 = 日期，Step 4 = 時間）
- 航班輸入文字改為動態「接機必填 / 送機選填」
- 所有輸入框加 `max-w-full` 約束，防止超出對話泡泡
- 移除 `step >= N` 條件，改為精確 `step === N` 只渲染當前步驟（消除對話框重疊問題）
- 新增 `StepIndicator` 底部進度條元件（13 格進度點 + 步驟標籤）
- 今天/明天/後天快速日期捷徑按鈕
- 聯絡人姓名/電話列寬度調整為 `flex-1` 自適應

**Mockup 檔案**：`self-dispatch-mockup.html`（7 個畫面，涵蓋全部 13 步驟）

### [完成] 小車頭專區（2026-04-08）
**Commits**: `ad0a0c8` → `33e4a27` → `68c0f19` → `09dc30f` → `03025ee` → `591cb32`
**功能概述**：Premium 司機專屬功能，可在司機端後台「小車頭」Tab 自行發單上架至接單大廳，LINE 風格 14 步對話式引導發單。

**實作內容**：
- **Prisma**：`Order` model 新增 `isSelfPublish` boolean；`Driver` model 新增 `isPremium` boolean
- **Auth 層**：login/register 回傳 `isPremium`；AuthResult 介面新增 `isPremium`
- **API**：`POST /api/orders/self-publish` 司機自助發單端點（含 Premium 驗證、費用模式邏輯、系統派單方建立）
- **前端**：司機後台新增「小車頭」Tab（普通司機鎖定灰色，Premium 司機可使用）
- **對話式元件**：`SelfDispatchChat.tsx`（1019 行），LINE 風格 14 步流程（含行李 loop、費用計算、特殊需求、備註）
- **4 項 review 修復**：ProgressDots 改 14 格、備註文字框加入 Step 12、行李數量加入「4件」、代收回金超額警告

**規格文件**：`docs/superpowers/specs/2026-04-08-driver-self-dispatch-design.md`
**Mockup 檔案**：`.superpowers/brainstorm/03-full-chat.html`

**待實作項目**：全部完成

---

## 目前開發階段：首頁 Landing Page 重設計

### [完成] Prisma 5 → 7 升級（解決 Zeabur libssl.so.1.1 問題）
**原因**：Zeabur 使用 Debian 12，只有 libssl.so.3，Prisma 5 需要 libssl.so.1.1 無法連接資料庫。

**變更**：
- 升級 Prisma 5.22 → 7.6.0（含 `@prisma/adapter-pg` + `pg` driver）
- `schema.prisma`：移除 `url = env("DATABASE_URL")`（Prisma 7 改由 config 檔案）
- 新增 `prisma.config.ts`（schema 路徑 + datasource URL + seed 指令）
- `src/lib/prisma.ts`：使用 `PrismaPg(pool)` adapter 模式
- `prisma/seed.ts`：使用 adapter + `@ts-nocheck`（避免型別干擾）
- `package.json`：`prisma.seed` 改用 `tsx --env-file=.env`
- 修補所有 `implicit any` 類型錯誤（10+ 個 API routes）
- 安裝依賴：`@prisma/adapter-pg`、`pg`、`@types/pg`、`tsx`

---

## 目前開發階段：第一期 - 司機端完善（司機行程狀態更新）

派單方行控中心已完成（第一、二階段）。現正處理司機端接單流程。

---

## 近期進度

### [完成] 新版首頁 Landing Page（2026-04-07）
**Commits**: `a5e2207` → `afe27d4`
**功能概述**：全新登入前首頁，Scheme D 暖米黃風格。

**實作內容**：
- **雙卡片 Hero**：A卡白色輪播（司機/派單方由左滑入）＋B卡白色即時數據牆
- **輪播行為**：4秒自動切換，由左滑入（translateX(-100%)→0），底部 dot indicators + arrow 按鈕
- **即時數據牆**：4格數據卡各有專屬底色（司機接單動態→#FFF3E0橙、所有訂單→#EEF4FF藍、已派出→#F0FFF4綠、註冊司機→#FAF0FF紫）
- **goGMO 品牌**：左上角 brand name，右上角登入按鈕，暖米黃背景
- **圓角卡片**：border-radius: 24px，白色卡片，白色底色（A、B卡相同）
- **按鈕尺寸**：小尺寸 padding: 8px 14px

**實作檔案**：
- `src/app/page.tsx`：新版首頁，刪除舊 FlipboardGrid / LiveTicker / DriverStatusCarousel
- `src/components/HeroCarousel.tsx`：輪播元件，2張投影片，refs DOM 操作
- `src/components/DataWall.tsx`：即時數據牆元件
- `docs/superpowers/specs/2026-04-07-landing-page-design.md`：規格文件

**Mockup 演進**：6 個版本迭代（v1 stacked → v2 split contrast → v3 fade carousel → v4 slide → v5 A/B split → v6 rounded cards）
配色 Scheme A/B/C/D，最終選定 **Scheme D**（白色卡片）

---

### [完成] Phase 2D 魔法數字重構（2026-04-05）
**Commit**: `ca8197d`
**功能概述**：抽出所有業務規則硬編碼數值為具名常數於 `src/lib/constants.ts`。

**新增常數**：
- `PLATFORM_FEE_RATE = 0.05`（5% 平台抽成）
- `DRIVER_EARNINGS_RATE = 0.95`（司機實得 = 1 - PLATFORM_FEE_RATE）
- `CANCELLATION_FEE_RATE = 0.1`（10% 取消手續費）
- `WEEKLY_SETTLEMENT_TARGET = 5000`（每週結算目標）
- `NEW_USER_BONUS = 500`（新用戶贈送點數）
- `DEFAULT_ORDER_PRICE = 800`（訂單預設金額）
- `MAX_ORDER_PRICE = 100000`（最大訂單金額上限）

**替換範圍**（14 個檔案）：
- API routes：`accept`、`cancel`、`schedule/confirm`、`settlement`、`orders`、`orders/[id]`
- Frontend pages：`driver/page`、`driver/order/[id]`、`dispatcher/page`
- Components：`SettlementTab`、`SmartSchedulePanel`
- Lib：`auth`、`constants`、`validation`

### [完成] 司機行程狀態更新（2026-04-04）
**Commits**: `ec55ab4` → `f80f240` → `3cb34e2` → `b250d8c` → `99a38a6` → `63f91cd`

**功能概述**：司機接單後可在手機上依序執行「開始 → 抵達 → 客上 → 客下」，派單方行控中心的卡片即時同步顯示4格進度燈號。

**實作內容**：
- **Prisma schema**：`Order` model 新增 `startedAt`、`arrivedAt`、`pickedUpAt` 時間戳記欄位；`OrderStatus` enum 新增 `IN_PROGRESS`、`ARRIVED`、`PICKED_UP`
- **API**：`POST /api/orders/[id]/status` 專用端點，支援 start/arrive/pickup/complete 四個動作，3小時門檻檢查，完成時建立交易紀錄並扣5%平台費
- **SSE**：`GET /api/dispatchers/events` 派單方即時接收 ORDER_STATUS_CHANGE 事件
- **ProgressBar 元件**：`src/components/driver/ProgressBar.tsx`，4格進度條（開始/抵達/客上/客下），亮燈/閃爍效果
- **OrderDetailActions 元件**：`src/components/driver/OrderDetailActions.tsx`，4鍵按鈕列，含狀態鎖定邏輯
- **司機端訂單詳情頁**：`/dashboard/driver/order/[id]`，全螢幕顯示進度條、4鍵按鈕、乘客電話可撥號、客下完成後2秒自動返回
- **派單方行控中心**：卡片顯示進度條燈號，接收 SSE 即時更新燈號

**規格文件**：`docs/driver-status-flow.md`

### [完成] QA 測試（2026-04-04）
- `/qa` 測試司機端智慧排單功能，發現 **0 個問題**
- Health Score：**100/100**
- 測試涵蓋：我的行程頁面、接單大廳頁面、智慧排班面板、所有互動按鈕

### [完成] 小隊互助系統規格文件（`docs/squad-system.md`）
- 商業價值、小隊管理、轉單流程與費用規則
- Prisma schema 設計、API 端點規劃、開發優先順序
- 轉單 5%、退單 10%、行程前 3 小時鎖定
- 已建立完整 UI mockups（司機端/派單方視角）

### [完成] Claude Code 插件安裝
- `superpowers-marketplace`：含 `/brainstorm`, `/write-plan`, `/execute-plan` 等技能
- `claude-hud`（jarrodwatts/claude-hud）：HUD 顯示介面
- `frontend-design`、`skill-creator`、`ralph-wiggum`、`claude-md-management`

### [完成] 派單方派單機制技能（/dispatch skill）
- 建立 `src/.claude/skills/dispatch/SKILL.md`
- 涵蓋：3步驟派單流程、AI解析規則、訂單狀態流程、車型對照、肯驛機制、平台費用
- 指定路徑：`src/app/dashboard/dispatcher/`、`src/lib/ai.ts`、`src/components/dispatcher/`

### [完成] 智慧排單排序策略：區分觸發類型
- **送機觸發**（司機確定在桃園機場）：
  - 篩選：落地時間 >= 司機到機場時間，上限+120分鐘
  - 排序：**落地時間**（最早的航班最推薦），地理距離無關
- **接機觸發**（司機目的地未知）：
  - 接機單執行時間鏈：t1(落地) + t2(出關60分) + t3(行車) + t4(行政區間)
  - t3：尖峰(06:30-09:30/16:00-19:00) 75分，否則 60分（根據落地時間 t1 判斷）
  - t4：行政區間行車時間（查 docs/雙北次生活圈通勤預估時間.pdf）
  - 篩選：**t1+3小時內**的所有送機單（不限行政區）
  - 排序：**地理距離**（接機目的地→送機上車地點）最近優先
  - 上限：取 **3 張**
- **實作**：
  - 41 個台北市+新北市行政區座標（DISTRICTS array）
  - 次生活圈：11 個分區（docs/雙北次生活圈劃分.pdf）
  - `getDistrictCoords(location)`：地點字串→行政區座標
  - `getDistance()`：Haversine 公式計算直線距離（公里）
  - `getInterDistrictTravelMinutes(from, to, departTime)`：次生活圈間行車時間（t4）
  - `getSubCircle(district)`：行政區→次生活圈映射

### [完成] 行程卡片支援單一訂單智慧排單
- **按鈕**：行程卡片下方「退單」旁新增「智慧排單」按鈕（藍色，`bg-[#0C447C]`）
- **行為**：點擊後只傳該張訂單 ID 至 API，只推薦銜接該筆訂單的行程
- **API**：`GET /api/schedule/recommend?orderId=xxx`（指定時只取該筆當觸發）
- **向後相容**：不傳 orderId 時維持原本全部訂單邏輯（頂部「智慧排班」按鈕不變）

### [完成] 接單衝突提醒 + 退單扣點 + 5小時鎖定
- **衝突提醒**：所有時間衝突改為提醒（60 分鐘內），不再阻擋接單
  - 提醒：與現有行程時間接近、退單扣 10%、請勿強接太緊繃的配趟
- **退單扣點**（`POST /api/orders/[id]/cancel`）：司機退單扣 10%，訂單還原 PUBLISHED
- **5 小時鎖定**：行程時間 5 小時內不可退單
- **UI**：「我的行程」中 ACCEPTED 訂單卡片下方顯示「退單」按鍵

### [完成] 接單時間衝突硬性拒絕
- `/api/orders/[id]/accept` 接單時主動檢查衝突
- 接機後自由時間：scheduledTime + (尖峰150分 / 一般120分)
- 送機後自由時間：scheduledTime + 60分
- 新單必須在自由時間後 45 分鐘才能接
- 衝突時 API 直接拒絕（400），前端 alert 顯示「需等到 XX:XX 之後才能接」
- transaction 內再次檢查，防止 race condition
- 派單方建立訂單不檢查（不同派單方可有同航班接機單）

### [完成] 司機智慧配單功能
- **可用時間計算**（`src/lib/availability.ts`）：
  - 接機後自由時間：`scheduledTime + (尖峰150分 / 一般120分)`
  - 送機後自由時間：`scheduledTime + 60分`
  - 尖峰時段：07:00-09:00 / 16:00-18:00
  - 新單需在自由時間前 45 分鐘（預留抵達緩衝）
- **配單演算法**（`findMatchingOrders`）：
  - 車型過濾（與接單大廳一致）
  - 時間可行性檢查（canArriveOnTime）
  - 按 minutesFromFree 排序（最接近自由時間的最推薦）
- **GET /api/orders/match**：司機觸發檢查，回傳當前行程概覽 + 推薦清單
- **UI**：「我的行程」頁面 → 「檢查合適配單」按鍵 → 顯示當前行程序覽 + 推薦配單卡片 + 「配此單」按鍵

### [完成] 審核清單 UI 重新設計
- 標籤字體從 11px 加大至 13px，金額從 15px 加大至 28px 超大字
- 編排改為 Grid 布局：左側標籤群（編號+種類+車型+肯驛） + 右側 NT$ 超大金額 + 編輯/刪除按鈕
- 統一標籤樣式與訂單卡片一致（text-[15px] font-bold font-mono-nums px-3 py-1.5）
- 第二行加大時間 + 起訖點顯示
- 原始文字置於底部灰色區塊
- 底部 sticky 發布按鈕

### [完成] 單號順序修復 + 司機卡片樣式修正
- `DispatcherOrder` 介面補上 `orderSeq` / `orderDate` 欄位，修復 TypeScript build 錯誤
- 司機端行程卡片（非精簡模式）單號標籤背景：黑色 `#1C1917` → **紅色 `#FF385C`**
- **司機接單大廳卡片第一行重構**：單號 + 類型 + 車型 + 肯驛 統一在同一行右側，urgency + 狀態在最右側
- 車型標籤顏色改為暖米白底 `#F4EFE9` + 灰色字
- **兩邊卡片版面統一**：
  - 第一行：單號 + 種類 + 車型 + 肯驛（text-[15px] font-bold font-mono-nums rounded）| 狀態 + 日期時間
  - 司機端：金額 NT$ 加大至 text-[32px]、起訖點加粗 text-[16px] 橫排顯示
  - 派單方：同步金額和起訖點大小與司機端一致
  - 種類/車型/肯驛標籤：統一 `text-[15px] font-bold font-mono-nums px-3 py-1.5`
- **接單大廳車型過濾**：依司機註冊車型自動過濾（小車:小車+任意, 休旅:休旅+小車+任意, 9人座:全部, 任意R牌:R牌+任意）
- **接單大廳排序**：支援「日期/時間」「金額」「種類」三種排序，可切換 asc/desc
- **卡片重點重構**：
  - 司機端重點：日期/時間(大)、金額(32px)、種類、起迄點
  - 派單方重點：單號、接單狀況（大面積暖米白背景車資卡）、司機資訊
- 資料庫舊訂單（51筆）填補 `orderDate`（以 createdAt 計算）和 `orderSeq`（流水號 1-51）
- Prisma schema 同步至 Supabase 資料庫
- **備註折疊設計**：預設隱藏，按「查看備註」展開，Desktop（點擊）/ Mobile（tap）皆用 onClick 處理
- 資料庫舊訂單（51筆）填補 `orderDate`（以 createdAt 計算）和 `orderSeq`（流水號 1-51）
- Prisma schema 同步至 Supabase 資料庫

### [完成] 單號超顯眼標註
- `src/lib/utils.ts`：`formatOrderNo(scheduledTime, orderSeq)` → `YYYYMMDD-XXXX`（日期+流水號）
- **派單方卡片**：全寬 `#1C1917` 黑底橫幅，`#`+`YYYYMMDD-XXXX` 22px 白字
  - 待接單改 `#E24B4A` 紅色背景，單號置中偏左、狀態徽章右側
- **駕駛端卡片**：
  - 精簡模式（我的行程列表）：14px 白色單號 + 狀態徽章
  - 完整模式（接單大廳）：15px **紅色**單號背景 + 緊急倒數計時 + 狀態徽章
- 派單方 `DispatcherOrderCard.tsx` 重構：修復 JSX 結構錯誤（ROOT div 未關閉）

### [完成] 司機端接單流程（最新）
- 接單大廳 tab（改名）：只顯示 `status=PUBLISHED` 訂單
- 「立即接單」按鈕：修復條件 `PUBLISHED`（之前錯寫成 `PENDING`）
- 樂觀更新：接單後立即從大廳移除並加入「我的行程」
- 接單成功後自動切換至「我的行程」分頁
- API `/api/orders/[id]/accept`：交易鎖定，扣 5% 平台費
- **我的行程月曆**：`OrderCalendar` 元件，月份導航 + 日期狀態 dot + 點擊過濾當日行程

### [完成] 行程卡片編輯/刪除功能（最新）
- `DispatcherOrderCard` 支援內嵌編輯（無需 modal）
  - 可編輯：起點、終點、時間、金額、人數、行李、**備註**
  - 接機單：起點改為**下拉選單**（桃園機場、松山機場、清泉崗機場、小港機場），終點為文字輸入
  - 送機單：起點為文字輸入，終點改為**下拉選單**（桃園機場、松山機場、清泉崗機場、小港機場）
  - 其他類型（接船/送船/交通接駁/包車）：起點/終點均為文字輸入
  - 編輯後即時 API 存檔 + 刷新列表
- 已接單訂單（ACCEPTED/ARRIVED/IN_PROGRESS/COMPLETED）**自動鎖定編輯/刪除**
- 刪除附帶確認提示，刪除後自動刷新
- 單號顯示：黑體、黑字、`#` 前綴、`text-[14px]` → `text-[20px]`
- API `/api/orders/[id]` PATCH：刪除和編輯都加入狀態鎖定驗證
- 移除舊的 Edit Modal（page.tsx 中已刪除）

### [完成] 派單方 Stats 區塊重新設計
- 從 4 格 → 6 格：接機 / 送機 / 待接單 / 已接單 / 進行中 / 已完成
- 移除 icon，字體加大（數字 `text-[36px]` 粗體）
- 位置：`src/app/dashboard/dispatcher/page.tsx`

### [完成] 接機/送機接送船訂單類型
- 偵測到「基隆港」時，自動判斷 `pickup_boat`（接船）或 `dropoff_boat`（送船）
- 機場偵測優先於基隆港偵測
- 位置：`src/lib/ai.ts` 的 `extractType()` 函式
- `OrderType` 已加入 `pickup_boat` / `dropoff_boat`

### [完成] 接單大廳即時更新（SSE）
- Polling 間隔：15 秒 → **3 秒**
- 司機連線時主動廣播所有 `PUBLISHED` 訂單（不只新訂單）
- 位置：`src/app/api/drivers/events/route.ts`

### [完成] 「車頭」正名為「派單方」
- 所有 UI 文字、程式碼變數、檔案路徑全面替換
- Commit: `7ff773f refactor: 全面將「車頭」正名為「派單方"`

### [完成] 全域暖米白配色
- 主題色：`bg-[#FAF7F2]`（暖米白背景）
- 襯托色：`bg-[#F4EFE9]`（卡片/區塊）
- 紅色強調：`#E24B4A`（待接單警示）
- 綠色：`#008A05`（已完成）
- 藍色：`#0C447C`（進行中）
- 主要字體：System UI（跨平台一致性）
- 數字字體：`font-mono-nums`（等寬數字對齊）

---

## 修復歷史（重要）

| Commit | 問題 | 修復方式 |
|--------|------|---------|
| `92c035d` | 司機大廳過期行程不自動移除；接機/送機 Stats 分開顯示 | /api/orders 司機 OR 條件加入時間過濾；Stats 合併接機/送機，新增「未派出」顯示過期未派出數量 |
| `87e3415` | 接單大廳過期行程不自動移除（scheduledTime < now 仍顯示） | 查詢時加入 scheduledTime >= now 過濾，影響 /api/orders 和 /api/drivers/events SSE |
| `c6cbff8` | 接機觸發推薦1721送機單（時間邏輯錯誤）；t3以錯誤時間判斷尖峰；無3小時上限；跨日比較導致隔日單錯誤入選；無t4行政區行車時間 | 統一尖峰時段06:30-09:30/16:00-19:00；t3以落地時間t1判斷；t4查表取次生活圈行車時間；t1+3小時過濾；地理距離排序取3張 |
| `75c9c5f` | 兩種觸發類型共用同一套排序邏輯 | 送機觸發以落地時間排序；接機觸發以地理距離排序，固定門檻 T1+120分 |
| `6d121aa` | 智慧排班推薦只看時間，新莊接機後最佳推薦可能是遠地的新店接機 | 以地理距離（Haversine 公式）為排序主鍵，緩衝時間為次排序 |
| `23f1e8c` | 智慧排班只能針對全部行程，無法定針對單一訂單推薦 | 行程卡片新增「智慧排單」按鈕，API 支援 `?orderId=` 參數 |
| `4ee04a9` | Prisma Date 序列化導致前端 parseISO 崩潰 | `new Date(o.scheduledTime).toISOString()` 轉換所有日期欄位 |
| `fd08bbe` | 司機無法看到銜接訂單推薦、無法一次接多單 | 智慧排班系統、情境一/二推薦邏輯、排班預覽時間軸 |
| `c0573f7` | 智慧排班 UI 不完善 | 完整排班面板、銜接緊密度標籤、選單+總收入 |
| `75d4ff4` | 無排班 API | 新增 /api/schedule/recommend + /api/schedule/confirm |
| `0860c9d` | 無排班計算函數 | scheduling.ts 含尖峰判斷、行車時間、銜接緊密度 |
| `7ff5960` | 退單無時間限制、派單方刪單無限制 | 行程時間5小時內不可退單、派單方刪除已接單需等退單還原 |
| `9f0b0c3` | 接單無衝突檢查、退單不扣點 | 同類型60分阻擋、混合型警告、退單扣10%、訂單還原PUBLISHED |
| `9003c8a` | 司機可接時間衝突的單 | 接單時硬性檢查時間衝突，接機+150/120分、送機+60分自由，衝突直接拒絕 |
| `2d01b29` | 司機無法智能配單，容易接到來不及的單 | 新增可用時間計算+配單演算法，司機按「檢查合適配單」顯示推薦清單 |
| `7964738` | 審核清單字體太小不方便閱讀 | 標籤 11px→13px、金額 15px→28px，Grid 布局、統一標籤樣式、sticky 發布按鈕 |
| `e57bae1` | 司機可見所有訂單無車型過濾、無法排序、兩邊卡片重點不明確 | 車型過濾+排序功能、司機端重點金額/起迄點、派單方重點單號/狀況/司機資訊 |
| `c424f62` | 司機端/派單方卡片版面不一致、標籤大小不統一 | 兩邊統一結構，司機端金額+起訖點加大加黑，種類/車型置中 |
| `c0716c7` | 服務種類/車型標籤字體與單號不一致、備註區塊過長 | 統一 text-[15px] 粗體等寬、備註改可折疊晶片 |
| `99f10a2` | 司機卡片「接機/車型」標籤尺寸小、位置分散 | 第一行重構：單號+類型+車型+肯驛同尺寸同列，右側倒數+狀態 |
| `ab22508` | 舊訂單 orderSeq=0、司機卡片單號標籤為黑色 | 填補舊資料 orderSeq+orderDate、司機卡片改紅色背景 |
| `5abf76d` | 編輯模式缺備註欄位、起點/終點為純文字輸入 | 新增備註 + 接機起點/送機終點改為機場下拉選單 |
| `3e863b8` | 行程卡片無編輯/刪除功能 | 改為內嵌編輯模式 |
| `6289afa` | 發布訂單後司機接單大廳看不到 | SSE 縮短輪詢+連線時廣播 |
| `0ecea1e` | 訂單發布 API 500 錯誤 | — |
| `2d6e1f2` | 訂單發布失敗 | — |
| `cc86cfc` | 車型顯示字串轉換錯誤 | inline 內聯轉換邏輯 |
| `19dda48` | vehicle API 值驗證問題 | API 端加入白名單驗證 |
| `db04390` | 發布時車型字串未轉換為 enum | publish 流程加入轉換 |
| `18dd0eb` | 車型選擇 TypeScript 型別錯誤 | 改為顯示字串 |
| `da95b40` | AI 解析規則需更新 | — |
| `bd2d8b1` | AI 解析邏輯需修正 | — |
| `ae9f564` | API 訂單錯誤處理冗餘 | 簡化錯誤處理 |

---

## 技術現況

### 技術棧
- **Framework**: Next.js 14 App Router + TypeScript
- **UI**: Tailwind CSS + 自定義元件（shadcn/ui 改造）
- **Database**: PostgreSQL + Prisma ORM v7
- **認證**: 自定義 JWT（無 NextAuth）
- **部署**: Vercel
- **Supabase**: PostgreSQL（Transaction Pooler port 6543）

### 專案結構
```
src/
├── app/
│   ├── (auth)/          # login, register
│   ├── api/
│   │   ├── auth/        # JWT 認證
│   │   ├── orders/      # 訂單 CRUD + parse + accept
│   │   ├── drivers/     # 司機資料 + 位置 + SSE events + balance
│   │   └── dispatchers/ # 派單方資料 + settlement
│   ├── dashboard/
│   │   ├── driver/page.tsx    # 司機端
│   │   └── dispatcher/page.tsx # 派單方端
│   └── page.tsx         # Landing page
├── components/
│   ├── ui/              # Button, Card, Input, Badge
│   ├── driver/OrderCard.tsx    # 司機端行程卡片
│   └── dispatcher/
│       ├── OrderCard.tsx       # 派單方行程卡片（可內嵌編輯）
│       └── FleetControl.tsx    # 行控中心
└── lib/
    ├── prisma.ts
    ├── auth.ts
    ├── auth-context.tsx
    └── ai.ts            # AI 訂單解析（Claude Haiku）
```

### 訂單狀態流程
```
PENDING → PUBLISHED → ASSIGNED → ACCEPTED → ARRIVED → IN_PROGRESS → COMPLETED
                                    ↘ (拒絕) → PUBLISHED
```

### API 端點
| Method | 端點 | 說明 |
|--------|------|------|
| POST | `/api/auth/[...nextauth]` | 註冊 |
| PUT | `/api/auth/[...nextauth]` | 登入 |
| GET | `/api/auth/[...nextauth]` | 取得當前用戶 |
| GET/POST | `/api/orders` | 訂單列表 / 建立 |
| PATCH | `/api/orders/[id]` | 更新/刪除（狀態鎖定） |
| POST | `/api/orders/parse` | AI 解析訂單文字 |
| POST | `/api/orders/[id]/accept` | 司機接單（含衝突檢查） |
| POST | `/api/orders/[id]/cancel` | 司機退單（扣10%） |
| GET | `/api/schedule/recommend` | 智慧排班推薦 |
| POST | `/api/schedule/confirm` | 確認排班（一次接多單） |
| GET | `/api/drivers/events` | SSE 即時訂單推播 |
| GET | `/api/drivers/balance` | 司機帳務 |
| GET | `/api/dispatchers/settlement` | 派單方結算 |

### 資料模型（Prisma schema）
- **User**: email, password, name, phone, role (DRIVER/DISPATCHER/ADMIN)
- **Driver**: licensePlate, carType, carColor, balance, status (ONLINE/OFFLINE/BUSY)
- **Dispatcher**: companyName, commissionRate
- **Order**: 完整接送資訊 + status + vehicle + plateType + kenichiRequired
- **Transaction**: RIDE_FARE / PLATFORM_FEE / RECHARGE / WITHDRAW

### 車型對照
| 顯示值 | API 值 |
|--------|--------|
| 小車（5人座） | `small` |
| 休旅（7人座） | `suv` |
| 9人座 | `van9` |
| 任意 | `any` |
| 任意R牌 | `any_r` |

### 機場簡稱
桃機(TPE) / 松機(TSA) / 小港(KHH) / 清泉崗(RMQ)

---

## 測試帳號
- **司機**: `driver1@test.com`
- **派單方**: `dispatcher1@test.com`

---

## 設計系統（快速參考）

- 背景色：`#FAF7F2`（暖米白）
- 卡片背景：`white`
- 卡片框線：`#DDDDDD`
- 主文字：`#222222`
- 次文字：`#717171`
- 警示紅：`#E24B4A`
- 成功綠：`#008A05`
- 藍色（資訊）：`#0C447C`
- 數字一律使用 `font-mono-nums` class

### 狀態顏色對照
| 狀態 | 背景色 | 字色 |
|------|--------|------|
| PENDING / PUBLISHED | `#FCEBEB` | `#A32D2D` |
| ASSIGNED / ACCEPTED | `#FFF3E0` | `#B45309` |
| ARRIVED / IN_PROGRESS | `#E6F1FB` | `#0C447C` |
| COMPLETED | `#E8F5E8` | `#008A05` |
| CANCELLED | `#FCEBEB` | `#A32D2D` |

---

## 待辦（可能的下一步）

- [x] 司機接單大廳車型過濾 + 排序功能
- [x] 智慧排單排序策略重構（接機觸發→地理距離/送機觸發→落地時間）
- [x] 行程卡片單一訂單智慧排單
- [x] **小車頭專區**：Premium 司機專屬發單功能，LINE 風格 14 步對話流程
- [ ] **使用者註冊功能改善** — 車型改為下拉選單、車色改為下拉選單、強化驗證
- [ ] **訂閱與金流系統**（規格文件：`docs/subscription-system.md`）
  - Prisma schema 異動
  - UNIPAY 整合
  - 司機訂閱/儲值頁面
  - 智慧排班 quota 限制
- [ ] 司機「我的行程」狀態更新（抵達/開始/完成按鈕）
- [x] **派單方帳務中心**：6 格 Stats（筆數+金額）、轉帳狀態篩選、不可逆已轉帳按鈕（下單後通知司機）、下載 Excel 含銀行帳號
- [ ] 司機端即時位置追蹤
- [ ] 通知系統（push / in-app）
- [ ] Admin 後台
- [ ] 轉帳確認功能
- [ ] 自動化結算（每天跑一次）
- [ ] **小隊互助系統**（規格文件已完成：`docs/squad-system.md`）
  - 小隊建立/加入/退出/解散
  - 小隊內轉單（5%，比退單10%便宜）
  - 派單方同意轉單確認
  - 行程前3小時鎖定
  - **Premium 用戶專屬功能**
- [ ] 派單方點數帳戶：派單方刪除司機已接的單時，扣派單方 5% 補貼司機

---

## 最新討論摘要

### 2026-04-08
- **派單方帳務中心**：Brainstorm → 規格文件 → 實作完成。6 格 Stats（含待轉帳/已轉帳筆數和金額）、轉帳狀態下拉篩選、不可逆已轉帳按鈕（按下確認後鎖定並通知司機）、下載 Excel 含銀行帳號。API：`GET /api/dispatchers/settlement` 加強 + `POST /api/dispatchers/settlement/transfer` 新增。

### 2026-04-08
- **小車頭專區 Brainstorm 完成**：Premium 司機專屬發單功能，共 12 步對話流程（LINE 風格泡泡介面）
- **決定 Tab 方式呈現**（選項C），普通司機可見但鎖定
- **費用模式邏輯確認**：
  - 客下轉帳：派單人已向客人收錢，司機填「實拿金額」
  - 代收現金：派單人尚未收錢，司機現場收現後回金部分傭金給派單人，司機填「代收」+「回金」，即時顯示「實拿」
- **行李設計**：Loop 流程（尺寸→數量→確定/還有→loop）
- **航班規則**：接機必填，送機選填
- **介面清理**：移除所有 emoji 和 ← 箭頭符號，保持專業感（最後發現「確認發單上架」按鈕仍殘留火箭 emoji，已移除）
- **Mockup 位置**：http://localhost:57372/03-full-chat.html
- **下一步**：寫規格文件 → 實作 → commit

### 2026-04-04（下午）
- **司機大廳過期訂單過濾**：API 修復，原本 scheduledTime >= now 只在 recommended=true 生效，現改為司機查詢 PUBLISHED 時全面套用
- **派單方 Stats 重構**：6 格 → 6 格（接機+送機合併顯示、未派出新增），PICKUP/DROPOFF 統計加入 _boat 類型
- **倒數計時移除**：司機卡片上最接近過期的倒數計時移除
- **智慧排班系統重新設計**：
  - isSystemRecommended 欄位：司機自選=false，系統排=true
  - 只有 isSystemRecommended=false 的單可以當觸發點
  - **free 用戶**：每日 1 套（司機自選觸發單 + 系統排銜接單 = 2單），隔日重置
  - **premium 用戶**：每日 3 套（6單），月費 $299 / 年費 $3,000
  - 一般用戶一天只能手動接一次單，不能接第二單 a2+b2
- **訂閱與金流系統**（`docs/subscription-system.md`）：
  - 月費 $299（30天）、年費 $3,000（365天），D+1 到期
  - 儲值：$500→520點/$1000→1050點/$2000→2150點/$3000→3300點
  - UNIPAY API 直接串接（已參考 GF repo 的實作）
  - 小隊模式列為 Premium 功能

### 2026-04-04
- **接機觸發邏輯重構**：根據用戶提供的 t1/t2/t3/t4 時間鏈重新設計
  - t1 = 落地時間；t2 = 出關緩衝(60分)；t3 = 機場→目的地行車(尖峰75/離峰60，根據t1判斷)；t4 = 目的地→送機上車行政區(查表)
  - 篩選：t1+3小時內所有送機單（不限行政區）
  - 排序：地理距離最近優先
  - 上限：取3張
- **次生活圈行車時間表**：整合 docs/雙北次生活圈劃分.pdf（11個分區）+ docs/雙北次生活圈通勤預估時間.pdf（t4查表）
- **尖峰時段修正**：早上尖峰改為 06:30-09:30（原09:00）；下午尖峰 16:00-19:00

### 2026-04-03
- **智慧排班系統實作**：依據 docs/smart-scheduling.md 規格實作完整功能
- **時間參數**：`isPeakHour()`（06:30-09:00/16:00-19:00）、`getTravelMinutes()`（雙北-桃機/松山）
- **情境一**（送機→接機）：落地時間在司機到機場 -20分~+40分
- **情境二**（接機→送機）：緩衝 75-135 分鐘
- **API**：`/api/schedule/recommend` 回傳推薦清單+時間軸；`/api/schedule/confirm` 一次接多單（transaction 回滾）
- **UI**：「智慧排班」面板含觸發行程、排班預覽時間軸、銜接緊密度標籤（完美銜接/需等候/時間較趕）、卡片點選加入排班
- **多單銜接**：確認後可再次呼叫智慧排班，持續銜接（最多 6 單）
- **QA 發現 bug**：Prisma Date 物件直接 JSON 序列化後，`parseISO()` 在前端崩潰（「此頁面無法載入」錯誤）
- **修復**：`/api/schedule/recommend` 的 `toOrder()` 函式回傳 `any` 型別，明確將所有 Date 欄位轉為 ISO 字串
- **單一訂單排單**：行程卡片下方新增「智慧排單」按鈕，點擊後只傳該張訂單至 API 做推薦，範圍精準到單筆
- **地理距離排序**：以 Haversine 公式計算行政區座標直線距離，取代舊的時間唯一排序。新增 41 個台北+新北行政區座標、`getDistrictCoords()`、`getDistance()`、`distanceKm` 欄位。排序優先：地理距離差 > 1km 以距離，否則以等待/緩衝時間。
- **排序策略修正**：送機觸發→落地時間排序；接機觸發→地理距離排序+固定 T1+120分鐘門檻
