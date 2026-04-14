# 機場接送派單平台 - 技術架構報告

## 系統架構總覽

本平台採用現代化技術棧：**Next.js 14 App Router + TypeScript** + **Prisma 7 + PostgreSQL (Supabase)** + 自定義 JWT 認證。部署於 Zeabur，目前運行單一 Serverless 實例。

---

## 優點

### 1. 清晰的資料模型設計
- `User/Driver/Dispatcher` 三層關聯架構明確分離商業角色
- `Order` 模型包含完整接送資訊（航班、地點、時間、價格、車型）
- `Squad` 系統支援司機組隊與訂單轉移功能
- Enums 定義完整（OrderStatus、DriverStatus、TransferStatus）
- 適當的資料庫索引設計

### 2. 安全的認證機制
- 自定義 JWT + bcrypt (cost=12) 密碼雜湊
- 支援多因素登入（Email/車牌）
- Rate limiting 已實作（auth: 100/15min, orders: 60/min）
- 欄位長度驗證常數（MAX_FIELD_LENGTHS）防止資料庫溢位

### 3. 統一的 API 回應格式
```typescript
{ success: boolean, data?: any, error?: string }
```
所有 60+ API endpoints 一致使用此格式，便於前端處理。

### 4. 即時通知架構
- SSE `/api/drivers/events` 實現 3 秒 polling 推送新訂單
- `sse-emitter.ts` EventEmitter 支援小隊/派單方事件廣播

---

## 風險

### 1. 記憶體狀態無持久化（高風險）
- Rate limiter 使用 `Map<string, RateLimitEntry>()`（rate-limit.ts）
- SSE driverLastCheckMap 使用 `new Map<string, Date>()`（events/route.ts）
- Serverless 環境或水平擴展時，狀態會丟失且無法跨實例共享

### 2. 認證邏輯重複
- 每個 API 都重寫 token 解析與角色檢查
- 沒有集中式 middleware
- 易產生不一致的授權檢查

### 3. 缺少交易（Transaction）支援
- `transfer-approve` 等複寫操作無原子性保證
- 若中途失敗，可能導致狀態不一致

### 4. 環境變數管理
- `.env.example` 缺少 PAYUNi 相關設定（topup 功能需要）
- JWT_SECRET 無輪換機制

---

## 建議改進（前 3 項）

### 1. 遷移至 Redis 持久化狀態
更換所有 in-memory store：
- rate-limit.ts 改用 Redis（推薦 Upstash）
- events/route.ts 改用 Redis Pub/Sub 或專業 SSE 服務（如 Ably、Pusher）

### 2. 建立集中式 Auth Middleware
提取重複邏輯至 `/src/middleware/auth.ts`，統一拦截所有 `/api/*` 路由的授權檢查。

### 3. 引入 Prisma Transaction 包裝複寫操作
確保 `transfer-approve`、`transfer-request` 等操作具有原子性。

---

## 擴展性評估

| 指標 | 目前能力 | 瓶頸 |
|-----|---------|------|
| 同時在線司機 | ~50-100（單一 SSE 實例） | EventEmitter記憶體 |
| 訂單處理 | ~500/小時 | 記憶體 rate limiter |
| 派單方 | ~20-30 | 無明顯限制 |

若要支援 500+ 並發，需：Redis 替換記憶體 store + SSE 改用專屬服務。

---

## 結論

本平台架構對 MVP 階段是合理的，核心商業邏輯（訂單匹配、小隊協作、結算）已完整實現。主要技術債在於**狀態持久化**和**middleware 抽象化**。建議優先處理 Redis 遷移，這將同時改善 rate limiting 和 SSE 的穩定性。