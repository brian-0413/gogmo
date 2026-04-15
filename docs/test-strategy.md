# 測試策略文件

> 建立日期：2026-04-16
> 負責：測試工程師 C
> 目標覆蓋率：80%

---

## 1. 測試目標

在下一個冲刺週內將測試覆蓋率從目前的 **12%** 提升至 **80%**。

---

## 2. 測試分類架構

```
單元測試 (Unit Tests)
  └── lib/ 商業邏輯（純函式，無 DB/無 I/O）
      ├── auth.ts          — JWT 產生/驗證、密碼 hash
      ├── ai.ts            — 訂單解析（rule-based）
      ├── payuni.ts        — 加密/解密、endpoint
      ├── constants.ts     — 業務常數（本身就是常數，測試值域）
      └── validation.ts    — 欄位驗證邏輯

整合測試 (Integration Tests)
  └── app/api/**/route.ts  — API routes（含 HTTP 層、DB、認證）
      ├── 認證流程
      │   ├── POST /api/auth/login
      │   ├── POST /api/auth/register
      │   └── POST /api/auth/forgot-password
      ├── 司機接單
      │   ├── POST /api/orders/[id]/accept
      │   ├── POST /api/orders/[id]/cancel
      │   └── POST /api/orders/[id]/status
      ├── 轉單流程
      │   ├── POST /api/orders/[id]/transfer-request
      │   ├── POST /api/orders/[id]/transfer-approve
      │   ├── POST /api/orders/[id]/transfer-reject
      │   └── POST /api/orders/[id]/transfer-withdraw
      ├── 小隊系統
      │   ├── POST /api/squads/invite
      │   ├── POST /api/squads/respond
      │   ├── GET  /api/squads/pool
      │   └── POST /api/squads/pool/[id]/claim
      ├── 派單方
      │   ├── GET/POST /api/orders
      │   └── GET /api/dispatchers/settlement
      └── 金流
          ├── POST /api/drivers/topup/create
          └── POST /api/payuni/topup/notify

E2E 測試 (Playwright)
  └── e2e/ — 重要使用者流程
      ├── login-flow.spec.ts       — 司機/派單方登入流程
      ├── order-accept.spec.ts     — 接單大廳 → 接單 → 我的行程
      └── transfer-flow.spec.ts    — 轉單完整流程
```

---

## 3. 各模組測試規劃

### 3.1 認證流程（Priority: P0）

#### POST /api/auth/login

**測試場景**：

| ID | 場景 | 測試資料需求 | Mock 方式 |
|----|------|-------------|-----------|
| L-01 | 司機正常登入（車牌+密碼） | driver fixture、bcrypt hash | `prisma.user.findFirst` 回傳司機 |
| L-02 | 派單方正常登入（Email+密碼） | dispatcher fixture | `prisma.user.findUnique` 回傳派單方 |
| L-03 | 密碼錯誤 → 401 | 錯誤密碼 | `verifyPassword` 回傳 false |
| L-04 | 帳號不存在 → 401 | 不存在的 Email | `prisma.user.findUnique` 回傳 null |
| L-05 | 缺少必填欄位 → 400 | 缺 account 或 password | 變動 request body |
| L-06 | 無效角色 → 400 | role='INVALID' | 變動 request body |
| L-07 | rate limit 觸發 → 429 | 短時間大量請求 | `checkRateLimit` 回傳 429 |

#### POST /api/auth/register

| ID | 場景 | 測試資料需求 | Mock 方式 |
|----|------|-------------|-----------|
| R-01 | 司機正常註冊 | email/phone/name/password/licensePlate/carType | `prisma.user.findUnique` null, `prisma.user.create` 成功 |
| R-02 | 派單方正常註冊 | email/phone/name/password/companyName | 同上 |
| R-03 | Email 已存在 → 400 | 重複 email | `prisma.user.findUnique` 回傳現有用戶 |
| R-04 | 車牌已註冊（司機） → 400 | 重複 licensePlate | `prisma.driver.findFirst` 回傳現有司機 |
| R-05 | 缺少必填欄位 → 400 | 缺漏任一欄位 | 變動 extraData |
| R-06 | Prisma 錯誤 → 500（不回傳內部訊息） | DB 錯誤 | `prisma.user.create` throw |

