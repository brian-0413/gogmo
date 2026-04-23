# gogmo 智慧解析 & 智慧排單功能 Spec

> **版本**：v1.0 MVP
> **日期**：2026-04-23
> **執行環境**：Claude Code CLI（`--dangerously-skip-permissions`）
> **技術棧**：Next.js 14 App Router、Prisma、PostgreSQL（Supabase）、Tailwind CSS

---

## 文件使用方式

這份文件分成 4 個階段，**請按順序執行**，每個階段完成後 git commit、停下來等使用者確認，再進下一階段。

每階段開頭都會說明：
- 目標
- 修改/新增的檔案
- 驗收條件

如果途中遇到資料結構衝突或不清楚的地方，**停下來問使用者**，不要自行假設。

---

# Part 1：功能總覽

## 1.1 智慧解析（派單方端）

派單方在後台貼上 LINE 群裡收到的派單訊息，AI 解析後跳出列表，派單方逐張確認/編輯，最後一次發布到接單大廳。

**核心流程**：
```
派單方輸入頁
  ↓ 選日期、選車型、貼訊息
AI 解析（最多 20 單）
  ↓ 生成列表（單號/車型/種類/起迄點/金額）
派單方點入單張編輯（補航班、聯絡人、電話、備註等）
  ↓ 按「確認」進入暫存
全部單都確認後，按「全部發布」
  ↓ 上接單大廳
```

## 1.2 智慧排單（司機端）

司機接了一張單後，在「我的行程」頁的卡片上有「智慧排單」按鈕，點下去後系統根據時間/區域規則，從接單大廳裡推薦適合的配套單（最多 15 張）。

**核心流程**：
```
司機接單 → 進入「我的行程」
  ↓
點該單卡片上的「智慧排單」按鈕
  ↓
系統依規則篩選 + 排序大廳的剩餘單
  ↓
顯示推薦清單（最多 15 張）
  ↓
司機點選 → 接單 → 進入「我的行程」（成為下次智慧排單的新錨點）
```

---

# Part 2：資料結構

## 2.1 訂單 schema 新增欄位

請先 view 現有的 `prisma/schema.prisma`，確認 `Order` model 的現狀。然後**追加**以下欄位（不要刪除既有欄位）：

```prisma
model Order {
  // ... 既有欄位 ...

  // 智慧解析新增欄位
  flightNumber       String?    // 航班號（例：CI-100、BR-225）
  contactName        String?    // 聯絡人
  contactPhone       String?    // 聯絡電話
  passengerCount     Int?       // 人數
  luggageCount       Int?       // 行李數
  specialRequests    String?    // 特殊需求（安全座椅、舉牌、行李上樓等）

  // 上下車點（支援多點）
  pickupAddresses    String[]   // 起點陣列（含加點）
  dropoffAddresses   String[]   // 終點陣列（含加點）

  // 行政區（用於智慧排單距離判斷）
  pickupZone         String?    // 起點所屬 23 區之一
  dropoffZone        String?    // 終點所屬 23 區之一

  // 原始派單訊息（備註區自動帶入）
  originalMessage    String?    @db.Text  // 派單方貼上的原始訊息
  dispatcherNote     String?    @db.Text  // 派單方額外給司機的備註

  // 解析來源
  parsedByAI         Boolean    @default(false)  // 是否由 AI 解析生成
  parseConfidence    Json?      // 各欄位解析信心（debug 用，可選）
}
```

**注意**：
- 既有的 `pickupAddress`、`dropoffAddress`（單一地址欄位）仍保留，作為「主要起迄點」顯示用。新陣列欄位是給「加點」場景用的。
- 如果現有 schema 已經有類似欄位（例如 `note` 已存在），請先回報，不要重複新增。

執行：
```bash
npx prisma migrate dev --name add_smart_parsing_fields
npx prisma generate
```

## 2.2 23 區距離矩陣引用

