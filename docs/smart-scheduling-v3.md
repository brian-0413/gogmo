# 智慧排單系統規格（v2.0）

> **版本說明**
> - v1.0：初版，支援雙北地區、桃機/松機
> - v2.0：擴充全台支援、增加情境零（無已接單推薦）、空車順路推薦、航班 API 整合、次生活圈精細化

---

## 一、功能概述

司機按下「智慧排單」按鈕後，系統根據司機現有的已接訂單（或目前空閒狀態），從接單大廳中篩選出時間上可以銜接的訂單，組成推薦組合。最多推薦三套搭配（送→接→送→接→送→接，共 6 單）。

這是「**推薦**」不是「**限制**」——司機看到推薦後可以選擇接或不接；接單大廳內的其他訂單司機依然可以自由承接，但若與智慧排單邏輯衝突（時間不合理、疲勞駕駛等），系統會跳出警告。

---

## 二、MVP 範圍

| 項目 | 範圍 |
|------|------|
| 支援機場 | 桃園機場（TPE）、松山機場（TSA）、高雄小港（KHH）、台中清泉崗（RMQ） |
| 精細區域 | 雙北 13 個次生活圈（含林口、三峽鶯歌） |
| 粗略區域 | 全台其他縣市（以縣市為單位） |
| 時間估算 | 固定對照表 + 尖峰倍率（未來可接 Google Maps API） |
| 航班資訊 | 整合航班 API（MVP 即接入） |
| 最大搭配數 | 3 套（6 單） |
| 司機每日上限 | 6 單（每日 04:00 重置，不可手動解除） |

---

## 三、時間參數表

### 3.1 尖峰時段定義

| 時段 | 時間 |
|------|------|
| 早上尖峰 | 06:30 - 09:00 |
| 下午尖峰 | 16:00 - 19:00 |
| 離峰 | 其餘時段 |

### 3.2 雙北次生活圈劃分（13 區）

| 區域代號 | 次生活圈 | 行政區 |
|---------|---------|--------|
| TPE-01 | 台北市 | 中正、大同、中山、松山、信義 |
| TPE-02 | 內湖汐止 | 內湖、汐止 |
| TPE-03 | 南港港湖 | 南港 |
| TPE-04 | 北投士林 | 北投、士林 |
| TPE-05 | 大安文山 | 大安、萬華、文山 |
| TPE-06 | 板橋土城 | 板橋、土城、樹林 |
| TPE-07 | 永和中和 | 永和、中和 |
| TPE-08 | 三重蘆洲 | 三重、蘆洲、五股 |
| TPE-09 | 新莊泰山 | 新莊、泰山 |
| TPE-10 | 新店 | 新店、深坑、石碇、坪林、烏來 |
| TPE-11 | 淡水 | 淡水、八里、三芝、石門 |
| TPE-12 | 林口 | 林口 |
| TPE-13 | 三峽鶯歌 | 三峽、鶯歌 |

### 3.3 雙北次生活圈內部行車時間（離峰，分鐘）

> 來源：運研所《都會旅運調查之路線特性分析》+ gogmo 業務經驗補充
> **林口、三峽鶯歌的時間為初版估算，請 Brian 用業務 know-how 校正**

| 起/終 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 |
|-------|----|----|----|----|----|----|----|----|----|----|----|----|-----|
| **01 台北市** | 15 | 20 | 20 | 25 | 15 | 25 | 20 | 20 | 25 | 25 | 35 | 35 | 40 |
| **02 內湖汐止** | 20 | 15 | 15 | 25 | 25 | 35 | 30 | 25 | 30 | 35 | 45 | 40 | 50 |
| **03 南港港湖** | 20 | 15 | 15 | 30 | 25 | 35 | 35 | 30 | 35 | 35 | 45 | 45 | 50 |
| **04 北投士林** | 25 | 25 | 30 | 15 | 30 | 35 | 30 | 25 | 35 | 40 | 40 | 40 | 55 |
| **05 大安文山** | 15 | 25 | 25 | 30 | 15 | 30 | 25 | 25 | 30 | 20 | 40 | 40 | 40 |
| **06 板橋土城** | 25 | 35 | 35 | 35 | 30 | 15 | 20 | 20 | 25 | 35 | 45 | 30 | 25 |
| **07 永和中和** | 20 | 30 | 35 | 30 | 25 | 20 | 15 | 20 | 25 | 30 | 40 | 35 | 35 |
| **08 三重蘆洲** | 20 | 25 | 30 | 25 | 25 | 20 | 20 | 15 | 20 | 30 | 35 | 25 | 30 |
| **09 新莊泰山** | 25 | 30 | 35 | 35 | 30 | 25 | 25 | 20 | 15 | 35 | 40 | 20 | 30 |
| **10 新店** | 25 | 35 | 35 | 40 | 20 | 35 | 30 | 30 | 35 | 15 | 50 | 45 | 40 |
| **11 淡水** | 35 | 45 | 45 | 40 | 40 | 45 | 40 | 35 | 40 | 50 | 15 | 40 | 55 |
| **12 林口** | 35 | 40 | 45 | 40 | 40 | 30 | 35 | 25 | 20 | 45 | 40 | 15 | 30 |
| **13 三峽鶯歌** | 40 | 50 | 50 | 55 | 40 | 25 | 35 | 30 | 30 | 40 | 55 | 30 | 15 |

