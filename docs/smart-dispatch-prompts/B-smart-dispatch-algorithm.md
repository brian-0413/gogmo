# 提示詞 B：智慧排單演算法核心

> **前置條件：必須先完成提示詞 A（Zone 基礎建設）**
> **預估時間：1-2 天**
> **優先度：最高**

---

## 提示詞本體

```
請實作 gogmo「智慧排單」演算法的核心邏輯。

## 背景

司機在接單大廳需要「智慧排單」功能，幫他根據現有行程推薦最佳的配套訂單。

核心邏輯：機場接送的賺錢單位是「接機+送機」配對。智慧排單不是排滿一天，而是幫每個機場趟配一個反向趟。

## 三層優先級

當司機有一張訂單（接機或送機）要智慧排單時：

1. **配套優先**：找反向類型（接機配送機、送機配接機）
2. **時間次之**：緩衝時間符合
3. **距離再次之**：用 11-zone matrix 判定

## 緩衝時間規則（固定）

- 接機單後的下一單：接機結束時間 + 2 小時
- 送機單後的下一單：送機結束時間 + 3 小時

緩衝差異原因：送機需要時間等班機、回程空車，較長。

## 演算法規格

### 輸入
- `anchorOrder`: 司機已有的那張訂單
- `candidateOrders`: 接單大廳所有可接訂單
- `driverContext`: 司機資訊（車型、位置等）

### 輸出
排序後的推薦列表，每筆附上：
- `totalScore`: 0-200
- `pairingScore`: 配套分數 (0 or 100)
- `timingScore`: 時間分數 (0-100)
- `distanceScore`: 距離分數 (0-100)
- `matchReason`: 推薦原因（中文字串）
- `warningFlag`: 降級層級（1/2/3/null）

### 計算步驟

#### Step 1：決定搜尋時間窗

```typescript
function getSearchWindow(anchorOrder: Order): {
  earliestStartTime: Date;
  latestStartTime: Date;
} {
  const anchorEnd = calculateOrderEndTime(anchorOrder);
  
  const bufferHours = anchorOrder.type === 'pickup' ? 2 : 3;
  const earliestStartTime = addHours(anchorEnd, bufferHours);
  
  // 上限設為 8 小時內（避免推薦太遠的單）
  const latestStartTime = addHours(earliestStartTime, 8);
  
  return { earliestStartTime, latestStartTime };
}

