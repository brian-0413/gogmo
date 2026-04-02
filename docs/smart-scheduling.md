# 智慧排班系統規格

## 功能概述

司機按下「智慧排班」按鈕後，系統根據司機現有的已接訂單，從接單大廳中篩選出時間上可以銜接的訂單，組成推薦組合。最多推薦三套搭配（送→接→送→接→送→接，共 6 單）。

這是「推薦」不是「限制」，司機看到推薦後可以選擇接或不接。

## MVP 範圍

- 支援機場：桃園機場（TPE）、松山機場（TSA）
- 支援區域：雙北地區
- 時間估算：固定區域對照表（未來可接 Google Maps API）
- 最大搭配數：3 套（6 單）

## 時間參數表

### 行車時間

| 路線 | 離峰時間 | 尖峰時間 |
|------|---------|---------|
| 雙北 → 桃園機場 | 50 分鐘 | 75 分鐘 |
| 桃園機場 → 雙北 | 50 分鐘 | 75 分鐘 |
| 雙北 → 松山機場 | 30 分鐘 | 50 分鐘 |
| 松山機場 → 雙北 | 30 分鐘 | 50 分鐘 |

### 尖峰時段

| 時段 | 時間 |
|------|------|
| 早上尖峰 | 06:30 - 09:00 |
| 下午尖峰 | 16:00 - 19:00 |
| 離峰 | 其餘時段 |

### 其他時間參數

| 參數 | 時間 | 說明 |
|------|------|------|
| 客人出關時間 | 30 - 60 分鐘 | 落地到出關上車，不分國際/國內 |
| 機場等候推薦範圍 | 60 分鐘 | 司機到機場後，只推薦 60 分鐘內可銜接的接機單 |
| 送機緩衝時間 | 60 - 90 分鐘 | 上一單接機下車地點到下一單送機上車地點之間預留的時間 |

## 核心計算邏輯

### 情境一：司機有一張送機單，推薦可銜接的接機單

```
已知：
  送機單出發時間 = T_depart（例如 14:00）
  出發地 = 雙北某區
  目的地 = 桃園機場

計算：
  判斷 T_depart 是否在尖峰時段
  行車時間 = 尖峰 ? 75分鐘 : 50分鐘
  司機到達機場時間 T_arrive = T_depart + 行車時間
    例：14:00 + 50分 = 14:50

推薦範圍：
  接機單的航班落地時間 T_land 需滿足：
    T_arrive - 20分鐘 ≤ T_land ≤ T_arrive + 40分鐘
    例：14:30 ≤ T_land ≤ 15:30

  解釋：
    - 落地比司機早到 20 分鐘（14:30 落地）：客人出關要 30-60 分鐘，
      司機 14:50 到，客人約 15:00-15:30 出來，幾乎無縫銜接
    - 落地比司機晚到 40 分鐘（15:30 落地）：客人約 16:00-16:30 出來，
      司機等約 70-100 分鐘，是可接受的上限

  額外條件：
    - 接機單的目的地機場必須跟送機單的目的地機場相同
      （送機到桃機 → 只推薦桃機的接機單）
```

### 情境二：司機有一張接機單，推薦可銜接的送機單

```
已知：
  接機單的航班落地時間 = T_land（例如 15:00）
  接機目的地 = 雙北某區（例如板橋）

計算：
  客人出關上車時間 T_pickup = T_land + 45分鐘（取中間值）
    例：15:00 + 45分 = 15:45
  判斷 T_pickup 出發時段是否為尖峰
  行車時間 = 尖峰 ? 75分鐘 : 50分鐘
  到達目的地時間 T_dest = T_pickup + 行車時間
    例：15:45 + 75分（尖峰）= 17:00
  送機緩衝 = 60 - 90 分鐘（取 75 分鐘中間值）
  司機可接送機的最早出發時間 T_next = T_dest + 75分鐘
    例：17:00 + 75分 = 18:15

推薦範圍：
  送機單的出發時間 T_send 需滿足：
    T_next ≤ T_send ≤ T_next + 60分鐘
    例：18:15 ≤ T_send ≤ 19:15

  額外條件：
    - 送機單的上車地點應在接機單目的地的「鄰近區域」
      （MVP 階段：同為雙北地區即可，不精確計算距離）
    - 送機單的目的地機場必須是桃機或松山
```