### 3.4 雙北各區 → 機場行車時間（離峰 / 尖峰，分鐘）

> **本表為初版估算，請 Brian 校正**
> 計算方式：先填離峰時間，尖峰時間 = 離峰 × 尖峰倍率（見 3.6）

| 次生活圈 | →桃園機場 | →松山機場 |
|---------|-----------|-----------|
| 01 台北市 | 50 / 75 | 15 / 25 |
| 02 內湖汐止 | 55 / 80 | 15 / 25 |
| 03 南港港湖 | 55 / 80 | 20 / 30 |
| 04 北投士林 | 55 / 80 | 25 / 40 |
| 05 大安文山 | 50 / 75 | 20 / 30 |
| 06 板橋土城 | 40 / 60 | 30 / 45 |
| 07 永和中和 | 45 / 65 | 25 / 40 |
| 08 三重蘆洲 | 40 / 60 | 25 / 40 |
| 09 新莊泰山 | 35 / 55 | 30 / 45 |
| 10 新店 | 50 / 75 | 30 / 45 |
| 11 淡水 | 60 / 90 | 35 / 55 |
| 12 林口 | 20 / 30 | 35 / 55 |
| 13 三峽鶯歌 | 30 / 45 | 45 / 70 |

### 3.5 全台長途行車時間（離峰，分鐘）

> 用於長途單推薦。MVP 階段以縣市為單位粗略計算，不細分次生活圈。
> 下列時間均為單向時間，跨縣市不適用尖峰倍率（因高速公路為主）。

#### 3.5.1 各縣市 → 桃園機場（TPE）

| 縣市 | 時間（分鐘） | 備註 |
|------|------------|------|
| 基隆 | 90 | |
| 桃園 | 30 | |
| 新竹 | 80 | |
| 苗栗 | 110 | |
| 台中 | 150 | |
| 彰化 | 180 | |
| 雲林 | 210 | |
| 嘉義 | 240 | |
| 台南 | 270 | |
| 高雄 | 300 | |
| 屏東 | 330 | |
| 宜蘭 | 120 | 走雪隧 |
| 花蓮 | 240 | 走蘇花 |
| 台東 | 420 | 走南迴或花東縱谷 |

#### 3.5.2 各縣市 → 松山機場（TSA）

桃機參考 3.5.1，然後各縣市→松機的時間 = 各縣市→桃機的時間 - 30 分鐘（MVP 簡化處理，之後可細分）。

#### 3.5.3 各縣市 → 小港機場（KHH）、清泉崗機場（RMQ）

長途單基本上以桃機、松機為主軸。若司機承接 KHH 或 RMQ 的訂單，系統以「司機當前訂單終點」為起算點，查找回程方向的推薦單。

### 3.6 尖峰倍率規則（分級）

僅適用於**雙北內部**與**雙北↔機場**的行車時間。跨縣市長途不套用尖峰倍率。

| 離峰時間 | 尖峰倍率 | 範例 |
|---------|---------|------|
| ≤ 15 分鐘（同區內） | × 1.3 | 15 → 20 |
| 16-25 分鐘（鄰近區） | × 1.5 | 20 → 30 |
| 26-35 分鐘（中距離） | × 1.6 | 30 → 48 |
| ≥ 36 分鐘（跨區長距離） | × 1.7 | 40 → 68 |

### 3.7 其他時間參數

| 參數 | 時間 | 說明 |
|------|------|------|
| 客人出關時間 | 30 - 60 分鐘 | 落地到出關上車，不分國際/國內 |
| 機場等候推薦範圍 | 司機到機場 ± 15 分鐘內落地 | 確保等候在可接受範圍內 |
| 送機緩衝時間（同區） | 60 分鐘（× 尖峰倍率） | 同次生活圈內接→送切換 |
| 送機緩衝時間（鄰近區） | 75 分鐘（× 尖峰倍率） | 跨次生活圈但相鄰 |
| 送機緩衝時間（跨區） | 90 分鐘（× 尖峰倍率） | 跨兩個以上次生活圈 |

---

## 四、核心計算邏輯

### 4.1 情境零：司機目前無已接訂單（新增）

**適用情境**：新進司機、或司機完成所有排班準備接新的一天訂單時。

**邏輯**：
1. 系統不以「司機位置」為錨點（因為司機當下位置未必是下一單起點）
2. 直接從接單大廳中，依時間順序列出**未來 3 小時內**可執行的單
3. 按「時間最近的單」排序，讓司機自行選擇起始單
4. 司機選定起始單後，自動進入情境一或情境二的邏輯推薦後續搭配

### 4.2 情境一：司機有一張送機單，推薦可銜接的接機單

**已知**：
```
送機單出發時間 = T_depart（例：14:00）
出發地 = 雙北某次生活圈
目的地 = 桃園機場
```