請使用 `docs/北北基桃次生活圈距離表_地理推估初版.md` 中定義的 23 區（如果檔案不存在，請先回報，由使用者提供）。

建立常數檔 `lib/zones/distance-matrix.ts`：

```typescript
// 23 區清單（從 docs 中取出）
export const ZONES = [
  'TPE-01', 'TPE-02', 'TPE-03', 'TPE-04', 'TPE-05',  // 台北 5 區
  'TPE-06', 'TPE-07', 'TPE-08', 'TPE-09', 'TPE-10',  // 新北一般
  'TPE-11', 'TPE-12', 'TPE-13',                       // 新北其他
  'TPE-14', 'TPE-15',                                 // 新北偏遠
  'KEE-01', 'KEE-02',                                 // 基隆
  'TAO-01', 'TAO-02', 'TAO-03', 'TAO-04', 'TAO-05', 'TAO-06',  // 桃園
] as const;

export type ZoneCode = typeof ZONES[number];

// 距離矩陣（從 docs 中取出，分鐘為單位）
export const ZONE_DISTANCE_MATRIX: Record<ZoneCode, Record<ZoneCode, number>> = {
  // ... 從 docs 填入 ...
};

// 取得兩區之間的時間（分鐘）
export function getZoneDistance(from: ZoneCode, to: ZoneCode): number {
  if (from === to) return 0;
  return ZONE_DISTANCE_MATRIX[from]?.[to] ?? 999;  // 999 表示未知/極遠
}
```

並提供地址 → 區的對應函式：

```typescript
// lib/zones/address-to-zone.ts
const ADDRESS_TO_ZONE_MAP: Record<string, ZoneCode> = {
  '中正區': 'TPE-01',
  '大同區': 'TPE-01',
  // ... 完整對應表，請從 docs 中取出 ...
};

export function addressToZone(address: string): ZoneCode | null {
  for (const [keyword, zone] of Object.entries(ADDRESS_TO_ZONE_MAP)) {
    if (address.includes(keyword)) return zone;
  }
  return null;
}
```

---

# Part 3：智慧解析功能 spec

## 3.1 派單方輸入頁

**路由**：`/dispatcher/parse`

**頁面結構**：

```
┌─────────────────────────────────────┐
│  智慧解析                            │
├─────────────────────────────────────┤
│                                     │
│  日期 [▼ 2026/04/23（今天）]        │
│       （下拉，從今天起 15 天）       │
│                                     │
│  車型 [▼ 5 人座]                    │
│       （5人座/5人休旅/7人座/        │
│        9人座/自訂）                  │
│  ※ 選自訂時跳出文字框輸入           │
│                                     │
│  訊息（最多 20 單）                  │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  （多行文字框，placeholder：   │  │
│  │  為使 AI 能正確解析，請依以下   │  │
│  │  建議格式張貼：                 │  │
│  │  時間（24小時制）/種類+起迄點  │  │
│  │  /金額                         │  │
│  │  範例：                         │  │
│  │  1600/桃機接板橋/1200元         │  │
│  │  1400/板橋送松機/1000元         │  │
│  │  其他行程詳細事項及備註，請於   │  │
│  │  AI 解析完成後於點選編輯。）     │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  [  AI 解析  ]                      │
└─────────────────────────────────────┘
```

**規則**：
- 日期下拉：今天起 15 天，格式 `2026/04/23（今天）`、`2026/04/24（明天）`、`2026/04/25（週六）`...
- 車型下拉：5 人座 / 5 人休旅 / 7 人座 / 9 人座 / 自訂（選自訂時 inline 顯示文字框）
- 訊息框：必填，前端先用換行數估算單數（每行為 1 單），超過 20 行時 disable 「AI 解析」按鈕並顯示「最多 20 單，請分批處理」

## 3.2 AI 解析邏輯

**呼叫**：使用 Anthropic API（建議 Haiku 模型，成本低且夠用）

