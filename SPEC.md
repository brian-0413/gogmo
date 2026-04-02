# 機場接送派單媒合平台 - 規格書

## 1. 願景與定位

### 1.1 產品願景
成為台灣機場接送產業的智慧派單中樞，從「人工作業+電話派單」升級到「AI 驅動的全流程自動化」。

### 1.2 長期路線圖
| 階段 | 時間 | 目標 |
|------|------|------|
| MVP | 0-3個月 | 機場接送核心派單流程 |
| Phase 2 | 3-6個月 | 擴展至高鐵、火車站、港口 |
| Phase 3 | 6-12個月 | 成為亞洲接送作業系統 |

---

## 2. 商業模式

### 2.1 三層用戶結構

| 用戶類型 | 說明 | 收費模式 |
|----------|------|----------|
| **司機端** | 提供接送服務的司機 | 預充值系統，每單扣5%（新用戶贈500-1000點免費試用） |
| **派單方端** | 車隊管理者/派遣員 | 初期免費，後期收2-3% |
| **銀行端** | 最終目標 - 銀行/大型車隊 | 未來直接派單，收5%媒合費 |

### 2.2 收費結構（MVP階段）
- 司機：每單成交後收取5%平台費
- 派單方：免費使用（吸納訂單量）
- 新用戶：贈送500-1000點免費試用

---

## 3. 功能架構

### 3.1 MVP 核心功能（Phase 1 - 0~3個月）

#### A. 司機端功能
| 功能 | 優先級 | 說明 |
|------|--------|------|
| 訂單卡片牆 | P0 | 視覺化展示所有可用訂單，卡片式設計 |
| 一鍵接單 | P0 | 司機快速搶單 |
| 訂單詳情 | P0 | 查看乘客資訊、航班、上下車地點 |
| 我的行程 | P0 | 當日/歷史行程列表 |
| 帳務中心 | P0 | 待收款項、已結算款項 |
| 智能推薦 | P1 | 推薦最佳下一單（基於位置、順路度） |

#### B. 派單方端功能
| 功能 | 優先級 | 說明 |
|------|--------|------|
| 訂單發布 | P0 | 手動建立或 AI 解析訂單 |
| 智能訂單解析 | P0 | AI 理解任何格式的訂單文本 |
| 行控中心 | P0 | 即時查看所有車輛位置與狀態 |
| 派單管理 | P0 | 將訂單指派給司機 |
| 司機管理 | P1 | 新增、編輯司機資料 |
| 自動對帳表 | P1 | 生成轉帳清單 |

#### C. 乘客端功能（MVP 簡化版）
| 功能 | 優先級 | 說明 |
|------|--------|------|
| LINE 預約 | P0 | 透過 LINE 機器人預約（最符合台灣用戶習慣） |
| 即時通知 | P0 | 司機接單、抵達、出發推播 |
| 行程追蹤 | P0 | 查看司機即時位置 |

### 3.2 Phase 2 擴展功能
- 多據點支援：高鐵站、火車站、港口
- 司機端 App（原生）
- 乘客端 App
- 優惠券系統
- 司機評價系統

### 3.3 Phase 3 進階功能
- AI 智能排程優化
- 大數據分析儀表板
- API 對接銀行/旅行社系統
- 多語言支援

---

## 4. 用戶流程

### 4.1 司機接單流程
```
1. 司機登入系統
2. 查看訂單卡片牆（依距離/時間排序）
3. 選擇有興趣的訂單，查看詳情
4.點擊「接單」按鈕
5. 系統確認接單成功
6. 查看乘客聯繫方式與航班資訊
7. 抵達機場後，點擊「已抵達」
8. 完成接送後，點擊「已完成」
9. 款項進入帳務中心（待結算）
```

### 4.2 派單方派單流程
```
1. 派單方登入系統
2. 建立新訂單（手動輸入 或 AI 解析文字）
3. AI 自動解析：乘客名、手機、航班、上下車地點、人數、行李數
4. 訂單進入「待派單」狀態
5. 派單方手動指派司機 或 系統自動推薦司機
6. 司機收到通知，確認接單
7. 行控中心即時追蹤行程狀態
```

---

## 5. 技術架構

### 5.1 技術棧

