# CURRENT_WORK.md

> 此檔案由 Claude Code 主要 session 維護，每次 commit 後更新。
> 推送到 GitHub 後，Haiku / Sonnet / Opus 任何對話都能快速掌握進度。

---

## 專案現況（2026-04-02）

### 最後 commit
```
3e863b8 feat: 行程卡片新增編輯/刪除功能與內嵌編輯模式
```
落後 origin/main 14 個 commits，尚未 push。

---

## 目前開發階段：第二階段 UI/UX 優化

正在全面重新設計平台介面，以「派單方行控中心」為核心向外擴展。

---

## 近期進度

### [完成] 行程卡片編輯/刪除功能（最新）
- `DispatcherOrderCard` 支援內嵌編輯（無需 modal）
  - 可編輯：起點、終點、時間、金額、人數、行李
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
