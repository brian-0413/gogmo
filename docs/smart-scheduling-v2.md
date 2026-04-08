# 智慧排班系統 — 完整邏輯規格

## 系統概述

司機以一張已接的訂單作為「觸發單」，系統根據觸發單的種類（送機/接機），自動從接單大廳篩選出時間和地理位置最佳的銜接訂單，推薦給司機。

觸發單有兩種情境，複雜度完全不同：

| 觸發單 | 推薦單 | 複雜度 | 原因 |
|--------|--------|--------|------|
| 送機（市區→機場）| 接機 | 簡單 | 目的地統一是機場，只需考慮時間 |
| 接機（機場→市區）| 送機 | 複雜 | 目的地不固定，要考慮地理位置+時間+距離 |

## 時間參數

### 尖峰時段

| 時段 | 時間 |
|------|------|
| 早上尖峰 | 06:30 - 09:00 |
| 下午尖峰 | 16:00 - 19:00 |
| 離峰 | 其餘時段 |

### 市區到機場行車時間

| 路線 | 離峰 | 尖峰 |
|------|------|------|
| 雙北各區 → 桃園機場 | 45 分鐘 | 75 分鐘 |
| 雙北各區 → 松山機場 | 依次生活圈矩陣 | 依次生活圈矩陣 × 1.5 |

### 客人出關時間

| 參數 | 時間 |
|------|------|
| 標準出關時間 | 45 - 60 分鐘 |
| 計算用中間值 | 50 分鐘 |

### 推薦時間窗口

| 場景 | 前後容許範圍 |
|------|------------|
| 送機觸發 → 推薦接機 | 安全時間 T4 的前後 20 分鐘 |
| 接機觸發 → 推薦送機 | 最早可接時間之後 60 分鐘內 |

## 次生活圈系統

### 11 個次生活圈

| 編號 | 名稱 | 行政區 |
|------|------|--------|
| 1 | 台北市 | 中正區、大同區、中山區、松山區、信義區 |
| 2 | 內湖汐止 | 內湖區、汐止區 |
| 3 | 南港港湖 | 南港區 |
| 4 | 北投士林 | 北投區、士林區 |
| 5 | 大安文山 | 大安區、萬華區、景美區、木柵區 |
| 6 | 板橋土城 | 板橋區、土城區 |
| 7 | 永和中和 | 永和區、中和區 |
| 8 | 三重蘆洲 | 三重區、蘆洲區、五股區 |
| 9 | 新莊泰山 | 新莊區、泰山區、林口區 |
| 10 | 新店 | 新店區、深坑區、石碇區、坪林區、烏來區 |
| 11 | 淡水 | 淡水區、八里區、三芝區、石門區 |

### 次生活圈間離峰行車時間矩陣（分鐘）

```
          台北 內湖 南港 北投 大安 板橋 永和 三重 新莊 新店 淡水
台北市     15   20   20   25   15   25   20   20   25   25   35
內湖汐止   20   15   15   25   25   35   30   25   30   35   45
南港港湖   20   15   15   30   25   35   35   30   35   35   45
北投士林   25   25   30   15   30   35   30   25   35   40   40
大安文山   15   25   25   30   15   30   25   25   30   20   40
板橋土城   25   35   35   35   30   15   20   20   25   35   45
永和中和   20   30   35   30   25   20   15   20   25   30   40
三重蘆洲   20   25   30   25   25   20   20   15   20   30   35
新莊泰山   25   30   35   35   30   25   25   20   15   35   40
新店       25   35   35   40   20   35   30   30   35   15   50
淡水       35   45   45   40   40   45   40   35   40   50   15
```

### 尖峰時間計算

尖峰行車時間 = 離峰行車時間 × 1.5（取整數）

例：台北市 → 板橋土城，離峰 25 分鐘，尖峰 = 25 × 1.5 = 38 分鐘

## 情境一：送機觸發 → 推薦接機（簡單）

### 邏輯說明

送機的目的地固定是機場，所以推薦接機時不需要考慮地理因素，只需要計算時間。

### 時間計算公式

```
T1 = 送機單的出發時間（司機從市區出發的時間）
T2 = T1 + 市區到機場的行車時間（離峰 45 分 / 尖峰 75 分）
     → T2 是司機抵達機場的時間
T3 = 客人出關時間（50 分鐘，取中間值）
T4 = T2 + T3
     → T4 是「安全時間」，即接機客人預計出關的時間

推薦範圍：落地時間在 T4 ± 20 分鐘的接機單
```

### 完整範例