**System Prompt**（請寫進 `lib/ai/parse-orders.ts`）：

```
你是 gogmo 派單平台的訊息解析助手。請從派單方貼上的訊息中，
解析出每一張單的以下欄位：

1. time（時間）：24 小時制 HH:mm 格式（例：14:00、08:30）
2. type（種類）：以下五種之一
   - airport_pickup（接機）
   - airport_dropoff（送機）
   - port_pickup（接船）
   - port_dropoff（送船）
   - charter（包機）
   - transfer（交通趟）
3. pickup（上車點）：地址或地名（例：板橋、桃機 T1、台北車站）
4. dropoff（下車點）：地址或地名
5. price（金額）：純數字（例：1200）

規則：
- 訊息中每一行為一張單
- 「桃機」「TPE」「桃園機場」「第一航廈」「T1」「T2」都歸為「桃園機場」
- 「松機」「松山」「TSA」歸為「松山機場」
- 「接」表示從機場接客人到地點（airport_pickup）
- 「送」表示從地點送客人到機場（airport_dropoff）
- 金額優先抓「XXX元」「$XXX」「NT$XXX」格式的數字
- 若某欄位無法解析，回傳 null（不要猜測）

請以 JSON 陣列格式回傳，每張單一個物件：
[
  {
    "time": "16:00",
    "type": "airport_pickup",
    "pickup": "桃園機場",
    "dropoff": "板橋",
    "price": 1200
  },
  ...
]

只回傳 JSON，不要任何其他文字。
```

**API 呼叫**：

```typescript
// lib/ai/parse-orders.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function parseOrdersFromMessage(message: string) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,  // 上面那段
    messages: [{ role: 'user', content: message }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error('AI 解析回傳格式錯誤');
  }
}
```

**API route**：`app/api/parse/route.ts`

```typescript
export async function POST(req: Request) {
  const { date, vehicleType, message } = await req.json();

  // 驗證
  if (!date || !vehicleType || !message) {
    return Response.json({ error: '缺少必要欄位' }, { status: 400 });
  }

  const lineCount = message.split('\n').filter((l: string) => l.trim()).length;
  if (lineCount > 20) {
    return Response.json({ error: '最多 20 單' }, { status: 400 });
  }

  try {
    const parsed = await parseOrdersFromMessage(message);
    return Response.json({ orders: parsed, date, vehicleType, originalMessage: message });
  } catch (err) {
    return Response.json({ error: 'AI 解析失敗，請檢查訊息格式' }, { status: 500 });
  }
}
```

## 3.3 解析列表確認頁

**路由**：`/dispatcher/parse/review`（透過 query string 或 sessionStorage 傳遞解析結果）

**頁面結構**：

```
┌──────────────────────────────────────────────────────┐
│  解析結果（共 5 單）                  [← 重新解析]    │
├──────────────────────────────────────────────────────┤
│ # │車型   │種類    │起迄點         │金額    │狀態   │
├──────────────────────────────────────────────────────┤
│ 1 │5人座 │送機    │板橋→桃機     │1200   │未確認 │
│ 2 │5人座 │接機    │桃機→大安     │1300   │✅確認 │
│ 3 │5人座 │送機    │新店→松機     │1100   │未確認 │
│ 4 │5人座 │接機    │桃機→❓       │1500   │⚠️ 需編輯│
│ 5 │5人座 │包機    │台北→台中     │5000   │未確認 │
└──────────────────────────────────────────────────────┘
                                                        
[ 取消 ]                          [ 全部發布（2/5）]   
                                  ※ 必須全部確認才能發布
```

**互動規則**：
- 點任一列 → 進入該單的編輯頁（3.4）
- 「狀態」欄：
  - `未確認`（灰色）：尚未進入編輯頁
  - `✅確認`（綠色）：已進入編輯頁並按「確認」
  - `⚠️ 需編輯`（黃色）：AI 解析有 null 欄位（必填項缺失，例：起點/終點/時間/金額/種類缺一）
