# 真實案例對照 (Real Examples)

從真實 LINE 派單訊息中精選的案例，附上 AI 應該產出的解析結果與 rewrite_suggestion。

> 這份檔案同時是 **訓練範例** 和 **回歸測試集**。每次 skill 修改後，可以用這些案例驗證解析品質。

---

## 案例 1：標準格式（accepted）

### 輸入
```
4/19 22:10 接機 大安區信義路四段 小車 CI920 850
```

### 預期輸出
```json
{
  "parse_status": "accepted",
  "overall_confidence": 0.97,
  "fields": {
    "date": { "value": "2026-04-19", "confidence": 1.0, "raw": "4/19" },
    "time": { "value": "22:10", "confidence": 1.0, "raw": "22:10" },
    "type": { "value": "pickup", "confidence": 1.0, "raw": "接機" },
    "origin": { "value": "TPE", "confidence": 0.9, "raw": "(隱含)" },
    "destination": { "value": "大安區信義路四段", "confidence": 1.0, "raw": "大安區信義路四段" },
    "price": { "value": 850, "confidence": 1.0, "raw": "850" },
    "vehicle_type": { "value": "small", "confidence": 1.0, "raw": "小車" },
    "flight_number": { "value": "CI920", "confidence": 1.0, "raw": "CI920" }
  },
  "rewrite_suggestion": null
}
```

---

## 案例 2：極簡格式（rejected）

### 輸入
```
0:05三重送
```

### 預期輸出
```json
{
  "parse_status": "rejected",
  "overall_confidence": 0.3,
  "fields": {
    "date": { "value": null, "confidence": 0.0, "raw": null },
    "time": { "value": "00:05", "confidence": 1.0, "raw": "0:05" },
    "type": { "value": "dropoff", "confidence": 0.85, "raw": "送" },
    "origin": { "value": "三重區", "confidence": 0.9, "raw": "三重" },
    "destination": { "value": "TPE", "confidence": 0.85, "raw": "(隱含)" },
    "price": { "value": null, "confidence": 0.0, "raw": null }
  },
  "rejection_reasons": ["missing_date", "missing_price"],
  "rewrite_suggestion": "⚠️ 缺日期、缺價格\n✏️ 建議改寫：`4/19 00:05 送機 三重區 700`\n📖 為什麼：「送」字預設終點是桃園機場，但日期和價格不能省"
}
```

---

## 案例 3：群組標題繼承（嚴格模式 → rejected，整批改寫）

### 輸入
```
4/19 桃機-接
任意R-小車/大車皆可
20:10 接-彰化社頭 $1800
4/20(一)桃機-接
任意R-小車/大車皆可
00:55 接-台中西屯 $1600
```

### 預期輸出（嚴格模式）
產生 2 筆 `rejected` 訂單，理由都是 `missing_date_in_order_block`，並提供整批 rewrite_suggestion：

```json
{
  "rejected_messages": [
    {
      "raw": "20:10 接-彰化社頭 $1800",
      "reasons": ["missing_date_in_order_block"],
      "rewrite_suggestion": "⚠️ 整批訂單建議改寫成：\n`4/19 20:10 接機 彰化社頭 1800`\n`4/20 00:55 接機 台中西屯 1600`\n📖 為什麼：標題日期不會被當作訂單欄位，每筆訂單需獨立明寫日期"
    },
    {
      "raw": "00:55 接-台中西屯 $1600",
      "reasons": ["missing_date_in_order_block"],
      "rewrite_suggestion": "（同上）"
    }
  ]
}
```

### 預期輸出（寬鬆模式）
2 筆 `needs_review` 訂單，從標題繼承日期但 confidence 降為 0.6：

```json
{
  "orders": [
    {
      "parse_status": "needs_review",
      "overall_confidence": 0.7,
      "fields": {
        "date": { "value": "2026-04-19", "confidence": 0.6, "raw": "標題:4/19" },
        "time": { "value": "20:10", "confidence": 1.0 },
        "type": { "value": "pickup", "confidence": 1.0 },
        "origin": { "value": "TPE", "confidence": 0.85 },
        "destination": { "value": "彰化社頭", "confidence": 0.95 },
        "price": { "value": 1800, "confidence": 1.0 }
      },
      "rewrite_suggestion": "⚠️ 日期是從標題推斷的，請確認是否為 4/19\n✏️ 下次建議直接寫：`4/19 20:10 接機 彰化社頭 1800`"
    }
  ]
}
```

---

## 案例 4：套裝訂單（強制拆成兩筆 + 教育）

### 輸入
```
=1-2==一套不拆
03:30 台中東區-送 (進口車) $1800
18:45 接-台中西屯 (進口車) $1800
```