| 層面 | 技術選擇 | 理由 |
|------|----------|------|
| **前端框架** | Next.js 14 (App Router) | 全端一本，同時處理 UI 與 API |
| **UI 函式庫** | Tailwind CSS + Radix UI | 快速開發，元件豐富 |
| **資料庫** | PostgreSQL + Prisma ORM | 關聯式資料，強一致性 |
| **認證** | NextAuth.js | 支援多種登入方式 |
| **地圖** | Leaflet + OpenStreetMap | 免費、無需 API Key |
| **即時通訊** | Server-Sent Events (SSE) | 比 WebSocket 更簡單，適合單向推送 |
| **部署** | Vercel | Next.js 原生支援 |

### 5.2 系統架構圖

```
┌─────────────────────────────────────────────────────────┐
│                      客戶端                               │
├──────────────┬──────────────┬──────────────┬─────────────┤
│  司機端 Web   │   派單方端 Web  │   乘客 LINE  │   管理後台   │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Next.js API   │
                    │   (API Routes)  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
   ┌────────────┐    ┌────────────┐    ┌────────────┐
   │ PostgreSQL │    │   Redis    │    │    AI      │
   │  (Prisma)  │    │  (快取/Queue)│    │  (訂單解析) │
   └────────────┘    └────────────┘    └────────────┘
```

### 5.3 目錄結構

```
airport-dispatch-platform/
├── prisma/
│   └── schema.prisma          # 資料庫 Schema
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # 認證相關頁面
│   │   ├── (dashboard)/      # 儀表板（司機/派單方）
│   │   ├── (public)/         # 公開頁面
│   │   └── api/              # API 路由
│   ├── components/           # React 元件
│   │   ├── ui/              # 基礎 UI 元件
│   │   ├── driver/          # 司機端元件
│   │   ├── dispatcher/      # 派單方端元件
│   │   └── map/             # 地圖相關元件
│   ├── lib/                  # 工具函式
│   │   ├── prisma.ts        # Prisma client
│   │   ├── auth.ts          # NextAuth 設定
│   │   └── ai.ts            # AI 訂單解析
│   └── types/                # TypeScript 類型
├── public/                   # 靜態資源
└── SPEC.md                   # 本規格文件
```

---

## 6. 資料庫設計

### 6.1 實體關係圖

```
User (多用戶)
  ├── Driver (司機) 1:1
  ├── Dispatcher (派單方) 1:1
  └── Admin (管理員) 1:1

Driver 1──M Order (訂單)
Dispatcher 1──M Order

Order M──M Passenger (乘客)
Order 1──M Transaction (交易)
```

### 6.2 主要資料表

#### users
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| email | String | 登入信箱 |
| password | String | 密碼（雜湊） |
| name | String | 姓名 |
| phone | String | 手機 |
| role | Enum | DRIVER / DISPATCHER / ADMIN |
| createdAt | DateTime | 建立時間 |

#### drivers
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| userId | UUID | 關聯 user |
| licensePlate | String | 車牌 |
| carType | String | 車型 |
| carColor | String | 車色 |
| balance | Int | 點數餘額（整數，1點=1元） |
| status | Enum | ONLINE / OFFLINE / BUSY |
| currentLat | Float | 目前緯度 |
| currentLng | Float | 目前經度 |

#### dispatchers
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| userId | UUID | 關聯 user |
| companyName | String | 公司/車隊名稱 |
| commissionRate | Float | 抽成比例（預設0） |

#### orders
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| dispatcherId | UUID | 發單派單方 |
| driverId | UUID? | 接單司機（null=待接單） |
| status | Enum | PENDING / ASSIGNED / ACCEPTED / ARRIVED / IN_PROGRESS / COMPLETED / CANCELLED |
| passengerName | String | 乘客姓名 |
| passengerPhone | String | 乘客電話 |
| flightNumber | String | 航班號 |
| pickupLocation | String | 上車地點 |
| pickupAddress | String | 上車地址 |
| pickupLat | Float | 上車緯度 |
| pickupLng | Float | 上車經度 |
| dropoffLocation | String | 下車地點 |
| dropoffAddress | String | 下車地址 |
| dropoffLat | Float | 下車緯度 |
| dropoffLng | Float | 下車經度 |
| passengerCount | Int | 人數 |
| luggageCount | Int | 行李數 |
| scheduledTime | DateTime | 預定時間 |
| price | Int | 價格（整數）|
| note | String? | 備註 |
| rawText | String? | AI解析前的原始文字 |
| createdAt | DateTime | 建立時間 |

#### transactions
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| orderId | UUID | 關聯訂單 |
| driverId | UUID | 關聯司機 |
| amount | Int | 金額（正=收入，負=支出）|
| type | Enum | RIDE_FARE / PLATFORM_FEE / RECHARGE / WITHDRAW |
| status | Enum | PENDING / SETTLED |
| createdAt | DateTime | 建立時間 |