### 情境三：多單銜接（送→接→送→接→...）

系統遞迴計算：

```
第一套：
  [送機A] → 到機場 → [接機B]（用情境一的邏輯推薦）

第二套：
  [接機B] → 到目的地 → [送機C]（用情境二的邏輯推薦）
  [送機C] → 到機場 → [接機D]（用情境一的邏輯推薦）

第三套：
  [接機D] → 到目的地 → [送機E]（用情境二的邏輯推薦）
  [送機E] → 到機場 → [接機F]（用情境一的邏輯推薦）

最多三套，共 6 單。
```

## 演算法流程

```
輸入：司機的已接訂單列表 + 接單大廳所有可接訂單

Step 1：找出司機最近的一張已接訂單（按時間排序）

Step 2：判斷該訂單是送機還是接機
  - 如果是送機 → 用情境一推薦接機單
  - 如果是接機 → 用情境二推薦送機單

Step 3：從接單大廳篩選符合時間範圍的訂單
  - 過濾條件：時間範圍、機場一致、車型相容（大車可接小車單）
  - 排序方式：按「銜接緊密度」排序（等待時間最短的排前面）

Step 4：取前 3-5 筆推薦

Step 5：如果司機選了某筆推薦，系統繼續用同樣邏輯推薦下一單
  - 重複 Step 2-4，直到三套搭配完成或接單大廳沒有合適的單

輸出：推薦組合列表，每組包含：
  - 訂單資訊（時間、起終點、金額）
  - 預估銜接時間（「預計 15:30 到桃機，此單 15:00 落地，等候約 30 分鐘」）
  - 銜接緊密度標籤（完美銜接 / 需等候 / 時間較趕）
```

## 銜接緊密度標籤

### 送機 → 接機

| 標籤 | 條件 | 說明 |
|------|------|------|
| 完美銜接 | 司機到機場時，客人預計 0-30 分鐘內出關 | 幾乎不用等 |
| 需等候 | 司機到機場後需等 30-60 分鐘 | 可以接受 |
| 時間較趕 | 客人可能比司機早出關 | 提醒司機可能要加快 |

### 接機 → 送機

| 標籤 | 條件 | 說明 |
|------|------|------|
| 完美銜接 | 緩衝時間 >= 90 分鐘 | 充裕 |
| 時間合理 | 緩衝時間 60-90 分鐘 | 正常 |
| 時間較趕 | 緩衝時間 < 60 分鐘 | 提醒送機有時間壓力，不能遲到 |

## 司機端 UI 設計

### 智慧排班按鈕

在司機儀表板（接單大廳上方或旁邊）放一個「智慧排班」按鈕。

### 推薦結果頁面

```
┌─────────────────────────────────────────┐
│ 智慧排班推薦                              │
│                                          │
│ 你目前的行程：                             │
│ ┌──────────────────────────────────────┐ │
│ │ 14:00 送機  板橋 → 桃園機場  $1,400  │ │
│ │ 預計 14:50 到達桃機                   │ │
│ └──────────────────────────────────────┘ │
│              ↓ 到機場後                   │
│ 推薦接機（3 筆）：                        │
│ ┌──────────────────────────────────────┐ │
│ │ 14:40 落地  桃機 → 中和  $1,000      │ │
│ │ [完美銜接] 客人預計 15:10-15:40 出關   │ │
│ │                        [接這單]       │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ 15:00 落地  桃機 → 土城  $900        │ │
│ │ [完美銜接] 客人預計 15:30-16:00 出關   │ │
│ │                        [接這單]       │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ 15:20 落地  桃機 → 新店  $1,100      │ │
│ │ [需等候] 客人預計 15:50-16:20 出關     │ │
│ │ 預計等候約 60 分鐘                     │ │
│ │                        [接這單]       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ 如果你接了「桃機→中和 $1,000」，          │
│ 還可以再接這些送機單：                     │
│ ┌──────────────────────────────────────┐ │
│ │ 18:00 送機  板橋 → 桃機  $1,200      │ │
│ │ [時間合理] 預計 17:00 到中和            │ │
│ │ 緩衝約 60 分鐘                        │ │
│ │                        [加入排班]      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ 排班預覽：                                │
│ 14:00 送機 板橋→桃機 $1,400              │
│   ↓ 50分鐘車程                           │
│ 14:50 到達桃機，等候接機                   │
│ 15:10 接機 桃機→中和 $1,000（預估）        │
│   ↓ 75分鐘車程（尖峰）                    │
│ 16:25 到達中和                            │
│   ↓ 75分鐘緩衝                           │
│ 18:00 送機 板橋→桃機 $1,200              │
│                                          │
│ 總收入預估：$3,600                        │
│                                          │
│        [確認排班]    [返回]                │
└─────────────────────────────────────────┘
```

