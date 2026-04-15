# goGMO 機場接送派單平台

機場接送司機與派單方的媒合平台，支援 AI 智能解析訂單、司機一鍵接單、智慧排班、小隊互助轉單等功能。

---

## 技術棧

- **Framework**: Next.js 14 App Router + TypeScript
- **UI**: Tailwind CSS + 自定義元件（shadcn/ui 改造）
- **Database**: PostgreSQL + Prisma ORM v7（Supabase, Transaction Pooler）
- **認證**: 自定義 JWT（無 NextAuth）
- **AI 解析**: Claude Haiku API（訂單自動解析）
- **文件儲存**: Google Drive API（司機證件）
- **金流**: PAYUNi（信用卡加值）、銀行轉帳
- **部署**: Zeabur

---

## 核心功能

### 司機端
- **接單大廳**：即時 SSE 推播（新訂單 3 秒更新）、車型自動過濾、三種排序
- **我的行程**：月曆檢視、衝突檢查、一鍵接單 / 退單（扣 10%）、4 鍵狀態更新（開始/抵達/客上/客下）
- **智慧排班**：地理距離 + 時間鏈推薦、支援送機觸發 / 接機觸發兩種情境
- **小車頭專區**：Premium 司機專屬，LINE 風格 14 步對話發單
- **小隊互助**：bonus 機制、3% 轉單費、邀請制搶單
- **個人中心**：文件上傳管理（Google Drive）、點數加值（PAYUNi / 銀行轉帳）、銀行帳號設定

### 派單方端
- **行控中心**：6 格 Stats（接機/送機/待接單/已接單/進行中/已完成）、訂單卡片牆
- **AI 解析**：貼單自動解析（偵測 TPE/TSA/KHH/RMQ/基隆港）、支援接機/送機/接船/送船/交通接駁/包車
- **內嵌編輯**：無需 modal，已接單後自動鎖定編輯/刪除
- **審核清單**：Grid 布局、逐筆勾選上架
- **帳務中心**：6 格 Stats（待轉帳/已轉帳筆數與金額）、轉帳狀態篩選、不可逆轉帳、Excel 下載（含銀行帳號）
- **SSE 即時同步**：司機狀態更新即時反映在卡片進度燈號

### 管理員端
- **帳號審核**：司機 / 派單方分頁審查、文件檢視（行照/駕照/保險證）
- **Drive 測試**：上傳測試區（用於除錯）
- **用戶管理**：點數調整、密碼重設
- **費率設定**：接單費率 / 退單費率 / 轉單費率 / bonus 最低點數
- **Cron**：每日文件過期檢查（到期前 30 天警示、到期自動凍結）

---

## 專案結構

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── api/
│   │   ├── admin/          # 審核、用戶管理、Drive測試、費率設定
│   │   ├── auth/           # 登入、註冊、驗證 Email、密碼重設
│   │   ├── cron/           # 每日排程（文件過期、行程鎖定）
│   │   ├── dispatchers/    # 派單方資料、SSE事件、結算
│   │   ├── drivers/        # 司機資料、SSE事件、點數/加值、文件
│   │   ├── orders/         # 訂單 CRUD、AI解析、接單/退單/狀態/轉單
│   │   ├── payuni/         # PAYUNi 加值通知
│   │   ├── schedule/       # 智慧排班推薦與確認
│   │   ├── squads/         # 小隊互助：池、邀請、回應、搶單
│   │   └── uploads/        # 檔案上傳
│   ├── dashboard/
│   │   ├── admin/page.tsx           # 管理員首頁
│   │   ├── admin/users/page.tsx     # 用戶管理
│   │   ├── admin/reviews/page.tsx   # 帳號審核
│   │   ├── admin/drive-test/page.tsx # Drive 測試
│   │   ├── dispatcher/page.tsx      # 派單方行控中心
│   │   ├── driver/page.tsx          # 司機端主頁
│   │   └── driver/order/[id]/page.tsx # 司機訂單詳情
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── email-verified/page.tsx
│   ├── reset-password/page.tsx
│   └── page.tsx             # Landing Page
├── components/
│   ├── ui/                  # Button, Card, Input, Badge
│   ├── auth/                # 登入/註冊表單（Driver/Dispatcher/Admin/ForgotPassword）
│   ├── dispatcher/
│   │   ├── OrderCard.tsx           # 派單方訂單卡片（內嵌編輯）
│   │   ├── FleetControl.tsx        # 行控中心
│   │   ├── CreateDefaultsCard.tsx  # 預設值設定
│   │   ├── ReviewItemCard.tsx     # 審核清單
│   │   ├── SettlementTab.tsx      # 派單方帳務中心
│   │   ├── TransferConfirmBanner.tsx
│   │   └── DocumentViewerModal.tsx # 司機文件檢視
│   └── driver/
│       ├── OrderCard.tsx           # 司機訂單卡片
│       ├── ProgressBar.tsx         # 4 格進度燈號
│       ├── OrderDetailActions.tsx  # 開始/抵達/客上/客下按鈕
│       ├── SmartSchedulePanel.tsx  # 智慧排班面板
│       ├── OrderCalendar.tsx       # 月曆檢視
│       ├── SettlementTab.tsx       # 司機帳務中心
│       ├── SquadTab.tsx            # 小隊互助池
│       ├── TransferRequestForm.tsx # 轉單申請表
│       ├── SelfDispatchChat.tsx    # 小車頭對話發單（LINE風格）
│       └── ProfileTab.tsx          # 司機個人中心
└── lib/
    ├── prisma.ts            # Prisma client（adapter 模式）
    ├── auth.ts / auth-context.tsx  # JWT 認證
    ├── ai.ts                # Claude Haiku 訂單解析
    ├── constants.ts         # 魔法數字重構（費用率/平台費等）
    ├── validation.ts        # 統一驗證層
    ├── availability.ts      # 司機可用時間計算
    ├── scheduling.ts        # 智慧排班演算法
    ├── utils.ts             # formatOrderNo 等工具
    ├── bank-codes.ts        # 37 家台灣銀行代碼
    ├── google-drive.ts      # Drive API 操作
    ├── payuni.ts            # PAYUNi AES-256-GCM 加解密
    ├── sse-emitter.ts       # SSE 事件發射器
    ├── email.ts             # Email 發送（驗證信等）
    ├── rate-limit.ts        # 速率限制
    └── api-utils.ts         # API 通用工具