- 「全部發布」按鈕：只有當**全部單**都是「✅確認」狀態時才 enable
- 按鈕文字顯示進度：`全部發布（2/5）` 表示 5 張中已確認 2 張
- 取消會跳 confirm dialog：「確定要捨棄所有解析結果？」

**暫存機制**：
- 使用 sessionStorage 暫存解析結果，重新整理頁面不會丟失
- 「全部發布」成功後清除 sessionStorage

## 3.4 行程編輯頁

**路由**：`/dispatcher/parse/review/[index]`（index 為列表中的第幾張）

**頁面結構**：

```
┌──────────────────────────────────────────────────────┐
│  編輯第 1 單                          [← 返回列表]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  日期 [2026/04/23 ▼]    時間 [16 ▼]:[00 ▼]          │
│  車型 [5人座 ▼]                                      │
│  種類 [送機 ▼]                                       │
│                                                      │
│  ── 上車地址 ─────────────────────────────────────  │
│  ① [板橋區文化路一段100號         ]  [×]            │
│  ② [新北市三重區重新路            ]  [×]            │
│  [+ 加點]                                            │
│                                                      │
│  ── 下車地址 ─────────────────────────────────────  │
│  ① [桃園機場 T1                   ]  [×]            │
│  [+ 加點]                                            │
│                                                      │
│  航班 [CI-100      ]（選填）                         │
│  金額 [1200        ]                                 │
│                                                      │
│  ── 客戶資訊 ─────────────────────────────────────  │
│  聯絡人 [王先生           ]                          │
│  電話   [0912345678       ]                          │
│  人數   [2 ▼]    行李 [3 ▼]                          │
│                                                      │
│  特殊需求 [□ 安全座椅  □ 舉牌  □ 行李上樓 □ 其他]    │
│  其他需求備註 [                              ]      │
│                                                      │
│  ── 備註 ─────────────────────────────────────────  │
│  原始派單訊息（自動帶入，不可編輯）                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1600 板橋送桃機 1200                          │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  派單方備註（給司機看）                              │
│  ┌──────────────────────────────────────────────┐  │
│  │ 客人有大件樂器，請帶大車                       │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [ 取消 ]                            [ 確認此單 ]   │
└──────────────────────────────────────────────────────┘
```

**規則**：
- 「上車地址」「下車地址」可加點（無上限），每點都有刪除按鈕
- 至少要有 1 個上車地址、1 個下車地址
- 必填欄位：日期、時間、車型、種類、上車地址 ①、下車地址 ①、金額
- 選填欄位：航班、聯絡人、電話、人數、行李、特殊需求、派單方備註
- 「確認此單」會：
  - 驗證必填欄位
  - 計算 `pickupZone`、`dropoffZone`（用 addressToZone 函式）
  - 將該單狀態標記為「✅確認」
  - 返回列表頁

## 3.5 全部發布

**API route**：`app/api/orders/publish-batch/route.ts`

```typescript
export async function POST(req: Request) {
  const { orders } = await req.json();  // 已確認的單陣列

  // 寫入資料庫
  const created = await prisma.$transaction(
    orders.map((order: any) =>
      prisma.order.create({
        data: {
          ...order,
          status: 'available',  // 直接上大廳
          parsedByAI: true,
          createdAt: new Date(),
        },
      })
    )
  );

  return Response.json({ count: created.length, ids: created.map(o => o.id) });
}
```

成功後跳轉到 `/dispatcher/orders` 並顯示 toast：「已發布 5 張單到接單大廳」。

---

# Part 4：智慧排單功能 spec

## 4.1 觸發點

智慧排單按鈕**只出現在司機已接的訂單卡片上**，位置在「我的行程」頁（`/driver/schedule`）的每張卡片右下角。