**計算**：
```
判斷 T_depart 是否在尖峰時段
行車時間 = 查「各區→機場」表 × (尖峰倍率 或 1)
司機到達機場時間 T_arrive = T_depart + 行車時間
  例：14:00 + 50分 = 14:50
```

**推薦範圍**：
```
接機單的航班落地時間 T_land 需滿足：
  T_arrive - 30分鐘 ≤ T_land ≤ T_arrive + 15分鐘
  例：14:20 ≤ T_land ≤ 15:05
```

**解釋**：
- 下限 `T_arrive - 30 分鐘`：客人最快 30 分鐘出關，確保司機到機場時客人還沒出來
- 上限 `T_arrive + 15 分鐘`：客人若落地晚於司機 15 分鐘以上，加上出關 30-60 分鐘，司機至少要等 45-75 分鐘，超出可接受範圍

**額外條件**：
- 接機單的目的地機場必須跟送機單的目的地機場相同
- **同機場不同航廈視為可銜接**（如桃機 T1 ↔ T2，司機可接駁）
- **不同機場禁止銜接**（如桃機接機後不推薦松機的送機單）

### 4.3 情境二：司機有一張接機單，推薦可銜接的送機單

**已知**：
```
接機單的航班落地時間 = T_land（例：15:00）
接機目的地 = 雙北次生活圈 A（例：板橋土城）
```

**計算**：
```
客人出關上車時間 T_pickup = T_land + 45 分鐘（取中間值）
  例：15:00 + 45分 = 15:45

判斷 T_pickup 出發時段是否為尖峰
從機場到接機目的地 A 的行車時間 t1 = 查「各區→機場」表 × (尖峰倍率 或 1)
到達接機目的地時間 T_dest = T_pickup + t1
  例：15:45 + 75分（尖峰）= 17:00
```

**推薦送機單 B 時，還需計算**：
```
接機目的地 A → 送機上車點 B 的行車時間 t2 = 查「次生活圈對照表」× (尖峰倍率 或 1)

送機緩衝 = 依 A 與 B 的區域關係決定：
  - A 與 B 同次生活圈 → 60 分鐘 × 尖峰倍率
  - A 與 B 相鄰次生活圈 → 75 分鐘 × 尖峰倍率
  - A 與 B 跨區（非相鄰）→ 90 分鐘 × 尖峰倍率

司機可接送機的最早出發時間 T_next = T_dest + 送機緩衝 + t2
  例（A=板橋土城、B=永和中和，相鄰）：
    送機緩衝 = 75分 × 1.6（假設尖峰）= 120分
    t2（板橋土城→永和中和）= 20分 × 1.5 = 30分
    T_next = 17:00 + 120 + 30 = 19:30... 等等，這樣太晚

    修正：T_next = T_dest + t2 + 緩衝
    = 17:00 + 30 + 75 × 1.5 = 17:00 + 30 + 113 = 19:23
```

**重要修正邏輯**：緩衝時間應該發生在「司機抵達送機上車點之後、客人上車之前」，不是疊加兩次。

**正確公式**：
```
T_driver_arrive_at_pickup = T_dest + t2（司機抵達送機上車點的時間）
T_next (送機客人上車時間) = T_driver_arrive_at_pickup + 緩衝時間
```

**推薦範圍**：
```
送機單的出發時間 T_send 需滿足：
  T_next ≤ T_send ≤ T_next + 60 分鐘
```

**額外條件**：
- 送機單的目的地機場可以是任一機場（不限定與接機機場相同）
- 送機單上車點所在的次生活圈必須有記錄在對照表中

### 4.4 情境三：多單銜接（送→接→送→接→…）

系統遞迴計算，最多三套共 6 單：

```
第一套：[送機A] → 到機場 → [接機B]（情境一邏輯）
第二套：[接機B] → 到目的地 → [送機C]（情境二邏輯）
        [送機C] → 到機場 → [接機D]（情境一邏輯）
第三套：[接機D] → 到目的地 → [送機E]（情境二邏輯）
        [送機E] → 到機場 → [接機F]（情境一邏輯）
```

### 4.5 情境四：長途單銜接（新增）

**適用情境**：司機承接了跨縣市的長途訂單（如台南→桃機、高雄→桃機）。

**邏輯**：
1. 計算司機抵達機場時間 T_arrive（使用 3.5 長途時間表）
2. 推薦回程方向的訂單，**從距離機場最遠的縣市開始排序**
3. 假設司機從機場出發，計算抵達各縣市的時間 T_return
4. 符合「T_return ≤ 送機單出發時間 - 30 分鐘緩衝」的單即可推薦

**範例**：
```
司機 06:00 從高雄送客人到桃機，車程 5 小時
司機 11:00 到達桃機
系統推薦 12:00 之後往南的送機單：
  - 優先：屏東、高雄出發的送機單
  - 次選：台南、嘉義出發的送機單
  - 最後：雲林、彰化出發的送機單
司機可自行選擇是否為了更遠的單（價格較高）或就近的單（能儘早收工）
```

**額外條件**：
- 長途單的時間預估不套用尖峰倍率（因高速公路為主）
- 推薦時在卡片上顯示「預計抵達時間」、「距離下一單空檔」供司機判斷