### 排班預覽（時間軸）

確認排班前，顯示完整的時間軸讓司機一目瞭然：
- 每一單的出發時間、預估到達時間
- 銜接之間的等候/緩衝時間
- 尖峰/離峰標記
- 總收入預估

## 尖峰判斷函數

```typescript
function isPeakHour(time: Date): boolean {
  const hour = time.getHours();
  const minute = time.getMinutes();
  const totalMinutes = hour * 60 + minute;

  // 早上尖峰 06:30-09:00
  if (totalMinutes >= 390 && totalMinutes <= 540) return true;
  // 下午尖峰 16:00-19:00
  if (totalMinutes >= 960 && totalMinutes <= 1140) return true;

  return false;
}
```

## 行車時間函數

```typescript
interface TravelTime {
  offPeak: number;  // 分鐘
  peak: number;     // 分鐘
}

const TRAVEL_TIMES: Record<string, TravelTime> = {
  'taipei-TPE': { offPeak: 50, peak: 75 },  // 雙北→桃機
  'TPE-taipei': { offPeak: 50, peak: 75 },  // 桃機→雙北
  'taipei-TSA': { offPeak: 30, peak: 50 },  // 雙北→松山
  'TSA-taipei': { offPeak: 30, peak: 50 },  // 松山→雙北
};

function getTravelMinutes(from: string, to: string, departTime: Date): number {
  const key = `${from}-${to}`;
  const times = TRAVEL_TIMES[key];
  if (!times) return 60; // 預設 60 分鐘
  return isPeakHour(departTime) ? times.peak : times.offPeak;
}
```

## 推薦篩選函數

```typescript
// 情境一：送機完，推薦接機單
function recommendPickupAfterDropoff(
  dropoffOrder: Order,        // 司機的送機單
  availableOrders: Order[]    // 接單大廳可接的單
): RecommendedOrder[] {

  // 計算司機到達機場時間
  const travelMin = getTravelMinutes('taipei', dropoffOrder.airport, dropoffOrder.departTime);
  const arriveAtAirport = addMinutes(dropoffOrder.departTime, travelMin);

  // 篩選：航班落地時間在 arriveAtAirport-20分 到 arriveAtAirport+40分
  const minLanding = addMinutes(arriveAtAirport, -20);
  const maxLanding = addMinutes(arriveAtAirport, 40);

  return availableOrders
    .filter(order =>
      order.type === 'pickup' &&                    // 只要接機單
      order.airport === dropoffOrder.airport &&       // 同一個機場
      order.landingTime >= minLanding &&              // 落地時間範圍
      order.landingTime <= maxLanding &&
      isVehicleCompatible(driver.vehicle, order.vehicle) // 車型相容
    )
    .map(order => ({
      ...order,
      waitMinutes: diffMinutes(order.landingTime, arriveAtAirport) + 45, // 落地+45分出關
      tightness: calculateTightness(arriveAtAirport, order.landingTime),
    }))
    .sort((a, b) => a.waitMinutes - b.waitMinutes)  // 等待時間短的排前面
    .slice(0, 5);  // 最多推薦 5 筆
}

// 情境二：接機完，推薦送機單
function recommendDropoffAfterPickup(
  pickupOrder: Order,
  availableOrders: Order[]
): RecommendedOrder[] {

  // 計算到達目的地時間
  const pickupTime = addMinutes(pickupOrder.landingTime, 45); // 落地+45分出關
  const travelMin = getTravelMinutes(pickupOrder.airport, 'taipei', pickupTime);
  const arriveAtDest = addMinutes(pickupTime, travelMin);

  // 送機緩衝：75 分鐘（60-90 的中間值）
  const buffer = 75;
  const earliestSend = addMinutes(arriveAtDest, buffer);
  const latestSend = addMinutes(earliestSend, 60);

  return availableOrders
    .filter(order =>
      order.type === 'dropoff' &&                     // 只要送機單
      order.departTime >= earliestSend &&              // 出發時間範圍
      order.departTime <= latestSend &&
      isVehicleCompatible(driver.vehicle, order.vehicle)
    )
    .map(order => ({
      ...order,
      bufferMinutes: diffMinutes(order.departTime, arriveAtDest),
      tightness: calculateSendTightness(arriveAtDest, order.departTime),
    }))
    .sort((a, b) => a.bufferMinutes - b.bufferMinutes)
    .slice(0, 5);
}
```