#### JWT 函式單元測試（lib/auth.ts）

| ID | 場景 | Mock 方式 |
|----|------|-----------|
| JWT-01 | generateToken + verifyToken 配對成功 | 不需要 mock |
| JWT-02 | verifyToken 使用錯誤 secret → 回傳 null | 錯誤 secret |
| JWT-03 | verifyToken 過期 token → 回傳 null | 過期 expiresIn |
| JWT-04 | verifyToken 格式錯誤 → 回傳 null | 亂數 token |
| JWT-05 | hashPassword + verifyPassword 配對成功 | 不需要 mock |
| JWT-06 | verifyPassword 錯誤密碼 → false | 錯誤密碼 |

**測試資料需求**：
- 測試用 JWT_SECRET 寫在 `tests/setup.ts`
- bcrypt test vectors（固定 salt rounds = 12）

**Mock 策略**：
- `vi.mock('@/lib/prisma')` — 隔離 DB
- `vi.mock('@/lib/email')` — 隔離 email send

---

### 3.2 司機接單（Priority: P0）

#### POST /api/orders/[id]/accept

| ID | 場景 | 測試資料需求 | Mock 方式 |
|----|------|-------------|-----------|
| A-01 | 正常接單（PUBLISHED） | driver(ACTIVE, 有銀行帳號, 餘額足夠), order(PUBLISHED) | `prisma.order.findUnique` + `prisma.driver.findUnique` + transaction |
| A-02 | 正常接單（ASSIGNED -> 自己） | order.ASSIGNED, driverId = 自己 | 同上 |
| A-03 | skipWarning=true + 衝突，冷卻中 → 429 | driver.lastConflictAcceptAt 剛設定 | `prisma.driver.findUnique` 回傳 recent cooldown |
| A-04 | skipWarning=true + 衝突，冷卻已過 → 成功 | driver.lastConflictAcceptAt 很久以前 | 同上 |
| A-05 | 點數不足 → 400 | driver.balance < platformFee | `prisma.driver.findUnique` 回傳低餘額 |
| A-06 | 帳號未啟用（ACCEPTED/非 ACTIVE）→ 403 | user.accountStatus != 'ACTIVE' | mock accountStatus |
| A-07 | 缺少銀行帳號 → 400 | driver.bankCode=null 或 bankAccount=null | mock bank fields |
| A-08 | 訂單不存在 → 404 | order=null | `prisma.order.findUnique` 回傳 null |
| A-09 | 訂單已接單（ASSIGNED -> 他人）→ 400 | order.ASSIGNED, driverId != 自己 | mock driverId mismatch |
| A-10 | 訂單狀態非 PUBLISHED/ASSIGNED → 400 | order.status = ACCEPTED | mock status |
| A-11 | 衝突警告返回（未 skipWarning，有衝突）→ 回傳 warning | driver 有 ACCEPTED 行程 | `prisma.order.findMany` 回傳 active orders |
| A-12 | 無衝突直接接單 → 不返回 warning | driver 無 ACCEPTED 行程 | `prisma.order.findMany` 回傳 [] |
| A-13 | 接單後扣 5% 平台費 | 計算 floor(price * 0.05) | verify transaction record |
| A-14 | 接單後 Transaction 記錄正確 | type=PLATFORM_FEE, amount<0 | verify transaction data |
| A-15 | 司機角色驗證 → 非司機 403 | user.role = DISPATCHER | mock role |
| A-16 | 未授權 → 401 | 無 token | 不提供 Authorization header |