```
┌────────────────────────────────────┐
│ 4/23 16:00  桃機 → 板橋   1200     │
│ 接機  CI-100                       │
│ 王先生 / 0912345678  2大1小 3行李  │
│                                    │
│              [ 🎯 智慧排單 ] [詳情] │
└────────────────────────────────────┘
```

**接單大廳（`/driver/orders`）的卡片不放此按鈕**，只放「接單」按鈕。

## 4.2 配對演算法

**輸入**：錨點訂單（anchor，司機已接的某張單）

**輸出**：從接單大廳（`status = 'available'`）中篩選出最多 15 張推薦單

### Step 1：時間規則（種類 → 時間間隔）

| 錨點種類 | 推薦種類 | 最小間隔 |
|---------|---------|---------|
| airport_dropoff（送機）| airport_pickup（接機）| 1.5 小時 |
| airport_pickup（接機）| airport_dropoff（送機）| 2.5 小時 |
| 其他種類 | 不推薦（MVP 階段不處理） | - |

**計算公式**：
```typescript
// 錨點為送機
recommendStartTime = anchor.time + 1.5 hours
filtered = orders.filter(o =>
  o.type === 'airport_pickup' &&
  o.time >= recommendStartTime
);

// 錨點為接機
recommendStartTime = anchor.time + 2.5 hours
filtered = orders.filter(o =>
  o.type === 'airport_dropoff' &&
  o.time >= recommendStartTime
);
```

### Step 2：機場規則（MVP 只處理桃機）

只推薦**桃園機場**的單。松山機場單量小，MVP 階段忽略。

```typescript
// 錨點為送機（去機場）
filtered = filtered.filter(o => o.pickup.includes('桃'));  // 接機從桃機出發

// 錨點為接機（從機場）
filtered = filtered.filter(o => o.dropoff.includes('桃'));  // 送機去桃機
```

### Step 3：排序

**錨點為送機**：
- 排序鍵：時間由近而遠（時間越接近 `recommendStartTime` 越優先）

```typescript
filtered.sort((a, b) => a.time - b.time);
```

**錨點為接機**：
- 主排序鍵：上車點與錨點下車點的距離（由近而遠，用 `getZoneDistance`）
- 次排序鍵：時間由近而遠

```typescript
const anchorDropoffZone = anchor.dropoffZone;
filtered.sort((a, b) => {
  const distA = getZoneDistance(anchorDropoffZone, a.pickupZone);
  const distB = getZoneDistance(anchorDropoffZone, b.pickupZone);
  if (distA !== distB) return distA - distB;
  return a.time - b.time;
});
```

### Step 4：截斷上限 15 張

```typescript
const recommendations = filtered.slice(0, 15);
```

### Step 5：時間衝突檢查（過濾掉與司機其他已接單衝突的）

```typescript
const driverOrders = await prisma.order.findMany({
  where: { driverId: currentDriverId, status: { in: ['accepted', 'in_progress'] } }
});

recommendations = recommendations.filter(o => {
  return !driverOrders.some(existing => {
    // 簡化判斷：時間差 < 1.5 小時即視為衝突
    return Math.abs(existing.time - o.time) < 1.5 * 60;  // 分鐘
  });
});
```

## 4.3 API route

**路由**：`app/api/driver/smart-match/route.ts`

```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anchorId = searchParams.get('anchorId');

  if (!anchorId) return Response.json({ error: '缺少 anchorId' }, { status: 400 });

  const anchor = await prisma.order.findUnique({ where: { id: anchorId } });
  if (!anchor) return Response.json({ error: '錨點訂單不存在' }, { status: 404 });

  // 從 session/auth 取得 driverId
  const driverId = await getCurrentDriverId(req);

  const recommendations = await calculateSmartMatch(anchor, driverId);
  return Response.json({ recommendations });
}
```

`calculateSmartMatch` 實作於 `lib/dispatch/smart-match.ts`，邏輯依 4.2 完整實作。

## 4.4 推薦清單頁