```
觸發單：14:00 送機，板橋 → 桃園機場，$1,400

Step 1：判斷是否尖峰
  14:00 不在尖峰時段 → 離峰

Step 2：計算 T2（司機到達機場時間）
  T2 = 14:00 + 45 分鐘（離峰）= 14:45

Step 3：計算 T4（安全時間）
  T4 = 14:45 + 50 分鐘（出關）= 15:35

Step 4：推薦範圍
  推薦落地時間在 15:15 ~ 15:55 的接機單
  （T4 - 20分 = 15:15，T4 + 20分 = 15:55）

Step 5：從接單大廳篩選
  - 種類 = 接機
  - 機場 = 桃園機場（與送機目的地相同）
  - 落地時間在 15:15 ~ 15:55 之間
  - 車型相容
  - 按落地時間與 T4 的接近程度排序（越接近越前面）
```

### 銜接緊密度標籤

| 標籤 | 條件 | 說明 |
|------|------|------|
| 完美銜接 | 落地時間在 T4 ± 5 分鐘內 | 司機幾乎不用等 |
| 良好銜接 | 落地時間在 T4 ± 20 分鐘內 | 等候可接受 |
| 可接受 | 落地時間在 T4 - 20分 ~ T4 + 40分 | 需要等較久但仍合理 |

### 松山機場的特殊處理

松山機場在市區，行車時間用次生活圈矩陣計算，不是固定 45/75 分鐘。

```
例：大安文山 → 松山機場（屬於台北市圈）
離峰行車時間 = 大安文山到台北市的矩陣值 = 15 分鐘
尖峰行車時間 = 15 × 1.5 = 23 分鐘
```

## 情境二：接機觸發 → 推薦送機（複雜）

### 邏輯說明

接機的目的地不固定（取決於乘客去哪），推薦送機時要考慮：
1. 司機到達目的地的時間
2. 目的地所在的次生活圈
3. 從目的地的次生活圈到送機客人上車點的行車時間
4. 送機有時間壓力，必須預留足夠緩衝

### 時間計算公式

```
T1 = 接機單的航班落地時間
T2 = T1 + 50 分鐘（客人出關上車）
     → T2 是司機從機場出發的時間
T3 = T2 + 機場到目的地的行車時間
     → T3 是司機到達接機目的地（客人下車處）的時間
T4 = 計算接機目的地的次生活圈
T5 = 對接單大廳中每一筆送機單，計算：
     T4 的次生活圈 → 送機單上車點的次生活圈 的行車時間
     → T5 是司機從下車處到下一位送機客人上車處的移動時間
T6 = T3 + T5 + 30 分鐘（緩衝時間）
     → T6 是司機「最早可以接送機單」的時間

推薦範圍：送機出發時間在 T6 ~ T6 + 60 分鐘的送機單
```

### 完整範例

```
觸發單：15:00 落地，接機，桃園機場 → 永和區，$1,000

Step 1：計算 T2（司機從機場出發時間）
  T2 = 15:00 + 50 分鐘 = 15:50

Step 2：判斷是否尖峰
  15:50 不在尖峰時段 → 離峰

Step 3：計算 T3（司機到達永和的時間）
  桃園機場到雙北離峰 = 45 分鐘
  T3 = 15:50 + 45 分鐘 = 16:35

Step 4：辨識次生活圈
  永和區 → 次生活圈「永和中和」

Step 5：對接單大廳的每筆送機單計算 T5
  假設大廳有三筆送機單：
  
  送機單 A：17:30 出發，板橋區 → 桃機，$1,200
    板橋區 → 次生活圈「板橋土城」
    永和中和 → 板橋土城 = 20 分鐘（離峰）
    T6 = 16:35 + 20 + 30 = 17:25
    送機出發 17:30 >= T6 17:25 ✓ 來得及！差距 5 分鐘
    → 完美銜接

  送機單 B：18:00 出發，內湖區 → 桃機，$1,400
    內湖區 → 次生活圈「內湖汐止」
    永和中和 → 內湖汐止 = 30 分鐘（離峰）
    但此時 16:35 出發到內湖，16:35 是尖峰！
    尖峰時間 = 30 × 1.5 = 45 分鐘
    T6 = 16:35 + 45 + 30 = 17:50
    送機出發 18:00 >= T6 17:50 ✓ 來得及！差距 10 分鐘
    → 完美銜接

  送機單 C：17:00 出發，新店區 → 桃機，$1,100
    新店區 → 次生活圈「新店」
    永和中和 → 新店 = 30 分鐘（離峰）
    T6 = 16:35 + 30 + 30 = 17:35
    送機出發 17:00 < T6 17:35 ✗ 來不及！
    → 不推薦

Step 6：排序推薦
  1. 送機單 A：板橋 17:30，$1,200（完美銜接，差距 5 分鐘）
  2. 送機單 B：內湖 18:00，$1,400（完美銜接，差距 10 分鐘）
```

