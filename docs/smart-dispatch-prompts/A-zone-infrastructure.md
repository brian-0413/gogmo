# 提示詞 A：Zone 基礎建設

> **執行順序：A → B → C**
> **預估時間：0.5-1 天**
> **優先度：最高（B 和 C 都依賴這份）**

---

## 提示詞本體

```
請建立 gogmo 智慧排單系統的「Zone 基礎建設」。

## 背景

我已經把分區與 travel time matrix 的規範放在 docs/gogmo-zones-matrix.md，請完整閱讀後實作。

這份基礎建設會被智慧排單演算法、訂單分類、司機推薦等多處使用。

## 任務

### Step 1：建立 Zone 資料模組

在 lib/zones/ 下建立以下檔案：

#### 1-1. lib/zones/types.ts
根據 docs/gogmo-zones-matrix.md 的「TypeScript 定義」段落，建立：
- ZoneCode type（11 個雙北 zone）
- AirportCode type（4 個機場）
- ExternalZoneCode type（7 個外縣市）
- AnyZone type（以上所有的 union）
- DistrictMapping interface
- TravelTimeEntry interface

#### 1-2. lib/zones/districtMap.ts
建立「行政區 → zone」的對應表，涵蓋：
- 台北市 12 個區
- 新北市 29 個區
- 桃園市主要區（歸入 TAOYUAN_CORE / NORTH / SOUTH）
- 基隆市（歸入 NTPE_COASTAL）
- 新竹市、新竹縣（歸入 HSINCHU）
- 苗栗縣（歸入 MIAOLI）
- 宜蘭縣（分 NORTH/SOUTH）
- 其他縣市歸入 `OTHER`（暫定，智慧排單不處理）

匯出為 Record<string, ZoneCode | AirportCode | ExternalZoneCode | 'OTHER'>

範例：
```typescript
export const DISTRICT_TO_ZONE = {
  '大安區': 'TPE_EAST',
  '信義區': 'TPE_EAST',
  '松山區': 'TPE_EAST',
  '板橋區': 'NTPE_WEST',
  '中和區': 'NTPE_WEST',
  // ... 涵蓋全部
};
```

#### 1-3. lib/zones/matrixData.ts
建立 11×11 的雙北 travel time matrix，以及 2×11 的機場→zone matrix。

資料完全依照 docs/gogmo-zones-matrix.md 的兩個 matrix 表格。

資料結構：
```typescript
export const TRAVEL_TIME_MATRIX: Record<AnyZone, Partial<Record<AnyZone, number>>> = {
  TPE_EAST: {
    TPE_EAST: 10,
    TPE_WEST: 15,
    TPE_NORTH: 20,
    // ...
  },
  // ...
};
```

請務必完整輸入所有格子，不要用 `...` 省略。

#### 1-4. lib/zones/travelTime.ts
根據 docs/gogmo-zones-matrix.md 的「查詢函式」段落，實作：

```typescript
export function getTravelTime(
  from: AnyZone,
  to: AnyZone,
  options?: {
    time?: Date;
    isWeekend?: boolean;
  }
): number;

export function getDistanceScore(travelTime: number): number;
```

時段倍率邏輯：
- 07:00-09:00 × 1.3
- 17:00-20:00 × 1.4
- 23:00-05:00 × 0.8
- 週末 × 1.1

距離分數邏輯：
- ≤10 分鐘 = 100
- ≤20 分鐘 = 85
- ≤35 分鐘 = 65
- ≤50 分鐘 = 35
- >50 分鐘 = 10

---

### Step 2：地址轉 Zone 工具

這是最關鍵也最容易出錯的部分。訂單的「起點」「終點」是字串（可能是「板橋區中山路」或「新北市板橋區」或「台北板橋」），需要正規化為 zone。

#### 2-1. lib/zones/addressToZone.ts

實作：
```typescript
export function addressToZone(address: string): AnyZone | 'OTHER' | null;
```

邏輯：
1. 如果包含「桃園機場」「桃機」「TPE」「大園機場」 → 回傳 AIRPORT_TPE
2. 如果包含「松山機場」「松機」「TSA」 → 回傳 AIRPORT_TSA
3. 如果包含「清泉崗」「台中機場」「RMQ」 → 回傳 AIRPORT_RMQ
4. 如果包含「小港」「高雄機場」「KHH」 → 回傳 AIRPORT_KHH
5. 用正則 `/([一-龥]+?區)/` 取出行政區字串
6. 去 DISTRICT_TO_ZONE 查對應 zone
7. 如果查不到，試試把「台北市」「新北市」等城市字串移除後再查
8. 如果還是查不到，回傳 null（表示無法分類）

請寫完整的單元測試，至少 20 組測試案例，包含：
- 純機場名稱：「桃機」「桃園機場」「TPE」
- 完整地址：「新北市板橋區中山路 123 號」
- 簡寫：「大安區」「板橋」
- 模糊地址：「大安區信義路」
- 邊界：「三峽區」（屬 NTPE_WESTEXT）
- 失敗：「花蓮市」（回傳 OTHER）

---

### Step 3：Zone 標記整合到 Order 模型

#### 3-1. Prisma schema 更新

Order 模型新增兩個欄位：
```prisma
originZone      String?   // AnyZone type 或 null
destinationZone String?   // AnyZone type 或 null
```

為什麼是 String 而不是 enum：因為 zone 代碼會擴充（例如之後加 HSINCHU_NORTH 等），用 String 比較彈性，在應用層用 TypeScript type 做型別安全。

#### 3-2. Migration 策略

新訂單建立時，在 POST /api/orders 內自動呼叫 addressToZone() 填入 originZone 和 destinationZone。

現有訂單的 zone 欄位可以留 null，後續功能會 gracefully handle（zone 為 null 時視為無法參與智慧排單）。

不需要 backfill 舊訂單，因為舊訂單已經派發完成。

---

## 測試需求

- lib/zones/travelTime.ts 的 getTravelTime()：至少 10 組測試，包含時段倍率
- lib/zones/addressToZone.ts：至少 20 組測試
- Matrix 對稱性測試：getTravelTime(A, B) 應 === getTravelTime(B, A)（在同時段條件下）

## 完成標準

1. lib/zones/ 底下檔案齊全
2. 所有測試通過
3. Prisma migration 預覽給我看
4. 給我 3 組實際 addressToZone() 的範例結果截圖或輸出

請**分步執行**，每完成一個 Step 給我看結果再繼續。先從 Step 1 開始。
```

---

## 給你的補充說明

**為什麼先做基礎建設**：B（演算法）和 C（UI）都會呼叫 `getTravelTime()` 和 `addressToZone()`，如果這層做不好，後面全部會卡住。

**為什麼 zone 用 String 不用 enum**：Prisma 的 enum 一旦改動就要 migration，但 zone 未來可能會細分（例如「淡水」從 Z11 獨立出來）。用 String + TypeScript type，應用層仍有型別安全，資料庫層更彈性。

**addressToZone 是最大的坑**：真實訂單的地址格式五花八門（「桃機」「桃園機場第二航廈」「大園鄉航站路」「南崁第一航站」都是同一個地方）。測試要寫扎實，否則會有大量訂單分類錯誤。