**路由**：`/driver/smart-match?anchorId={orderId}`

**頁面結構**：

```
┌──────────────────────────────────────────────────────┐
│  ← 返回我的行程                                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  錨點：4/23 16:00 桃機 → 板橋 送機 1200              │
│                                                      │
│  推薦配套單（共 8 張）                                │
│  根據時間間隔 1.5 小時與機場匹配規則                  │
│                                                      │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐ │
│  │ 4/23 17:30  桃機 → 中山  1300                  │ │
│  │ 接機  間隔 1.5 小時                            │ │
│  │                                  [ 接單 ]      │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ 4/23 18:00  桃機 → 信義  1400                  │ │
│  │ 接機  間隔 2.0 小時                            │ │
│  │                                  [ 接單 ]      │ │
│  └────────────────────────────────────────────────┘ │
│  ...                                                │
└──────────────────────────────────────────────────────┘
```

**規則**：
- 每張卡片顯示：時間、起迄點、金額、種類、間隔時間
- 點「接單」按鈕：
  - 呼叫 POST `/api/orders/{id}/accept`
  - 成功 → toast「已接單」+ 自動 refresh 推薦清單
  - 失敗（被別人接走）→ toast「此單已被接走，重新整理推薦」+ 自動 refresh
- 如果推薦清單為空，顯示：
  ```
  ┌────────────────────────────────────────────────┐
  │                                                │
  │           目前無適合配套單                      │
  │                                                │
  │     可以到接單大廳手動瀏覽其他訂單              │
  │                                                │
  │           [ 前往接單大廳 ]                     │
  │                                                │
  └────────────────────────────────────────────────┘
  ```

## 4.5 接單大廳的排序與篩選

**路由**：`/driver/orders`

在頁面上方加入排序與篩選控制：

```
┌──────────────────────────────────────────────────────┐
│  接單大廳                                            │
├──────────────────────────────────────────────────────┤
│  排序 [時間 ▼]  種類 [全部 ▼]  區域 [全部 ▼]        │
│                                                      │
│  排序選項：時間 / 價格高到低 / 價格低到高             │
│  種類篩選：全部 / 接機 / 送機 / 包機 / 交通趟        │
│  區域篩選：全部 / 台北 / 新北 / 基隆 / 桃園          │
│            （依起點區域分類）                         │
└──────────────────────────────────────────────────────┘
```

實作方式：
- 排序與篩選都在前端做（不發新 request），先一次性取得大廳所有單
- URL query string 持久化（例：`/driver/orders?sort=price_desc&type=airport_pickup&zone=TPE`）

---

# Part 5：分階段執行計畫

## ⚠️ 通用規則

- 每階段開頭：**先 view 既有檔案** 確認現狀，再開始改
- 每階段完成後：
  1. `npm run build` 必須通過
  2. git add → git commit（commit message 用指定格式）
  3. **停下來等使用者確認**，不要連跑下一階段
- 使用 Traditional Chinese 撰寫所有 UI 文字、註解、commit message

---

## 階段 1：智慧解析後端 + 資料結構（預估 2-3 天）

**目標**：完成 schema 變更、AI 解析 API、發布 batch API

**檔案清單**：
- `prisma/schema.prisma`（修改）
- `lib/zones/distance-matrix.ts`（新增）
- `lib/zones/address-to-zone.ts`（新增）
- `lib/ai/parse-orders.ts`（新增）
- `app/api/parse/route.ts`（新增）
- `app/api/orders/publish-batch/route.ts`（新增）

**步驟**：
1. 先 view 現有的 `prisma/schema.prisma`，確認 `Order` model 現狀
2. 追加 2.1 列出的欄位，跑 migration
3. 新增 `lib/zones/` 兩個檔案（如果 docs 距離表不存在，停下來請使用者提供）
4. 新增 `lib/ai/parse-orders.ts`，安裝 `@anthropic-ai/sdk`（如果尚未安裝）
5. 新增兩個 API route，用 curl 或 Postman 簡單測試
6. `npm run build` 通過後，commit：`feat(parse): 新增智慧解析 API 與資料結構`