### 銜接緊密度標籤

| 標籤 | 條件 | 說明 |
|------|------|------|
| 完美銜接 | 送機出發時間 - T6 <= 15 分鐘 | 時間剛好，不會等太久也不會趕 |
| 時間充裕 | 送機出發時間 - T6 在 15-40 分鐘 | 有空檔可以休息 |
| 時間寬鬆 | 送機出發時間 - T6 在 40-60 分鐘 | 等比較久但可以接受 |
| 時間較趕 | T6 - 送機出發時間 <= 10 分鐘 | 有點趕但理論上來得及，標紅色警告 |

### 關鍵：尖峰時間的連鎖判斷

在計算 T5（下車處到送機上車處的行車時間）時，要用 T3 的時間來判斷是否尖峰：

```
T3 = 16:35（司機到達永和的時間）
  → 16:35 在下午尖峰（16:00-19:00）
  → 所以從永和出發去接送機客人的行車時間要用尖峰值
  → 永和中和 → 內湖汐止 離峰 30 分 → 尖峰 = 30 × 1.5 = 45 分
```

## 地點到次生活圈的對應

### 地址解析

訂單的起點/終點是自由文字（例如「永和」「板橋」「文山」），系統需要能對應到次生活圈。

**對應規則：**

用關鍵字匹配，從訂單的地點文字中找到行政區名稱，再對應到次生活圈。

```typescript
const ZONE_MAPPING: Record<string, string> = {
  // 1. 台北市
  '中正': '台北市', '大同': '台北市', '中山': '台北市',
  '松山': '台北市', '信義': '台北市',
  // 2. 內湖汐止
  '內湖': '內湖汐止', '汐止': '內湖汐止',
  // 3. 南港港湖
  '南港': '南港港湖',
  // 4. 北投士林
  '北投': '北投士林', '士林': '北投士林',
  // 5. 大安文山
  '大安': '大安文山', '萬華': '大安文山', '文山': '大安文山',
  '景美': '大安文山', '木柵': '大安文山',
  // 6. 板橋土城
  '板橋': '板橋土城', '土城': '板橋土城',
  // 7. 永和中和
  '永和': '永和中和', '中和': '永和中和',
  // 8. 三重蘆洲
  '三重': '三重蘆洲', '蘆洲': '三重蘆洲', '五股': '三重蘆洲',
  // 9. 新莊泰山
  '新莊': '新莊泰山', '泰山': '新莊泰山', '林口': '新莊泰山',
  // 10. 新店
  '新店': '新店', '深坑': '新店', '石碇': '新店',
  '坪林': '新店', '烏來': '新店',
  // 11. 淡水
  '淡水': '淡水', '八里': '淡水', '三芝': '淡水', '石門': '淡水',
};
```

**無法辨識時：** 預設為「台北市」圈（最中心），並在推薦結果上標記「地點預估，僅供參考」。

## 多單銜接（送→接→送→接→...）

### 連鎖推薦流程

```
第一套：
  [送機 A] → 情境一邏輯 → 推薦 [接機 B]

第二套：
  [接機 B] → 情境二邏輯 → 推薦 [送機 C]
  [送機 C] → 情境一邏輯 → 推薦 [接機 D]

第三套：
  [接機 D] → 情境二邏輯 → 推薦 [送機 E]
  [送機 E] → 情境一邏輯 → 推薦 [接機 F]

最多三套，共 6 單。
```

### 連鎖計算的注意事項

1. 每一段的尖峰/離峰判斷都要用**該段出發時間**，不是用觸發單的時間
2. 越後面的推薦，時間誤差會越大（因為每段都有預估），標籤要顯示提醒
3. 第三套的時間預估可能偏差超過 30 分鐘，建議標注「預估時間，僅供參考」

## 推薦排序演算法

### 送機觸發 → 推薦接機（排序權重）

```
排序分數 = 時間接近度 × 0.7 + 金額 × 0.3

時間接近度 = 1 - |落地時間 - T4| / 40
  （落地時間越接近 T4，分數越高，最遠 40 分鐘外分數為 0）

金額 = 訂單金額 / 最高金額
  （金額越高，分數越高）
```