### 預期輸出
**強制拆成 2 筆獨立訂單**（平台不接受套裝），都標 `bundle_split_warning: true`：

```json
{
  "orders": [
    {
      "parse_status": "needs_review",
      "fields": {
        "date": { "value": null, "confidence": 0.0 },
        "time": { "value": "03:30", "confidence": 1.0 },
        "type": { "value": "dropoff", "confidence": 1.0, "raw": "送" },
        "origin": { "value": "台中東區", "confidence": 0.95 },
        "destination": { "value": "TPE", "confidence": 0.85 },
        "price": { "value": 1800, "confidence": 1.0 },
        "vehicle_type": { "value": "imported", "confidence": 1.0, "raw": "進口車" }
      },
      "bundle_split_warning": true,
      "original_bundle_ref": "=1-2=",
      "rewrite_suggestion": "⚠️ 偵測到套裝單寫法（「一套不拆」）\n✏️ 已將這 2 筆訂單自動拆分為獨立訂單\n📖 為什麼：平台不接受套裝派單（成本高、智慧排程更優）\n   如希望司機接整套，建議：\n   1. 把總價平均分配到每筆訂單\n   2. 對其中任一筆使用「一鍵加價」吸引司機"
    },
    {
      "parse_status": "needs_review",
      "fields": { "...": "..." },
      "bundle_split_warning": true,
      "original_bundle_ref": "=1-2="
    }
  ]
}
```

---

## 案例 5：訊息時間戳剝離

### 輸入
```
17:21 ᴛᴀ是小ㄚ迪 明天小車接機，CI920，4/19 接機，22:10抵達，1人1行李，台北市大安區信義路四段，$850（小車）
（如超過23:00搭車+$100深夜自取）
```

### 預期輸出

**剝離訊息時間戳**：`17:21` 是 LINE 訊息發送時間，存到 metadata。  
**處理「明天 4/19」**：明確日期 4/19 優先，相對詞「明天」忽略。

```json
{
  "parse_metadata": {
    "message_sent_at": "17:21",
    "dispatcher_id": "ᴛᴀ是小ㄚ迪"
  },
  "orders": [{
    "parse_status": "accepted",
    "overall_confidence": 0.92,
    "fields": {
      "date": { "value": "2026-04-19", "confidence": 1.0, "raw": "4/19" },
      "time": { "value": "22:10", "confidence": 1.0, "raw": "22:10抵達" },
      "type": { "value": "pickup", "confidence": 1.0, "raw": "接機" },
      "origin": { "value": "TPE", "confidence": 0.9 },
      "destination": { "value": "台北市大安區信義路四段", "confidence": 1.0 },
      "price": { "value": 850, "confidence": 1.0, "raw": "$850" },
      "vehicle_type": { "value": "small", "confidence": 1.0, "raw": "小車" },
      "flight_number": { "value": "CI920", "confidence": 1.0 },
      "passenger_count": { "value": 1, "confidence": 1.0, "raw": "1人" },
      "luggage_count": { "value": 1, "confidence": 1.0, "raw": "1行李" },
      "special_requirements": { "value": ["late_night_surcharge:100:23:00"], "confidence": 1.0 }
    }
  }]
}
```

---

## 案例 6：多停點接機

### 輸入
```
A80
23:20接機JX805 
1.南港區玉成街
2.汐止區福德一路
休旅💲1000
```

### 預期輸出
```json
{
  "parse_status": "needs_review",
  "overall_confidence": 0.85,
  "fields": {
    "date": { "value": null, "confidence": 0.0 },
    "time": { "value": "23:20", "confidence": 1.0 },
    "type": { "value": "pickup", "confidence": 1.0, "raw": "接機" },
    "origin": { "value": "TPE", "confidence": 0.85 },
    "destination": { 
      "value": ["南港區玉成街", "汐止區福德一路"], 
      "confidence": 0.95,
      "raw": "1.南港區玉成街 2.汐止區福德一路"
    },
    "price": { "value": 1000, "confidence": 1.0 },
    "vehicle_type": { "value": "suv", "confidence": 1.0, "raw": "休旅" },
    "flight_number": { "value": "JX805", "confidence": 1.0 }
  },
  "multi_stop": true,
  "dispatcher_ref": "A80",
  "rejection_reasons": ["missing_date"],
  "rewrite_suggestion": "⚠️ 缺日期\n✏️ 建議改寫：`4/19 23:20 接機 南港區玉成街+汐止區福德一路 休旅 JX805 1000`\n📖 多停點訂單請用 `+` 連接，並務必明寫日期"
}
```