## 資料庫變更

Order model 需要以下欄位支援智慧排班：

```prisma
model Order {
  // ... 現有欄位 ...
  landingTime   DateTime?   // 航班落地時間（接機單用）
  departTime    DateTime?   // 出發時間（送機單用）
  // landingTime 和 departTime 用訂單的 time 欄位 + date 組合計算
}

model ScheduleGroup {
  id          String   @id @default(cuid())
  driverId    String
  driver      Driver   @relation(fields: [driverId], references: [id])
  orders      ScheduleGroupOrder[]
  totalIncome Int      // 總收入預估
  status      String   @default("draft") // draft / confirmed / completed
  createdAt   DateTime @default(now())
}

model ScheduleGroupOrder {
  id        String        @id @default(cuid())
  groupId   String
  group     ScheduleGroup @relation(fields: [groupId], references: [id])
  orderId   String
  order     Order         @relation(fields: [orderId], references: [id])
  sequence  Int           // 排序（1, 2, 3...）
}
```

## API 端點

### GET /api/schedule/recommend

根據司機的已接訂單，推薦可銜接的訂單。

```
Request:
  Headers: Authorization: Bearer <token>
  Query: ?orderId=xxx（起始訂單 ID，如果有的話）

Response:
{
  success: true,
  data: {
    currentOrder: { ... },            // 司機目前的訂單
    arriveTime: "2025-04-01T14:50",   // 預計到達時間
    recommendations: [
      {
        order: { ... },               // 推薦的訂單
        waitMinutes: 30,              // 預計等候時間
        tightness: "perfect",         // perfect / reasonable / tight
        tightnessLabel: "完美銜接",
        explanation: "客人預計 15:10-15:40 出關"
      }
    ],
    nextRecommendations: [            // 如果接了第一筆推薦，還能接的下一單
      { ... }
    ]
  }
}
```

### POST /api/schedule/confirm

確認排班組合。

```
Request:
{
  orderIds: ["order1", "order2", "order3"]  // 按順序排列
}

Response:
{
  success: true,
  data: {
    groupId: "clxx...",
    totalIncome: 3600,
    message: "排班確認完成，共 3 筆行程"
  }
}
```

## 開發優先順序

1. 建立時間參數表和計算函數（isPeakHour, getTravelMinutes）
2. 實作情境一的推薦邏輯（送機→接機）
3. 實作情境二的推薦邏輯（接機→送機）
4. 建立司機端「智慧排班」UI
5. 實作多單銜接（遞迴推薦）
6. 加入排班預覽時間軸
7. 建立 ScheduleGroup 資料模型和 API

## 未來擴充

- 接入 Google Maps API 取代固定時間估算
- 增加中部、南部區域的時間參數
- 增加小港機場（KHH）、清泉崗機場（RMQ）
- 根據司機歷史資料優化推薦（常跑的路線優先推薦）
- 考慮高速公路即時路況