### 接機觸發 → 推薦送機（排序權重）

```
排序分數 = 時間可行度 × 0.4 + 地理接近度 × 0.3 + 金額 × 0.3

時間可行度 = (送機出發時間 - T6) 在 0-60 分鐘內
  越接近 0 分數越高（完美銜接），超過 60 分鐘不推薦

地理接近度 = 1 - (接機下車圈到送機上車圈的行車時間) / 50
  （次生活圈越近，分數越高）

金額 = 訂單金額 / 最高金額
```

## 計算函數規格

### isPeakHour(time: Date): boolean

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

### getZone(location: string): string

```typescript
function getZone(location: string): string {
  for (const [keyword, zone] of Object.entries(ZONE_MAPPING)) {
    if (location.includes(keyword)) return zone;
  }
  return '台北市'; // 預設
}
```

### getZoneTravelMinutes(fromZone: string, toZone: string, departTime: Date): number

```typescript
function getZoneTravelMinutes(fromZone: string, toZone: string, departTime: Date): number {
  const offPeakMinutes = ZONE_MATRIX[fromZone][toZone]; // 從矩陣查
  if (isPeakHour(departTime)) {
    return Math.round(offPeakMinutes * 1.5);
  }
  return offPeakMinutes;
}
```

### getCityToAirportMinutes(zone: string, airport: string, departTime: Date): number

```typescript
function getCityToAirportMinutes(zone: string, airport: string, departTime: Date): number {
  if (airport === 'TPE') {
    // 桃機：固定值
    return isPeakHour(departTime) ? 75 : 45;
  }
  if (airport === 'TSA') {
    // 松山：松山屬於台北市圈，用矩陣算
    return getZoneTravelMinutes(zone, '台北市', departTime);
  }
  return 60; // 預設
}
```

### recommendPickupAfterDropoff（情境一）

```typescript
function recommendPickupAfterDropoff(
  dropoffOrder: Order,      // 觸發的送機單
  availableOrders: Order[],  // 接單大廳所有單
  driver: Driver
): RecommendedOrder[] {

  const driverZone = getZone(dropoffOrder.pickup); // 出發地的次生活圈
  const airport = dropoffOrder.airport;             // 目的地機場

  // T1 = 送機出發時間
  const T1 = dropoffOrder.departTime;

  // T2 = 到達機場時間
  const travelToAirport = getCityToAirportMinutes(driverZone, airport, T1);
  const T2 = addMinutes(T1, travelToAirport);

  // T4 = 安全時間（T2 + 客人出關 50 分鐘）
  const T4 = addMinutes(T2, 50);

  // 推薦範圍：T4 ± 20 分鐘
  const minLanding = addMinutes(T4, -20);
  const maxLanding = addMinutes(T4, 20);

  // 延伸範圍（可接受）：T4 - 20 到 T4 + 40
  const maxLandingExtended = addMinutes(T4, 40);

  return availableOrders
    .filter(order =>
      order.type === 'pickup' &&
      order.airport === airport &&
      order.landingTime >= minLanding &&
      order.landingTime <= maxLandingExtended &&
      isVehicleCompatible(driver.vehicle, order.vehicle)
    )
    .map(order => {
      const diffMin = diffMinutes(order.landingTime, T4);
      const absDiff = Math.abs(diffMin);
      let tightness: string;
      if (absDiff <= 5) tightness = 'perfect';
      else if (absDiff <= 20) tightness = 'good';
      else tightness = 'acceptable';

      const passengerOutTime = addMinutes(order.landingTime, 50);
      const waitMinutes = diffMinutes(passengerOutTime, T2);

      return {
        order,
        T4,
        estimatedWaitMinutes: Math.max(0, waitMinutes),
        tightness,
        score: calculatePickupScore(absDiff, order.price),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
```

### recommendDropoffAfterPickup（情境二）