### 4.6 情境五：空車順路單推薦（新增）

**適用情境**：司機完成一單後，下一個「成套銜接」的單還有一段空檔，但空檔期間剛好有順路的單可以接。

**範例**：
```
司機 14:00 送機（板橋土城→桃機），14:50 到達桃機
下一個成套接機單要 19:00 才有（空檔約 4 小時）
但接單大廳裡 16:00 有一張「板橋土城→桃機」的送機單
司機可以空車從桃機開回板橋土城（40 分鐘），時間上來得及
```

**推薦條件**：
1. 空車回程時間 ≤ 60 分鐘（避免推薦過遠的單）
2. 司機抵達下一單上車點後，距離下一單出發時間 ≥ 30 分鐘緩衝
3. 此空車單完成後，不能與其他已排訂單衝突

**UI 呈現**：
- **獨立區塊**，標籤為「**空車順路單**」
- 排序在「成套推薦」之後
- 卡片上明確標示「空車回程約 X 分鐘」、「預計 XX:XX 抵達上車點」

---

## 五、演算法流程

**輸入**：司機的已接訂單列表 + 接單大廳所有可接訂單

**Step 1**：判斷司機狀態
- 無已接訂單 → 進入情境零
- 有已接訂單 → 取最近一張訂單作為起點

**Step 2**：判斷起點訂單類型
- 送機 → 進入情境一
- 接機 → 進入情境二
- 長途單（跨縣市） → 進入情境四

**Step 3**：從接單大廳篩選符合條件的訂單
- **時間範圍**：依情境計算
- **機場一致性**：情境一要求同機場
- **車型相容**：司機車型可執行該訂單（見 5.1）
- **疲勞限制**：司機當日累計 ≤ 6 單
- **時間衝突**：不與司機現有訂單時間重疊（含 30 分鐘緩衝）

**Step 4**：排序並取前 3-5 筆
- 成套推薦：按「銜接緊密度」排序（等待時間最短者優先）
- 長途推薦：按「距離」排序（最遠者優先）

**Step 5**：遞迴推薦
- 若司機選了某筆推薦，系統繼續推薦下一單
- 重複 Step 2-4，直到三套搭配完成或接單大廳無合適單

**Step 6**：同時檢查是否有「空車順路單」
- 獨立於主推薦邏輯，額外推薦

**輸出**：推薦組合列表，每組包含：
- 訂單資訊（時間、起終點、金額）
- 預估銜接時間（「預計 15:30 到桃機，此單 15:00 落地，等候約 30 分鐘」）
- 銜接緊密度標籤（見 6.1、6.2）

### 5.1 車型相容規則

| 司機車型 | 可接訂單車型 | 備註 |
|---------|------------|------|
| 5 人座轎車 | 5 人座 | - |
| 7 人座 MPV | 5 人座、7 人座 | 5 人座客人坐 7 人座按 7 人座費率 |
| 9 人座商旅 | 5 人座、7 人座、9 人座 | 計費基準同上 |

> **備註**：跨車型承接的計費規則需在 PRD 中明確定義，避免司機與派單方糾紛。

---

## 六、銜接緊密度標籤

### 6.1 送機 → 接機

| 標籤 | 條件 | 說明 |
|------|------|------|
| 幾乎無縫 | 司機到機場時，客人預計 0-30 分鐘內出關 | 幾乎不用等 |
| 需等候 | 司機到機場後需等 30-60 分鐘 | 可以接受 |
| 時間較趕 | 客人可能比司機早出關 | 提醒司機可能要加快 |

### 6.2 接機 → 送機

| 標籤 | 條件 | 說明 |
|------|------|------|
| 時間充裕 | 緩衝時間 ≥ 90 分鐘 | 充裕 |
| 時間合理 | 緩衝時間 60-90 分鐘 | 正常 |
| 時間較趕 | 緩衝時間 < 60 分鐘 | 提醒送機有時間壓力，不能遲到 |

> 注意：「緩衝時間」指司機抵達送機上車點後到客人上車的時間，不含 t2（跨區移動時間）。

---

## 七、司機端 UI 設計

### 7.1 智慧排單按鈕

在司機儀表板（接單大廳上方或旁邊）放一個「**智慧排單**」按鈕。按鈕旁顯示司機當日剩餘可接單數（如：「今日剩餘 4 單」）。

### 7.2 推薦結果頁面