**測試資料需求**：
- driver fixture：ACTIVE、有銀行帳號、餘額 >= 平台費
- order fixture：PUBLISHED 狀態、未被接走
- 衝突訂單：ACCEPTED 狀態、時間差 < 60 分

**Mock 策略**：
- `vi.mock('@/lib/prisma')` — 隔離 DB
- `vi.mock('@/lib/auth')` — 隔離 getUserFromToken
- `vi.mock('@/lib/api-utils')` — 隔離 rate limit
- `prisma.$transaction` — vitest 可以 mock transaction 回傳值

#### POST /api/orders/[id]/cancel

| ID | 場景 |
|----|------|
| C-01 | 正常退單（ACCEPTED）→ 扣除 10%，訂單還原 PUBLISHED |
| C-02 | 行程前 5 小時內退單 → 400 |
| C-03 | 非司機本人退單 → 403 |
| C-04 | 已完成/已取消訂單 → 400 |
| C-05 | 未授權 → 401 |

---

### 3.3 轉單流程（Priority: P1）

#### POST /api/orders/[id]/transfer-request

| ID | 場景 |
|----|------|
| TR-01 | 正常發起 → PENDING_DISPATCHER，建立 OrderTransfer |
| TR-02 | 行程前 1 小時內 → 400 |
| TR-03 | 無小隊成員 → 403 |
| TR-04 | 已有進行中轉單 → 400 |
| TR-05 | bonusPoints < 最低門檻 → 400 |
| TR-06 | bonusPoints > 餘額 → 400 |
| TR-07 | bonusPoints NaN/Infinity → 400 |
| TR-08 | 非本人訂單 → 403 |
| TR-09 | 狀態非 ACCEPTED → 400 |
| TR-10 | broadcastDispatcherEvent 被呼叫（確認廣播）|

#### POST /api/orders/[id]/transfer-approve

| ID | 場景 |
|----|------|
| TA-01 | 派單方正常核准 → PENDING_SQUAD，廣播 SQUAD_POOL_NEW |
| TA-02 | 非派單方本人 → 403 |
| TA-03 | 轉單狀態非 PENDING_DISPATCHER → 400 |
| TA-04 | bonusPoints > 接手司機餘額 → 400 |

#### POST /api/squads/pool/[id]/claim

| ID | 場景 |
|----|------|
| CL-01 | 正常搶單 → APPROVED，扣 3% 費 + 轉移 bonus |
| CL-02 | 已被別人搶走（race condition）→ 400 |
| CL-03 | 搶自己的單 → 400 |
| CL-04 | 接手司機餘額不足 → 400 |

---

### 3.4 SSE 即時推播（Priority: P1）

#### GET /api/drivers/events

| ID | 場景 | 測試方式 |
|----|------|---------|
| SSE-01 | 正常連線 → 回傳 text/event-stream header | 檢查 headers |
| SSE-02 | 無 token → 401 | 無 Authorization |
| SSE-03 | 非司機角色 → 404 | mock role = DISPATCHER |
| SSE-04 | 首次連線廣播所有 PUBLISHED 訂單 | mock `prisma.order.findMany` |
| SSE-05 | 心跳（HEARTBEAT）每 3 秒一次 | mock interval check |
| SSE-06 | 新訂單發布 → 收到 NEW_ORDER 事件 | mock polling result |

**測試挑戰**：SSE 是長連線，無法用傳統 request/response 測試。
**策略**：
- 只測試 Header 和初始連線邏輯
- 針對 `broadcastSquadEvent` / `broadcastDispatcherEvent` 做單元測試
- E2E 用 Playwright 測試實際 SSE 行為

---

### 3.5 AI 訂單解析（Priority: P1）

#### lib/ai.ts 單元測試（rule-based 解析器）

