# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 專案現況（2026-04-03）

### 最後 commit
```
75c9c5f fix(scheduling): 區分觸發類型使用不同排序策略
```
落後 origin/main 0 個 commits。（上一個：`6d121aa` 地理距離排序）

---

## 目前開發階段：第三階段 - 司機端 MVP

派單方行控中心已完成（第一、二階段）。現正處理司機端接單流程。

---

## 近期進度

### [完成] 智慧排單排序策略：區分觸發類型
- **送機觸發**（司機確定在桃園機場）：
  - 篩選：落地時間 >= 司機到機場時間，上限+120分鐘
  - 排序：**落地時間**（最早的航班最推薦），地理距離無關
- **接機觸發**（司機要去接送機的地點，目的地行政區未知）：
  - 時間門檻：固定門檻 `scheduledTime > T1落地 + 120分鐘`（60行李+60行車）
  - 排序：**地理距離為主**（從接機目的地行政區到送機上車行政區）、緩衝時間為次
- **實作**：
  - 41 個台北市+新北市行政區座標（DISTRICTS array）
  - `getDistrictCoords(location)`：地點字串→行政區座標
  - `getDistance()`：Haversine 公式計算直線距離（公里）

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
- [ ] 司機「我的行程」狀態更新（抵達/開始/完成）
- [ ] 派單方帳務中心
- [ ] 司機端即時位置追蹤
- [ ] 通知系統（push / in-app）
- [ ] Admin 後台
- [ ] 轉帳確認功能
- [ ] 自動化結算（每天跑一次）
- [ ] **小隊模式**：每個用戶可加 10 位隊員，隊員間互相支援轉單（轉單費 8%，低於一般 10%）
- [ ] 派單方點數帳戶：派單方刪除司機已接的單時，扣派單方 5% 補貼司機

---

## 最新討論摘要

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