```
┌─────────────────────────────────────────┐
│ 智慧排單推薦                              │
│ 今日剩餘可接：4 單                        │
│                                          │
│ 你目前的行程：                             │
│ ┌──────────────────────────────────────┐ │
│ │ 14:00 送機  板橋 → 桃機  $1,400      │ │
│ │ 預計 14:50 到達桃機                   │ │
│ └──────────────────────────────────────┘ │
│              ↓ 到機場後                   │
│ 推薦接機（3 筆）：                        │
│ ┌──────────────────────────────────────┐ │
│ │ 14:40 落地  桃機T1 → 中和  $1,000    │ │
│ │ [幾乎無縫] 你 14:50 到，客人預計       │ │
│ │ 15:10-15:40 出關，等候約 20-50 分鐘    │ │
│ │                        [接這單]       │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ 15:00 落地  桃機T2 → 土城  $900      │ │
│ │ [幾乎無縫] 客人預計 15:30-16:00 出關   │ │
│ │ 等候約 40-70 分鐘                     │ │
│ │                        [接這單]       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ 如果你接了「桃機→中和 $1,000」，          │
│ 還可以再接這些送機單：                     │
│ ┌──────────────────────────────────────┐ │
│ │ 18:00 送機  板橋 → 桃機  $1,200      │ │
│ │ [時間合理] 預計 17:00 到中和           │ │
│ │ 緩衝約 60 分鐘                        │ │
│ │                        [加入排單]      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ 空車順路單：                              │
│ ┌──────────────────────────────────────┐ │
│ │ 16:00 送機  板橋 → 桃機  $1,300      │ │
│ │ 空車回程約 40 分鐘                    │ │
│ │ 預計 15:30 抵達板橋                   │ │
│ │                        [接這單]       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ 排單預覽：                                │
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
│        [確認排單]    [返回]                │
└─────────────────────────────────────────┘
```

### 7.3 排單預覽（時間軸）

確認排單前，顯示完整的時間軸讓司機一目瞭然：
- 每一單的出發時間、預估到達時間
- 銜接之間的等候/緩衝時間
- 尖峰/離峰標記
- 總收入預估

### 7.4 異常狀態處理

#### 7.4.1 接單大廳無合適單
顯示空狀態插圖 + 文字：「目前接單大廳沒有合適的銜接單，稍後再試看看」。

#### 7.4.2 司機當日已達 6 單上限
顯示：「你今天已經接了 6 單，為了行車安全，智慧排單暫停推薦。明日 04:00 後重置。」按鈕顯示為灰階。

#### 7.4.3 航班延誤警示
當司機已接的接機單發生航班延誤，且延誤影響到後續排單時：
- 該訂單卡片**閃爍紅色邊框**
- 推送系統訊息至司機 LINE / 平台通知中心
- 提供「重新排單」按鈕

---

## 八、航班 API 整合（MVP 即接）

### 8.1 選型建議

| 服務 | 資料來源 | 價格 | 優點 | 缺點 |
|------|---------|------|------|------|
| AviationStack | 全球 | 免費版 100 次/月 | 國際航班完整 | 免費版有延遲 |
| FlightAware AeroAPI | 全球 | 按次計費 | 資料即時 | 成本較高 |
| **民航局開放資料平台** | **台灣** | **免費** | **桃機/松機/小港即時航班** | **僅限台灣機場** |

**建議**：MVP 階段優先使用**民航局開放資料平台**（免費、涵蓋台灣所有機場），未來如有需要再補全球 API。

### 8.2 API 串接時機

1. **司機承接接機單時**：查詢該航班當前狀態，確認預計落地時間
2. **每 30 分鐘定期更新**：更新所有未完成的接機單航班狀態
3. **司機進入智慧排單頁面時**：即時查詢，確保推薦計算使用最新資料

### 8.3 異常推送

當航班狀態變更（延誤、取消、提早）：
- **延誤 ≥ 15 分鐘**：推送通知給司機，標示該訂單需注意
- **延誤影響下一單銜接**：推送警告，閃爍訂單卡片邊框，建議司機檢視排單
- **航班取消**：立即通知司機與派單方

---

## 九、技術實作

### 9.1 尖峰判斷函數

```typescript
function isPeakHour(time: Date): boolean {
  const totalMinutes = time.getHours() * 60 + time.getMinutes();

  // 早上尖峰 06:30-09:00
  if (totalMinutes >= 390 && totalMinutes <= 540) return true;
  // 下午尖峰 16:00-19:00
  if (totalMinutes >= 960 && totalMinutes <= 1140) return true;

  return false;
}
```

### 9.2 尖峰倍率函數

```typescript
function getPeakMultiplier(offPeakMinutes: number): number {
  if (offPeakMinutes <= 15) return 1.3;
  if (offPeakMinutes <= 25) return 1.5;
  if (offPeakMinutes <= 35) return 1.6;
  return 1.7;
}

function applyPeakMultiplier(offPeakMinutes: number, isPeak: boolean): number {
  if (!isPeak) return offPeakMinutes;
  return Math.round(offPeakMinutes * getPeakMultiplier(offPeakMinutes));
}
```

### 9.3 行車時間查詢函數