function calculateOrderEndTime(order: Order): Date {
  // 預估訂單結束時間 = 開始時間 + 預估車程
  // 車程可以用 zone matrix 估算
  const travelMinutes = getTravelTime(order.originZone, order.destinationZone);
  return addMinutes(order.scheduledTime, travelMinutes);
}
```

#### Step 2：過濾候選訂單

```typescript
function filterCandidates(
  candidates: Order[],
  anchor: Order,
  driver: Driver,
  window: SearchWindow
): Order[] {
  return candidates.filter(c => {
    // 排除：自己（同一張單）
    if (c.id === anchor.id) return false;
    
    // 排除：已被接
    if (c.status !== 'PENDING') return false;
    
    // 排除：車型不匹配（用既有的 canAcceptVehicleType 函式）
    if (!canAcceptVehicleType(driver.vehicleType, c.requiredVehicleType)) return false;
    
    // 排除：時間不在搜尋窗內
    if (c.scheduledTime < window.earliestStartTime) return false;
    if (c.scheduledTime > window.latestStartTime) return false;
    
    return true;
  });
}
```

#### Step 3：對每張候選訂單算三個分數

```typescript
function calculateScores(
  candidate: Order,
  anchor: Order
): {
  pairingScore: number;
  timingScore: number;
  distanceScore: number;
  totalScore: number;
} {
  // 配套分數
  const isPair = 
    (anchor.type === 'pickup' && candidate.type === 'dropoff') ||
    (anchor.type === 'dropoff' && candidate.type === 'pickup');
  const pairingScore = isPair ? 100 : 0;
  
  // 時間分數
  const bufferHours = anchor.type === 'pickup' ? 2 : 3;
  const anchorEnd = calculateOrderEndTime(anchor);
  const actualGap = (candidate.scheduledTime - anchorEnd) / (60 * 60 * 1000); // 轉小時
  
  let timingScore: number;
  if (actualGap < bufferHours) timingScore = 0; // 不夠緩衝
  else if (actualGap <= bufferHours + 2) timingScore = 100; // 剛好
  else if (actualGap <= bufferHours + 4) timingScore = 70;
  else if (actualGap <= bufferHours + 6) timingScore = 40;
  else timingScore = 10;
  
  // 距離分數
  const anchorEndZone = anchor.destinationZone;
  const candidateStartZone = candidate.originZone;
  const travelMinutes = getTravelTime(anchorEndZone, candidateStartZone, {
    time: anchorEnd,
    isWeekend: isWeekend(anchorEnd)
  });
  const distanceScore = getDistanceScore(travelMinutes);
  
  // 加權總分
  const totalScore = 
    pairingScore * 1.0 +  // 配套權重最高
    timingScore * 0.6 +   
    distanceScore * 0.4;
  
  return { pairingScore, timingScore, distanceScore, totalScore };
}
```

#### Step 4：降級策略

主層：pairingScore === 100 的訂單（有配套）

如果主層沒有訂單 → 降級層 B（同區域同類型）：
- candidate.type === anchor.type（同類型，非配套）
- candidate.originZone 與 anchor.destinationZone 距離分數 ≥ 65
- warningFlag = 'DEGRADE_B'
- matchReason = '同區域集中接單'

如果 B 層也沒有 → 降級層 C（較遠反向）：
- candidate.type !== anchor.type（反向，有配套）
- 但距離分數 < 65（較遠）
- warningFlag = 'DEGRADE_C'
- matchReason = '距離較遠，請評估移動時間'

如果 C 層也沒有 → 回傳空列表 + 友善訊息

#### Step 5：產生推薦原因

使用模板庫（lib/matching/reasonTemplates.ts）：

```typescript
export function buildMatchReason(scores: Scores, candidate: Order, anchor: Order): string {
  if (scores.pairingScore === 100) {
    if (scores.distanceScore >= 85 && scores.timingScore >= 100) {
      return '配套完美：時間距離都合理';
    }
    if (scores.distanceScore >= 85) {
      return `配套推薦：路線銜接度高（${getTravelMinutes()}分鐘移動）`;
    }
    return '配套推薦：能接續你的行程';
  }
  
  if (warningFlag === 'DEGRADE_B') {
    return '同區域集中接單，空車移動少';
  }
  
  if (warningFlag === 'DEGRADE_C') {
    return '有配套但距離較遠，請評估';
  }
  
  return '可接訂單';
}
```

---

## API 端點設計

### GET /api/driver/orders/smart-sort

查詢參數：
- `anchorOrderId`: string (可選，不傳表示司機無已接單)

邏輯：
1. 若有 anchorOrderId → 用上述演算法找配套
2. 若無 anchorOrderId → 用替代邏輯（按預期時薪排序所有 PENDING 訂單）
3. 回傳排序後的列表

回傳格式：
```typescript
{
  mode: 'anchored' | 'standalone';
  anchor: Order | null;
  recommendations: Array<{
    order: Order;
    totalScore: number;
    pairingScore: number;
    timingScore: number;
    distanceScore: number;
    matchReason: string;
    warningFlag: 'DEGRADE_B' | 'DEGRADE_C' | null;
    travelMinutesFromAnchor: number | null;
  }>;
  summary: {
    pairedCount: number;     // 配套推薦數
    degradeBCount: number;   // 降級 B 數量
    degradeCCount: number;   // 降級 C 數量
  };
}
```

---

## 檔案結構

```
lib/
├── matching/
│   ├── smartDispatch.ts          ← 核心演算法
│   ├── scoreCalculator.ts        ← 三個分數計算
│   ├── candidateFilter.ts        ← 候選訂單過濾
│   ├── reasonTemplates.ts        ← 推薦原因模板
│   └── types.ts                  ← 型別定義
```

app/api/driver/orders/smart-sort/route.ts

---

## 測試需求

### 單元測試
- getSearchWindow()：接機緩衝 2hr / 送機緩衝 3hr
- filterCandidates()：車型匹配、時間窗、狀態過濾
- calculateScores()：三個分數的邊界情況

### 整合測試場景

場景 1：完美配套
- 司機有 14:00 桃機→板橋接機
- 大廳有 17:00 中和→桃機送機
- 預期：totalScore 最高，matchReason 顯示「配套完美」

場景 2：降級 B（無配套）
- 司機有 14:00 桃機→板橋接機
- 大廳無送機，但有 17:00 桃機→中和的接機
- 預期：warningFlag = 'DEGRADE_B'

場景 3：降級 C（配套但遠）
- 司機有 14:00 桃機→板橋接機
- 大廳有 17:00 淡水→桃機送機（距離分 35）
- 預期：warningFlag = 'DEGRADE_C'

場景 4：完全無推薦
- 大廳沒任何合適訂單
- 預期：空列表 + 友善訊息

---

## 完成標準

1. 所有檔案建立完畢
2. 單元測試通過
3. 4 個整合測試場景都跑通
4. 給我一個實際呼叫 API 的 response 範例（用 mock 資料）

請**分 Step 執行**：
- Step 1-2：filter + window 實作 + 測試
- Step 3：scoreCalculator 實作 + 測試
- Step 4：降級策略整合 + 測試
- Step 5：API 端點 + 整合測試

每個 Step 完成給我看結果，通過才繼續。
```

---

## 給你的補充說明

**為什麼權重是 1.0 / 0.6 / 0.4**：

- 配套（1.0）權重最高 —— 反向訂單才是機場接送的核心賺錢模式
- 時間（0.6）次高 —— 時間不合司機根本不能接
- 距離（0.4）最低 —— 只要在合理範圍，距離稍遠司機還能決定要不要跑

**為什麼把緩衝時間寫成固定常數而不是計算**：

符合你的決策「簡單化處理」。未來如果需要動態計算（例如司機到機場附近可以緩衝 30 分鐘），改一個常數就好，不需要改架構。

**為什麼要有「場景 4：完全無推薦」**：

誠實比假裝重要。如果大廳真的沒合適的訂單，不要硬塞遠距離訂單給司機，顯示「目前沒有推薦」+ 引導司機自行瀏覽，反而更受信任。