---

## 7. API 設計

### 7.1 認證 API
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/auth/register | 註冊 |
| POST | /api/auth/login | 登入 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 取得當前用戶 |

### 7.2 司機 API
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/drivers/me | 取得司機資料 |
| PATCH | /api/drivers/me | 更新司機資料 |
| PATCH | /api/drivers/location | 更新位置 |
| GET | /api/orders/available | 取得可接訂單 |
| POST | /api/orders/:id/accept | 接單 |
| POST | /api/orders/:id/status | 更新訂單狀態 |
| GET | /api/drivers/orders | 取得司機的訂單 |
| GET | /api/drivers/balance | 取得帳務資料 |

### 7.3 派單方 API
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/dispatchers/me | 取得派單方資料 |
| POST | /api/orders | 建立訂單 |
| POST | /api/orders/parse | AI 解析訂單文字 |
| GET | /api/orders | 取得所有訂單 |
| PATCH | /api/orders/:id | 更新訂單 |
| DELETE | /api/orders/:id | 刪除訂單 |
| POST | /api/orders/:id/assign | 指派司機 |
| GET | /api/dispatchers/drivers | 取得旗下司機 |
| GET | /api/dispatchers/settlement | 取得對帳表 |

### 7.4 即時更新（SSE）
| 路徑 | 說明 |
|------|------|
| /api/events/driver | 司機端事件流（新訂單、派單通知）|
| /api/events/dispatcher | 派單方端事件流（司機位置、訂單狀態）|

---

## 8. 3個月開發計畫

### Phase 1：基礎建設（第1-2週）
| 任務 | 交付物 |
|------|--------|
| 專案環境搭建 | Next.js + Prisma + PostgreSQL |
| 資料庫 Schema | 所有資料表建立完成 |
| 認證系統 | 登入/註冊/登出 |
| 基礎 UI 元件 | Button, Input, Card, Modal |

### Phase 2：司機端 MVP（第3-4週）
| 任務 | 交付物 |
|------|--------|
| 登入後儀表板 | 司機專屬頁面 |
| 訂單卡片牆 | 視覺化訂單列表 |
| 接單功能 | 一鍵搶單 |
| 行程詳情 | 查看乘客、航班資訊 |
| 司機位置更新 | GPS 追蹤 |

### Phase 3：派單方端 MVP（第5-6週）
| 任務 | 交付物 |
|------|--------|
| 派單方儀表板 | 車隊概覽 |
| 建立訂單 | 手動輸入 |
| AI 訂單解析 | 文字 → 結構化訂單 |
| 派單功能 | 指派司機 |
| 行控中心 | 即時地圖 + 車輛位置 |

### Phase 4：帳務系統（第7-8週）
| 任務 | 交付物 |
|------|--------|
| 司機帳務中心 | 收支明細 |
| 點數系統 | 預充值、扣款 |
| 自動對帳表 | 轉帳清單產生 |
| 交易記錄 | 完整收支歷史 |

### Phase 5：智能推薦（第9-10週）
| 任務 | 交付物 |
|------|--------|
| 智能行程推薦 | 推薦最佳下一單 |
| 路線優化 | 順路推薦 |
| 即時推播 | LINE/Email 通知 |

### Phase 6：測試與部署（第11-12週）
| 任務 | 交付物 |
|------|--------|
| 系統測試 | 全流程測試 |
| 效能優化 | 載入速度、資料庫查詢 |
| 部署上線 | Vercel 生產環境 |
| 使用者文件 | 操作手冊 |

---

## 9. 風險評估與對策

| 風險 | 可能性 | 影響 | 對策 |
|------|--------|------|------|
| AI 解析準確度不足 | 中 | 高 | 初期保留人工覆核機制 |
| 即時位置更新延遲 | 中 | 中 | 使用 Redis 快取，配合輪詢 |
| 訂單量成長導致效能問題 | 低 | 中 | 先做資料庫索引優化 |
| 第三方 API 失敗（LINE） | 低 | 高 | 保留 Email/簡訊備援 |

---

## 10. 成功指標（KPI）

### MVP 階段
| 指標 | 目標值 |
|------|--------|
| 註冊司機數 | 50人 |
| 週活躍司機 | 20人 |
| 訂單完成數（首月） | 200單 |
| 訂單成功率 | >85% |
| 系統正常運行時間 | >99% |
| 頁面載入時間（P95） | <2秒 |

---

*最後更新：2026-03-25*
*版本：v1.0*