```typescript
// 雙北次生活圈對照表
const SUBREGION_TRAVEL_TIMES: Record<string, Record<string, number>> = {
  'TPE-01': { 'TPE-01': 15, 'TPE-02': 20, /* ... 省略 ... */ },
  'TPE-02': { 'TPE-01': 20, 'TPE-02': 15, /* ... 省略 ... */ },
  // ... 其他 11 區
};

// 各區到機場的時間表
const SUBREGION_TO_AIRPORT: Record<string, Record<string, number>> = {
  'TPE-01': { 'TPE': 50, 'TSA': 15 },
  'TPE-06': { 'TPE': 40, 'TSA': 30 },
  // ... 其他 11 區
};

// 長途縣市到桃機
const CITY_TO_TPE: Record<string, number> = {
  'Keelung': 90,
  'Taoyuan': 30,
  'Hsinchu': 80,
  'Taichung': 150,
  'Tainan': 270,
  'Kaohsiung': 300,
  // ... 其他縣市
};

function getTravelMinutes(
  from: string,
  to: string,
  departTime: Date
): number {
  const isPeak = isPeakHour(departTime);

  // 雙北內部
  if (isSubregion(from) && isSubregion(to)) {
    const offPeak = SUBREGION_TRAVEL_TIMES[from]?.[to] ?? 60;
    return applyPeakMultiplier(offPeak, isPeak);
  }

  // 雙北 ↔ 機場
  if (isSubregion(from) && isAirport(to)) {
    const offPeak = SUBREGION_TO_AIRPORT[from]?.[to] ?? 60;
    return applyPeakMultiplier(offPeak, isPeak);
  }

  // 長途（跨縣市）：不套用尖峰倍率
  if (isCity(from) && isAirport(to)) {
    return CITY_TO_TPE[from] ?? 180;
  }

  return 60; // 預設值
}
```

### 9.4 推薦篩選函數（情境一：送機→接機）

```typescript
async function recommendPickupAfterDropoff(
  driver: Driver,
  dropoffOrder: Order,
  availableOrders: Order[]
): Promise<RecommendedOrder[]> {
  // 計算司機到達機場時間
  const travelMin = getTravelMinutes(
    dropoffOrder.fromRegion,
    dropoffOrder.airport,
    dropoffOrder.departTime
  );
  const arriveAtAirport = addMinutes(dropoffOrder.departTime, travelMin);

  // 篩選：航班落地時間在 arriveAtAirport-30分 到 arriveAtAirport+15分
  const minLanding = addMinutes(arriveAtAirport, -30);
  const maxLanding = addMinutes(arriveAtAirport, 15);

  return availableOrders
    .filter(order =>
      order.type === 'pickup' &&
      isSameAirportGroup(order.airport, dropoffOrder.airport) && // 同機場（含不同航廈）
      order.landingTime >= minLanding &&
      order.landingTime <= maxLanding &&
      isVehicleCompatible(driver.vehicleType, order.requiredVehicleType) &&
      !hasTimeConflict(order, driver.acceptedOrders) &&
      !hasReachedDailyLimit(driver)
    )
    .map(order => ({
      ...order,
      waitMinutes: calculateWaitTime(arriveAtAirport, order.landingTime),
      tightness: calculateDropoffToPickupTightness(arriveAtAirport, order.landingTime),
    }))
    .sort((a, b) => a.waitMinutes - b.waitMinutes)
    .slice(0, 5);
}
```

### 9.5 推薦篩選函數（情境二：接機→送機）

```typescript
async function recommendDropoffAfterPickup(
  driver: Driver,
  pickupOrder: Order,
  availableOrders: Order[]
): Promise<RecommendedOrder[]> {
  // 客人出關時間
  const pickupTime = addMinutes(pickupOrder.landingTime, 45);

  // 司機到達接機目的地時間
  const t1 = getTravelMinutes(
    pickupOrder.airport,
    pickupOrder.toRegion,
    pickupTime
  );
  const arriveAtDest = addMinutes(pickupTime, t1);

  return availableOrders
    .filter(order => {
      if (order.type !== 'dropoff') return false;
      if (!isVehicleCompatible(driver.vehicleType, order.requiredVehicleType)) return false;
      if (hasTimeConflict(order, driver.acceptedOrders)) return false;
      if (hasReachedDailyLimit(driver)) return false;

      // 計算 t2（接機目的地 → 送機上車點）
      const t2 = getTravelMinutes(pickupOrder.toRegion, order.fromRegion, arriveAtDest);
      const driverArriveAtPickup = addMinutes(arriveAtDest, t2);

      // 依區域關係計算緩衝時間
      const buffer = getBufferMinutes(pickupOrder.toRegion, order.fromRegion, driverArriveAtPickup);
      const earliestDeparture = addMinutes(driverArriveAtPickup, buffer);
      const latestDeparture = addMinutes(earliestDeparture, 60);

      return order.departTime >= earliestDeparture &&
             order.departTime <= latestDeparture;
    })
    .map(order => {
      const t2 = getTravelMinutes(pickupOrder.toRegion, order.fromRegion, arriveAtDest);
      const driverArriveAtPickup = addMinutes(arriveAtDest, t2);
      const bufferMin = diffMinutes(order.departTime, driverArriveAtPickup);

      return {
        ...order,
        bufferMinutes: bufferMin,
        tightness: calculatePickupToDropoffTightness(bufferMin),
      };
    })
    .sort((a, b) => a.bufferMinutes - b.bufferMinutes)
    .slice(0, 5);
}

function getBufferMinutes(regionA: string, regionB: string, time: Date): number {
  const isPeak = isPeakHour(time);
  let baseBuffer: number;

  if (regionA === regionB) {
    baseBuffer = 60; // 同次生活圈
  } else if (isAdjacentRegion(regionA, regionB)) {
    baseBuffer = 75; // 相鄰
  } else {
    baseBuffer = 90; // 跨區
  }

  return applyPeakMultiplier(baseBuffer, isPeak);
}
```