**驗收**：
- 能用 curl 呼叫 `/api/parse` 並收到 JSON 結果
- 能用 curl 呼叫 `/api/orders/publish-batch` 寫入訂單

**完成回報格式**：
```
✅ 階段 1 完成
- commit: [hash]
- 新增欄位：[欄位列表]
- 23 區常數：已建立 / 待補（請使用者提供 docs）
- API 測試：parse API ✅ / publish-batch API ✅
```

---

## 階段 2：智慧解析前端 UI（預估 3-4 天）

**目標**：完成派單方輸入頁、解析列表頁、行程編輯頁

**檔案清單**：
- `app/dispatcher/parse/page.tsx`（新增，輸入頁）
- `app/dispatcher/parse/review/page.tsx`（新增，列表頁）
- `app/dispatcher/parse/review/[index]/page.tsx`（新增，編輯頁）
- `components/dispatcher/ParseForm.tsx`（新增）
- `components/dispatcher/ParseReviewList.tsx`（新增）
- `components/dispatcher/OrderEditForm.tsx`（新增）

**步驟**：
1. 先 view 現有的派單方頁面結構（`app/dispatcher/`），確認 navbar / layout
2. 建立輸入頁（3.1 規格）
3. 建立列表頁（3.3 規格），用 sessionStorage 暫存
4. 建立編輯頁（3.4 規格）
5. 測試完整流程：貼訊息 → 解析 → 列表 → 編輯 → 確認 → 發布
6. commit：`feat(parse): 智慧解析前端三步驟頁面`

**驗收**：
- 派單方能完成從貼訊息到發布的完整流程
- 編輯頁的「上車/下車地址加點」功能正常
- 「全部發布」按鈕的 enable/disable 邏輯正確

**完成回報格式**：
```
✅ 階段 2 完成
- commit: [hash]
- 三個頁面建置完成
- 完整流程測試通過：✅
- 截圖：[請貼三個頁面的截圖]
```

---

## 階段 3：智慧排單後端 + 資料邏輯（預估 2-3 天）

**目標**：完成智慧排單演算法與 API

**檔案清單**：
- `lib/dispatch/smart-match.ts`（新增）
- `app/api/driver/smart-match/route.ts`（新增）

**步驟**：
1. 實作 `calculateSmartMatch` 函式（4.2 規格）
2. 寫單元測試 `__tests__/smart-match.test.ts`，至少包含：
   - 送機錨點 → 推薦接機（時間間隔正確）
   - 接機錨點 → 推薦送機（按距離排序）
   - 推薦數量上限 15 張
   - 時間衝突過濾
   - 無符合單時回傳空陣列
3. 建立 API route
4. 用 curl 測試：建立 10+ 張測試單，跑 `/api/driver/smart-match?anchorId=xxx`
5. commit：`feat(dispatch): 智慧排單演算法與 API`

**驗收**：
- 單元測試全綠
- API 能正確回傳推薦清單
- 排序邏輯符合 4.2 規格

**完成回報格式**：
```
✅ 階段 3 完成
- commit: [hash]
- 單元測試：[X/X] 通過
- API 測試案例：
  - 送機錨點：✅ 回傳 X 張
  - 接機錨點：✅ 回傳 X 張（已驗證距離排序）
  - 無符合：✅ 回傳空陣列
```

---

## 階段 4：智慧排單前端 + 大廳排序篩選（預估 2-3 天）

**目標**：完成智慧排單按鈕、推薦清單頁、大廳排序篩選

**檔案清單**：
- `app/driver/schedule/page.tsx`（修改，加按鈕）
- `app/driver/smart-match/page.tsx`（新增，推薦清單頁）
- `app/driver/orders/page.tsx`（修改，加排序篩選）
- `components/driver/SmartMatchButton.tsx`（新增）
- `components/driver/RecommendationList.tsx`（新增）
- `components/driver/OrderListFilters.tsx`（新增）