prisma/
├── schema.prisma            # Prisma schema（含所有 model）
├── seed.ts                  # 資料庫 seeding
└── prisma.config.ts         # Prisma 7 config
docs/
├── order-parsing-rules.md        # 訂單解析規則
├── order-parsing-test-cases.md   # 測試案例
├── smart-scheduling.md           # 智慧排班規格
├── squad-system.md               # 小隊互助系統規格
└── superpowers/
    ├── specs/                     # 功能規格文件
    └── plans/                     # 實作計畫文件
```

---

## 開發規範

- 所有 UI 文字使用**繁體中文**
- Commit message 使用**中文**，不使用 emoji
- 每次修改後執行 `npm run build` 確認編譯正確
- 功能完成後：`更新 CURRENT_WORK.md` -> `git add + commit` -> `git push`
- 遵循 Karpathy 編碼原則：Think Before Coding、Simplicity First、Surgical Changes、Goal-Driven Execution

### 創意開發流程

```
新想法 → brainstorm 討論需求 → 建立規格文件 → 分派 ABC 實作 → C 測試驗證 → D 撰寫文件 → commit → 更新 CURRENT_WORK.md
```

---

## 快速開始

```bash
# 安裝依賴
npm install

# 設定環境變數
cp .env.example .env.local
# 編輯 .env.local，填入以下變數：
# DATABASE_URL          — Supabase PostgreSQL（Transaction Pooler）
# ANTHROPIC_API_KEY    — Claude API key（用於 Haiku 解析）
# JWT_SECRET            — JWT 簽章密鑰
# GOOGLE_SERVICE_KEY    — Google Service Account JSON（用於 Drive API）
# RESEND_API_KEY        — Resend API key（用於 Email）
# PAYUNI_*              — PAYUNi 金流 API 參數

# 資料庫遷移
npx prisma migrate dev

# 執行 seed（可選）
npx prisma db seed

# 啟動開發伺服器
npm run dev
```

---

## 測試帳號

| 角色 | 帳號 | 密碼 |
|------|------|------|
| 司機 | `driver1@test.com` | （聯絡管理員） |
| 派單方 | `dispatcher1@test.com` | （聯絡管理員） |
| 管理員 | `admin@goGMO.com` | `admin123` |

---

## 商業邏輯

- **司機**：預充值點數，每接一單扣 5% 媒合費
- **派單方**：初期免費，後期收 2-3%
- **小隊轉單**：3% 轉單費（比退單 10% 便宜）
- **行程鎖定**：行程時間 5 小時內不可退單
- **新用戶**：首次註冊送 500 點

## 訂單狀態流程

```
PENDING → PUBLISHED → ASSIGNED → ACCEPTED → ARRIVED → IN_PROGRESS → COMPLETED
                                    ↘ (拒絕) → PUBLISHED
```

---

## API 統一回傳格式

```json
{ "success": true, "data": ... }
{ "success": false, "error": "錯誤訊息" }
```