---

## 十、資料庫設計

### 10.1 Order model 擴充

```prisma
model Order {
  // ... 現有欄位 ...
  landingTime       DateTime?   // 航班落地時間（接機單用）
  departTime        DateTime?   // 出發時間（送機單用）
  fromRegion        String?     // 出發地所在次生活圈代號（TPE-01 ~ TPE-13 或縣市代號）
  toRegion          String?     // 目的地所在次生活圈代號
  airport           String?     // 機場代碼（TPE / TSA / KHH / RMQ）
  terminal          String?     // 航廈（T1 / T2）
  flightNumber      String?     // 航班號（用於航班 API 查詢）
  requiredVehicleType String    // 5seater / 7seater / 9seater

  // 司機實際執行時間記錄（用於優化演算法）
  actualDepartTime   DateTime?  // 實際出發時間
  actualArriveTime   DateTime?  // 實際抵達時間
  actualBoardTime    DateTime?  // 客人實際上車時間
  actualAlightTime   DateTime?  // 客人實際下車時間
}
```

### 10.2 ScheduleGroup model（排單組合）

```prisma
model ScheduleGroup {
  id                 String   @id @default(cuid())
  driverId           String
  driver             Driver   @relation(fields: [driverId], references: [id])
  orders             ScheduleGroupOrder[]
  totalIncome        Int      // 總收入預估
  estimatedStartTime DateTime // 整組排單的起始時間
  estimatedEndTime   DateTime // 整組排單的結束時間
  totalDriveMinutes  Int      // 總行車時間（評估疲勞度）
  totalWaitMinutes   Int      // 總等候時間
  status             String   @default("draft") // draft / confirmed / completed
  createdAt          DateTime @default(now())
}

model ScheduleGroupOrder {
  id                 String        @id @default(cuid())
  groupId            String
  group              ScheduleGroup @relation(fields: [groupId], references: [id])
  orderId            String
  order              Order         @relation(fields: [orderId], references: [id])
  sequence           Int           // 排序（1, 2, 3...）
  estimatedArrival   DateTime      // 該訂單預估抵達時間
  bufferToNextOrder  Int?          // 到下一單的緩衝時間（分鐘）
}
```

### 10.3 DriverDailyStats model（每日單數統計）

```prisma
model DriverDailyStats {
  id          String   @id @default(cuid())
  driverId    String
  driver      Driver   @relation(fields: [driverId], references: [id])
  date        DateTime @db.Date // 以日為單位（每日 04:00 重置）
  orderCount  Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([driverId, date])
}
```

---

## 十一、API 端點

### 11.1 POST /api/schedule/recommend

根據司機狀態與已接訂單，推薦可銜接的訂單。

**Request**：
```json
{
  "startOrderId": "clxx...",   // 可選，起始訂單 ID
  "filters": {                  // 可選，額外篩選條件
    "excludeAirports": ["KHH"], // 排除特定機場
    "minPrice": 800              // 最低金額
  }
}
```

**Response**：
```json
{
  "success": true,
  "data": {
    "driverStatus": {
      "dailyOrderCount": 2,
      "dailyOrderLimit": 6,
      "canAcceptMore": true
    },
    "currentOrder": { /* ... */ },
    "arriveTime": "2026-04-17T14:50:00+08:00",
    "mainRecommendations": [
      {
        "order": { /* ... */ },
        "waitMinutes": 30,
        "tightness": "perfect",
        "tightnessLabel": "幾乎無縫",
        "explanation": "客人預計 15:10-15:40 出關"
      }
    ],
    "standbyRecommendations": [  // 空車順路單
      {
        "order": { /* ... */ },
        "emptyDriveMinutes": 40,
        "explanation": "空車回程約 40 分鐘，預計 15:30 抵達板橋"
      }
    ],
    "nextRecommendations": [ /* 接了第一筆後的後續推薦 */ ]
  }
}
```

### 11.2 POST /api/schedule/confirm

確認排單組合。

**Request**：
```json
{
  "orderIds": ["order1", "order2", "order3"]
}
```

**Response**：
```json
{
  "success": true,
  "data": {
    "groupId": "clxx...",
    "totalIncome": 3600,
    "estimatedStartTime": "2026-04-17T14:00:00+08:00",
    "estimatedEndTime": "2026-04-17T19:30:00+08:00",
    "message": "排單確認完成，共 3 筆行程"
    }
}
```

### 11.3 POST /api/flight/query

查詢航班狀態（整合民航局開放資料）。

**Request**：
```json
{
  "flightNumber": "CI123",
  "date": "2026-04-17"
}
```

**Response**：
```json
{
  "success": true,
  "data": {
    "flightNumber": "CI123",
    "scheduledLanding": "2026-04-17T15:00:00+08:00",
    "estimatedLanding": "2026-04-17T15:30:00+08:00",
    "status": "delayed",
    "delayMinutes": 30
  }
}
```