**步驟**：
1. 先 view `/driver/schedule` 與 `/driver/orders` 現狀
2. 在 schedule 頁的卡片加上「智慧排單」按鈕
3. 建立 smart-match 頁（4.4 規格）
4. 在 orders 頁加上排序篩選（4.5 規格）
5. 完整測試流程：
   - 司機接單 → 進入「我的行程」
   - 點「智慧排單」→ 看到推薦清單
   - 點「接單」→ 成功/失敗 toast 都測試
   - 大廳排序篩選功能驗證
6. commit：`feat(dispatch): 智慧排單前端與大廳排序篩選`

**驗收**：
- 整個智慧排單流程順暢
- 推薦清單空時顯示正確的引導畫面
- 大廳排序篩選的 URL 持久化正確

**完成回報格式**：
```
✅ 階段 4 完成 🎉
- commit: [hash]
- 智慧排單完整流程測試通過
- 大廳排序篩選測試通過
- 截圖：[請貼推薦清單頁、大廳篩選後的截圖]

下一步建議：
- 上線前在 staging 環境跑一週，蒐集真實使用回饋
- 觀察智慧解析的失敗案例，未來補強 prompt
- 觀察智慧排單的接受率，未來校正時間間隔參數
```

---

# Part 6：未來優化（不在 MVP 範圍）

以下功能**先不做**，等真實使用資料累積後再決定：

1. **解析信心分數**：等真實上線一個月後，根據派單方修正紀錄判斷是否需要
2. **松山機場智慧排單**：等松山單量增加後再加入
3. **時間間隔參數化**：1.5/2.5 小時改為平台/派單方可調
4. **司機行為學習**：累積接受/拒絕推薦的資料後，個人化推薦
5. **跨機場接駁推薦**（桃機 T1 ↔ T2）
6. **包機/交通趟的智慧排單**
7. **Google Maps Distance Matrix API 動態距離**：等 23 區層級不夠用時再升級

---

# 附錄 A：常見問題

**Q：Prisma schema 改動會影響現有資料嗎？**
A：新增欄位都是 nullable（沒有 `@default`），既有資料不會受影響。

**Q：AI 解析失敗會怎樣？**
A：API 回 500 + 錯誤訊息，前端顯示 toast「AI 解析失敗，請檢查訊息格式或重試」。派單方可以調整訊息後再試。

**Q：派單方如果在編輯頁按上一頁離開會怎樣？**
A：列表頁的暫存（sessionStorage）會保留，但該單狀態維持「未確認」。

**Q：智慧排單推薦的單，司機點接單但 API 回 409（衝突）怎麼辦？**
A：這代表單在司機看到清單到點接單之間被別人接走了。前端顯示 toast「此單已被接走」，並自動 refresh 推薦清單。

**Q：大廳的單會自動更新嗎？**
A：MVP 階段不做即時更新（避免複雜化），司機需要手動下拉刷新或重新進入頁面。

---

# 附錄 B：Commit Message 格式

請依照 conventional commits 格式：

```
feat(parse): 新增智慧解析 API 與資料結構
feat(parse): 智慧解析前端三步驟頁面
feat(dispatch): 智慧排單演算法與 API
feat(dispatch): 智慧排單前端與大廳排序篩選
fix(parse): 修正 [具體問題]
refactor(dispatch): 抽取 [元件/函式]
test(dispatch): 新增智慧排單單元測試
docs: 更新 [文件]
```

---

# 開始執行

請從 **階段 1** 開始。先 view 既有的 `prisma/schema.prisma` 與 `app/dispatcher/` 目錄，理解現狀後再開始實作。

每個階段完成後務必 commit + 停下來等確認。

祝實作順利！🚀