| ID | 場景 | 測試資料 |
|----|------|---------|
| AI-01 | 接機行：時間+地點 → 正確解析 type/pickup/dropoff | `0800 接 台北市信義區 $1200` |
| AI-02 | 送機行：時間+地點 → 正確解析 type | `0830 送 桃園機場` |
| AI-03 | 基隆港接送船 → pickup_boat / dropoff_boat | `0915 基隆港→台北市` |
| AI-04 | 包車 → charter | `1400 包車 8小時` |
| AI-05 | 交通接駁 → transfer | `上-台北車站 下-高雄市` |
| AI-06 | 車型解析：休旅/suv | `休旅車 1500` |
| AI-07 | 車型解析：9人座/van9 | `9人座 $2000` |
| AI-08 | 車型解析：任意R牌 | `任意R牌 $1000` |
| AI-09 | 金額解析：$ 符號 | `0912 接 $1500` |
| AI-10 | 金額解析：行尾 3+ 位數 | `0912 接 台北1500` |
| AI-11 | 標題行（無時間、有車型）→ 繼承預設值 | `休旅 📌` 作為標題行 |
| AI-12 | 批次解析：多行文字 → 多個 ParsedOrder | 3行文字 |
| AI-13 | validateParsedOrder：必填欄位缺失 | 缺 time |
| AI-14 | validateParsedOrder：全部正確 → valid | 完整資料 |

**Mock 策略**：
- `parseBatchOrders` 是純函式，不需要 mock
- `parseBatchOrdersLLM` 需要 mock `fetch` 和 `ANTHROPIC_API_KEY`

#### API route: POST /api/orders/parse

| ID | 場景 |
|----|------|
| P-01 | 正常解析（rule-based）→ 回傳 parsed orders |
| P-02 | 派單方使用 AI 解析 → 呼叫 Haiku API |
| P-03 | 無效文字 → 回傳空陣列 |

---

### 3.6 PAYUNi 金流（Priority: P2）

#### lib/payuni.ts 單元測試

| ID | 場景 | Mock 方式 |
|----|------|---------|
| PY-01 | encryptPayuni + decryptPayuni 配對成功 | 不需要 mock |
| PY-02 | 不同環境 endpoint 不同 | mock PAYUNI_ENV |
| PY-03 | encryptPayuni 回傳 EncryptInfo + HashInfo | verify output shape |
| PY-04 | decryptPayuni 還原正確資料 | verify parsed fields |

#### POST /api/payuni/topup/notify

| ID | 場景 |
|----|------|
| PN-01 | 正確的 PAYUNi 通知 → 更新 topup status + 增加點數 |
| PN-02 | 無效的加密簽名 → 400 |
| PN-03 | 交易已完成（重複通知）→ idempotent 處理 |

---

## 4. 測試資料管理

### 4.1 Fixtures 檔案

```
tests/fixtures/
├── auth.ts         — driver/dispatcher/admin user mock objects
├── order.ts        — order states fixtures
├── driver.ts       — driver with various states
└── transfer.ts     — transfer request fixtures
```

### 4.2 Setup 檔案

```
tests/setup.ts              — 全域 env 設定、Vitest globals
tests/lib/
├── test-helpers.ts         — makeRequest(), mockUser() 等輔助函式
└── db-mock.ts             — Prisma mock 統一設定
```

### 4.3 Fixtures 設計原則

- 每個 fixture 為工廠函式（`createDriver({ balance: 1000 })`）
- 預設值來自 `prisma/seed.ts` 的相同邏輯
- 不需要真實 UUID，用 `test-${role}-${index}` 格式

---

## 5. Mock 策略

### 5.1 Prisma Mock（主要）

使用 `vi.mock('@/lib/prisma')` 在各測試檔案頂層設定。

```typescript
vi.mock('@/lib/prisma', () => {
  const mock = {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    driver: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    // ... 其他 models
  }
  return { prisma: mock, default: mock }
})
```

### 5.2 Auth Mock

```typescript
vi.mock('@/lib/auth', () => ({
  getUserFromToken: vi.fn(),
}))
```

### 5.3 第三方 API Mock