---

## 十二、取消與異常處理

### 12.1 訂單承接後不可取消機制

- 行程由司機承接之後，**派單方無法取消**該訂單
- 派單方只能取消「**尚未被司機承接**」的訂單
- 已承接的訂單如需特殊處理，由派單方與司機私下協調

### 12.2 航班取消 / 客人 No-Show

- 由派單方與司機私下討論處理
- 平台最多將「媒合行程的手續費」退回給司機
- 平台不介入實質賠償或糾紛仲裁

### 12.3 排單中的訂單被其他司機搶先

理論上不會發生（訂單一旦被承接就從接單大廳移除），但為保險起見：
- 若司機按下「加入排單」時該單已被其他司機承接，顯示「此單已被他人承接，為你重新推薦」並自動刷新推薦列表

---

## 十三、開發優先順序

1. **時間參數資料建置**
   - 雙北次生活圈對照表
   - 各區→機場對照表
   - 全台長途時間表
   - 尖峰倍率邏輯

2. **核心計算函數**
   - `isPeakHour`
   - `getTravelMinutes`
   - `applyPeakMultiplier`
   - `getBufferMinutes`

3. **情境零：無已接單的基礎推薦**（優先做，給新司機用）

4. **情境一：送機→接機**

5. **情境二：接機→送機**

6. **司機端 UI（含異常狀態、空狀態）**

7. **情境三：多單遞迴推薦**

8. **情境四：長途單銜接**

9. **情境五：空車順路單推薦**

10. **排單預覽時間軸**

11. **ScheduleGroup 資料模型與 API**

12. **航班 API 整合（民航局開放資料）**

13. **疲勞限制（DriverDailyStats）**

14. **司機實際執行時間記錄與演算法優化**

---

## 十四、未來擴充

### 14.1 短期（3-6 個月）

- **接入 Google Maps Distance Matrix API**：取代固定時間估算，提升準確度
- **增加中部、南部次生活圈精細化**：將縣市粗略切分改為次生活圈
- **司機歷史資料優化推薦**：常跑的路線優先推薦
- **司機常駐地設定**：回家方向的單額外加分

### 14.2 中期（6-12 個月）

- **即時路況整合**：結合高速公路 1968、Google 即時路況
- **天氣因素**：颱風、豪雨時自動延長車程預估
- **多車隊協調**：小隊互助機制下的跨司機智慧排單

### 14.3 長期

- **機器學習優化**：根據司機實際執行時間（出發/抵達/客上/客下）與預估時間的差距，自動校正時間參數表
- **需求預測**：預測未來時段訂單熱點，提前提醒司機前往高需求區域

---

## 附錄 A：次生活圈相鄰關係表

用於判斷「送機緩衝時間」的區域關係。

```typescript
const ADJACENT_REGIONS: Record<string, string[]> = {
  'TPE-01': ['TPE-02', 'TPE-03', 'TPE-04', 'TPE-05', 'TPE-08'],
  'TPE-02': ['TPE-01', 'TPE-03'],
  'TPE-03': ['TPE-01', 'TPE-02', 'TPE-05'],
  'TPE-04': ['TPE-01', 'TPE-08', 'TPE-11'],
  'TPE-05': ['TPE-01', 'TPE-03', 'TPE-07', 'TPE-10'],
  'TPE-06': ['TPE-07', 'TPE-09', 'TPE-13'],
  'TPE-07': ['TPE-01', 'TPE-05', 'TPE-06', 'TPE-08'],
  'TPE-08': ['TPE-01', 'TPE-04', 'TPE-07', 'TPE-09'],
  'TPE-09': ['TPE-06', 'TPE-08', 'TPE-12'],
  'TPE-10': ['TPE-05', 'TPE-07'],
  'TPE-11': ['TPE-04'],
  'TPE-12': ['TPE-09'],
  'TPE-13': ['TPE-06'],
};

function isAdjacentRegion(regionA: string, regionB: string): boolean {
  return ADJACENT_REGIONS[regionA]?.includes(regionB) ?? false;
}
```

> **注意**：此表為初版判斷，Brian 請以實際業務經驗校正。

---

## 附錄 B：校正清單（Brian 需確認的項目）

在 MVP 上線前，請逐項確認以下資料：

- [ ] 3.3 雙北次生活圈內部行車時間表（特別是林口、三峽鶯歌的 2 列 2 行）
- [ ] 3.4 雙北各區 → 機場行車時間表（特別是淡水、林口、三峽鶯歌到各機場的時間）
- [ ] 3.5 全台長途行車時間表（離峰時間以實務經驗校正）
- [ ] 5.1 車型相容規則的計費基準（跨車型承接怎麼算錢）
- [ ] 附錄 A 次生活圈相鄰關係表
- [ ] 民航局開放資料 API 實際測試（確認可用性與穩定性）

---

**文件版本**：v2.0
**更新日期**：2026-04-17
**下次修訂時機**：MVP 上線後 1 個月，依司機實際執行時間回饋調整