```typescript
function recommendDropoffAfterPickup(
  pickupOrder: Order,        // 觸發的接機單
  availableOrders: Order[],
  driver: Driver
): RecommendedOrder[] {

  const airport = pickupOrder.airport;

  // T1 = 航班落地時間
  const T1 = pickupOrder.landingTime;

  // T2 = 司機從機場出發時間（落地 + 50 分鐘出關）
  const T2 = addMinutes(T1, 50);

  // 辨識接機目的地的次生活圈
  const destZone = getZone(pickupOrder.dropoff);

  // T3 = 司機到達目的地時間
  const airportToDest = getCityToAirportMinutes(destZone, airport, T2);
  // 注意：這裡是從機場到市區，時間相同但要用 T2 的時段判斷尖峰
  const T3 = addMinutes(T2, airportToDest);

  return availableOrders
    .filter(order =>
      order.type === 'dropoff' &&
      isVehicleCompatible(driver.vehicle, order.vehicle)
    )
    .map(order => {
      // 送機客人上車地的次生活圈
      const sendZone = getZone(order.pickup);

      // T5 = 接機下車處到送機上車處的行車時間
      const T5 = getZoneTravelMinutes(destZone, sendZone, T3);

      // T6 = 最早可接送機的時間 = T3 + T5 + 30 分鐘緩衝
      const T6 = addMinutes(T3, T5 + 30);

      // 送機出發時間
      const sendDepart = order.departTime;

      // 判斷：來不來得及？
      const buffer = diffMinutes(sendDepart, T6);

      if (buffer < -10) return null; // 完全來不及，不推薦
      if (buffer > 60) return null;  // 太遠，等太久

      let tightness: string;
      if (buffer < 0) tightness = 'tight';         // 有點趕
      else if (buffer <= 15) tightness = 'perfect'; // 完美
      else if (buffer <= 40) tightness = 'good';    // 充裕
      else tightness = 'loose';                     // 寬鬆

      return {
        order,
        destZone,
        sendZone,
        travelBetweenZones: T5,
        T3,
        T6,
        bufferMinutes: buffer,
        tightness,
        score: calculateDropoffScore(buffer, T5, order.price),
      };
    })
    .filter(r => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
```

## 司機端 UI 顯示

### 送機觸發的推薦畫面

```
你的行程：14:00 送機 板橋 → 桃園機場 $1,400
預計 14:45 到達桃機（離峰 45 分鐘）
安全時間 T4 = 15:35（出關 50 分鐘）

推薦接機（2 筆）：

 [完美銜接]
 15:30 落地  桃機 → 中和  $1,000
 客人預計 16:20 出關，等候約 35 分鐘
                              [接這單]

 [良好銜接]
 15:45 落地  桃機 → 新店  $1,100
 客人預計 16:35 出關，等候約 50 分鐘
                              [接這單]
```

### 接機觸發的推薦畫面

```
你的行程：15:00 落地 接機 桃機 → 永和 $1,000
預計 15:50 出發，16:35 到達永和（離峰 45 分鐘）
目的地：永和中和圈

推薦送機（2 筆）：

 [完美銜接]  板橋 → 桃機
 17:30 出發  $1,200
 永和中和 → 板橋土城：20 分鐘
 緩衝時間：25 分鐘
                              [接這單]

 [完美銜接]  內湖 → 桃機
 18:00 出發  $1,400
 永和中和 → 內湖汐止：45 分鐘（尖峰）
 緩衝時間：10 分鐘
                              [接這單]

排班預覽：
 15:00 落地 → 15:50 出發 → 16:35 到永和
   ↓ 20 分鐘到板橋 + 30 分鐘緩衝
 17:30 送機 板橋 → 桃機 $1,200

 總收入預估：$2,200
```

## 資料庫需要的欄位

Order model 需要以下欄位：

```prisma
model Order {
  // ... 現有欄位 ...
  landingTime   DateTime?   // 航班落地時間（接機用）
  departTime    DateTime?   // 出發時間（送機用）
  pickupZone    String?     // 上車地次生活圈（系統自動計算）
  dropoffZone   String?     // 下車地次生活圈（系統自動計算）
}
```

## 開發優先順序

1. 建立次生活圈對應表和行車時間矩陣（src/lib/zones.ts）
2. 建立地點 → 次生活圈的關鍵字匹配函數
3. 建立 isPeakHour、getZoneTravelMinutes、getCityToAirportMinutes 函數
4. 實作情境一：recommendPickupAfterDropoff
5. 實作情境二：recommendDropoffAfterPickup
6. 建立 GET /api/schedule/recommend API
7. 建立司機端「智慧排班」UI
8. 實作多單銜接（遞迴推薦，最多三套）
9. 建立排班預覽時間軸

## 未來擴充

- 接入 Google Maps API 取代固定行車時間矩陣（更精確）
- 增加桃園市、基隆市的次生活圈
- 增加中部（台中）、南部（高雄）的行車時間矩陣
- 增加小港機場（KHH）、清泉崗機場（RMQ）
- 根據司機歷史跑趟資料，個人化推薦
- 考慮即時路況（串接交通部 API）
- 推薦時考慮肯驛系統限制