- **Anthropic API**: `global.fetch = vi.fn()` 回傳模擬 Haiku 回應
- **PAYUNi API**: 不需要 mock，測試 encrypt/decrypt 即可
- **Email**: `vi.mock('@/lib/email')`

### 5.4 SSE Emitter Mock

```typescript
vi.mock('@/lib/sse-emitter', () => ({
  broadcastSquadEvent: vi.fn(),
  broadcastDispatcherEvent: vi.fn(),
  globalEmitter: { emit: vi.fn() },
}))
```

---

## 6. CI/CD 整合

### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run coverage  # 生成 lcov
      - uses: codecov/codecov-action@v4  # 上傳 codecov
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

### 6.2 覆蓋率門檻

- 目標：80% 函式/分支覆蓋
- 設定 Vitest coverage threshold：
  ```typescript
  coverage: {
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    }
  }
  ```

### 6.3 Vitest 設定更新

- 從 `tests/**/*.test.ts` 改為更廣泛涵蓋：
  ```
  include: [
    'tests/**/*.test.ts',
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
  ]
  ```
- 排除：`node_modules/`、`prisma/`、`*.config.*`

---

## 7. 現有測試分析

### 已覆蓋（7 個測試檔）

| 檔案 | 測試數 | 覆蓋模組 |
|------|--------|---------|
| `tests/api.orders.test.ts` | 10 | POST /api/orders 建立訂單驗證 |
| `tests/api.drivers.topup.test.ts` | 9 | POST /api/drivers/topup/create |
| `tests/api.admin.topup.test.ts` | ? | admin topup |
| `tests/api.cron.document-expiry.test.ts` | ? | cron document expiry |
| `tests/api.drivers.profile.test.ts` | ? | driver profile |
| `tests/api.drivers.documents.upload.test.ts` | ? | document upload |

**缺口（完全無測試）**：
- 認證：JWT login/register/forgot-password/reset-password
- 接單：accept/cancel/status
- 轉單：transfer-request/approve/reject/withdraw/claim
- SSE：drivers/events、squads/events、dispatchers/events
- AI：parseBatchOrders rule-based
- PAYUNi：encrypt/decrypt

---

## 8. 實作優先順序

### Phase 1（第 1-2 天）：基礎覆蓋
1. JWT 單元測試（auth.test.ts）— 4 個測試
2. AI 訂單解析單元測試（ai.test.ts）— 14 個測試
3. PAYUNi 加密單元測試（payuni.test.ts）— 4 個測試

### Phase 2（第 3-5 天）：核心 API
4. POST /api/auth/login 整合測試 — 7 個測試
5. POST /api/orders/[id]/accept 整合測試 — 16 個測試
6. POST /api/orders/[id]/cancel 整合測試 — 5 個測試

### Phase 3（第 6-8 天）：轉單流程
7. 轉單 API 系列整合測試 — 15 個測試
8. 小隊 API 系列整合測試 — 10 個測試
9. SSE broadcast 單元測試 — 5 個測試

### Phase 4（第 9-10 天）：E2E + CI
10. Playwright E2E 測試（login/accept/transfer）— 6 個測試
11. GitHub Actions workflow 建立
12. Coverage 報告整合

---

## 9. 預期產出

| 產出物 | 位置 |
|--------|------|
| 測試策略文件 | `docs/test-strategy.md` |
| 示範測試 | `tests/lib/auth.test.ts` |
| 測試 helpers | `tests/lib/test-helpers.ts` |
| Auth fixtures | `tests/fixtures/auth.ts` |
| CI workflow | `.github/workflows/test.yml` |
| 更新 CURRENT_WORK.md | 測試進度摘要 |

---

## 10. 成功標準

- [ ] `npm run test` 全部通過（0 failing）
- [ ] 覆蓋率報告顯示 >= 80% line/statement/function
- [ ] 每個核心 API 模組至少有 5 個測試案例
- [ ] 認證、接單、轉單三大流程 100% 覆蓋
- [ ] GitHub Actions CI 在 PR 中自動執行
