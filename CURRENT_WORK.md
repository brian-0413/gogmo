# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 專案現況（2026-04-02）

### 最後 commit
```
9003c8a feat(accept): 司機接單時硬性檢查時間衝突
```
落後 origin/main 0 個 commits。

---

## 目前開發階段：第三階段 - 司機端 MVP

派單方行控中心已完成（第一、二階段）。現正處理司機端接單流程。

---

## 近期進度

### [完成] 接單時間衝突硬性拒絕（最新）
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
- **Database**: PostgreSQL + Prisma ORM v5
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
| POST | `/api/orders/[id]/accept` | 司機接單 |
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
- [ ] 司機「我的行程」狀態更新（抵達/開始/完成）
- [ ] 派單方帳務中心
- [ ] 司機端即時位置追蹤
- [ ] 通知系統（push / in-app）
- [ ] Admin 後台
- [ ] 轉帳確認功能
- [ ] 自動化結算（每天跑一次）

---

## 最新討論摘要

### 2026-04-02
- 行程卡片編輯：從 modal 改為內嵌編輯，司機已接單的訂單鎖定編輯
- 單號從 `text-[14px]` 加大為黑體黑字
- SSE polling 3 秒，連線時廣播所有已發布訂單
- 三模型同步策略：建立 `CURRENT_WORK.md`，每次 commit 後更新並 push GitHub
- 編輯時新增「備註」欄位
- 接機單起點改為**下拉選單**（桃園/松山/清泉崗/小港），送機單終點改為**下拉選單**
- 司機端接單大廳：修復「立即接單」按鈕條件、樂觀更新、接完自動切換分頁
- 司機端「我的行程」新增月曆，點擊日期過濾當日行程
- **審核清單 UI 重新設計**：標籤 11px→13px、金額 15px→28px Grid 布局、統一標籤樣式、sticky 發布按鈕
- **司機智慧配單**：按「檢查合適配單」按鍵，系統依行程可用時間推薦後續訂單；接機+150/120分、送機+60分自由；司機手動觸發，平台不主動推播