---

## 案例 7：重複貼單偵測

### 輸入（同則訊息在 30 分鐘內被貼 5 次）
```
[15:42] ★章章-群創租車 義宏 4/19 桃機一套 ...
[16:06] ★章章-群創租車 義宏 4/19 桃機一套 ...（同上）
[16:29] ★章章-群創租車 義宏 4/19 桃機一套 ...（同上）
[16:52] ★章章-群創租車 義宏 4/19 桃機一套 ...（同上）
[17:38] ★章章-群創租車 義宏 4/19 桃機一套 ...（同上）
```

### 預期輸出
**全部解析**（不去重），但在 metadata 標記：

```json
{
  "parse_metadata": {
    "duplicate_warning": {
      "detected": true,
      "count": 5,
      "first_seen_at": "2026-04-18T15:42:00",
      "last_seen_at": "2026-04-18T17:38:00",
      "similarity_score": 1.0,
      "dispatcher_id": "★章章-群創租車",
      "suggested_action": "merge_or_show_warning"
    }
  },
  "orders": [/* 5 組相同訂單 */]
}
```

由前端決定如何處理（合併、隱藏舊版、向派單方收費等）。

---

## 案例 8：城際接駁（非機場）

### 輸入
```
4/19。00:30 接駁趟
客四
松山區-高雄
🈯️大車 5700$
```

### 預期輸出
```json
{
  "parse_status": "accepted",
  "overall_confidence": 0.93,
  "fields": {
    "date": { "value": "2026-04-19", "confidence": 1.0, "raw": "4/19" },
    "time": { "value": "00:30", "confidence": 1.0 },
    "type": { "value": "transfer", "confidence": 1.0, "raw": "接駁趟" },
    "origin": { "value": "松山區", "confidence": 0.95 },
    "destination": { "value": "高雄", "confidence": 0.85 },
    "price": { "value": 5700, "confidence": 1.0 },
    "vehicle_type": { "value": "large", "confidence": 1.0, "raw": "大車" },
    "passenger_count": { "value": 4, "confidence": 1.0, "raw": "客四" }
  },
  "airport": null,
  "rewrite_suggestion": null
}
```

---

## 案例 9：條件式加價

### 輸入
```
$850（小車）
（如超過23:00搭車+$100深夜自取）
```

### 預期輸出
基本價 850，深夜加價 100 存為 special requirement，**不主動加總**。

```json
{
  "fields": {
    "price": { "value": 850, "confidence": 1.0, "raw": "$850" },
    "special_requirements": { 
      "value": ["late_night_surcharge:100:23:00"], 
      "confidence": 1.0,
      "raw": "（如超過23:00搭車+$100深夜自取）"
    }
  }
}
```

App 在實際派單時，會根據實際抵達時間動態計算最終價格。

---

## 案例 10：複合 Job（送 + 接 + 送）

### 輸入
```
後天4/18 大車配小
17:05接大同
+
20:00松山機場接中正
+
23:30中正送
$2300
```

派單方意圖：**同一台車整天跑這 3 趟**，總價 2300。

### 預期輸出（嚴格模式）
拆成 3 筆獨立訂單，但每筆 `bundle_intent: true`，價格分配 `null`（要求派單方在 App 上重新分配）：

```json
{
  "orders": [
    {
      "parse_status": "needs_review",
      "fields": {
        "date": { "value": "2026-04-18", "confidence": 1.0 },
        "time": { "value": "17:05", "confidence": 1.0 },
        "type": { "value": "pickup", "confidence": 0.7, "raw": "接" },
        "destination": { "value": "大同", "confidence": 0.85 },
        "price": { "value": null, "confidence": 0.0 },
        "vehicle_type": { "value": "large", "confidence": 0.8, "raw": "大車配小" }
      },
      "bundle_intent": true,
      "bundle_ref": "auto:3job:2300",
      "rewrite_suggestion": "⚠️ 整套價 $2300 無法自動拆分到個別訂單\n✏️ 請在 gogmo App 上：\n  1. 建立這 3 筆訂單，各自填寫個別價格（總和 = 2300）\n  2. 點「綁定派單」連成一套\n📖 為什麼：每筆訂單需要獨立價格，司機才能評估是否接單"
    },
    { "...": "（其他 2 筆類似）" }
  ]
}
```

---

## 測試用法

實作時可以把這 10 個案例放進測試套件：

```javascript
import testCases from './references/real-examples.md';

for (const case of testCases) {
  const result = await parseOrder(case.input);
  expect(result).toMatchObject(case.expected);
}
```

當 skill 更新後，跑一次回歸測試，確保所有案例的解析結果不退化。
