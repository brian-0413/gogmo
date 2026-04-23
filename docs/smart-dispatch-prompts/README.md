# gogmo 智慧排單開發提示詞包

## 檔案清單

```
smart-dispatch-prompts/
├── README.md                           ← 你正在看這份
├── gogmo-zones-matrix.md               ← 分區與 travel time matrix（先放進專案）
├── A-zone-infrastructure.md            ← 提示詞 A（先做）
├── B-smart-dispatch-algorithm.md       ← 提示詞 B
└── C-smart-dispatch-ui.md              ← 提示詞 C
```

## 執行順序

**必須按順序執行，每份都依賴前一份的產物。**

### Step 1：放置規格文件（5 分鐘）

把 `gogmo-zones-matrix.md` 複製到專案：
```
docs/gogmo-zones-matrix.md
```

這份文件是所有後續開發的基礎資料來源。

### Step 2：餵提示詞 A 給 Claude Code（0.5-1 天）

建立 zone 基礎建設：
- `lib/zones/types.ts`
- `lib/zones/districtMap.ts`（行政區 → zone）
- `lib/zones/matrixData.ts`（11×11 matrix）
- `lib/zones/travelTime.ts`（查詢函式）
- `lib/zones/addressToZone.ts`（地址正規化）
- Prisma 加 originZone / destinationZone 欄位

### Step 3：餵提示詞 B 給 Claude Code（1-2 天）

建立智慧排單演算法：
- `lib/matching/smartDispatch.ts`
- `lib/matching/scoreCalculator.ts`
- `lib/matching/candidateFilter.ts`
- `lib/matching/reasonTemplates.ts`
- API 端點 `GET /api/driver/orders/smart-sort`

### Step 4：餵提示詞 C 給 Claude Code（2-3 天）

建立司機端 UI：
- 改寫接單大廳（雙區顯示）
- 我的行程加「為此單找配套」按鈕
- 新增 smart-match 專頁

## 總預估時間：4-6 天

建議分散在 1-2 週內完成，避免 Claude Code 疲勞誤判。

## 關鍵原則

1. **每份提示詞都要求 Claude Code 分 Step 執行**，不要一口氣做完
2. **每個 Step 完成後跑 test，不要跳過**
3. **地址轉 Zone 是最大的坑**，Step A 的測試要寫扎實
4. **Matrix 是估算值**，上線 1 個月後要用實際數據校準

## 核心邏輯摘要

### 三層優先級

1. **配套優先**：接機配送機、送機配接機
2. **時間次之**：接機緩衝 2hr、送機緩衝 3hr
3. **距離再次之**：用 11-zone matrix 判定

### 降級策略

找不到配套時：
- B 層：同區域的同類型訂單
- C 層：有配套但較遠的訂單
- 最後：誠實顯示「無推薦」

### UI 分區

- 接單大廳：上方「配套推薦」+ 下方「其他可接」
- 我的行程：每張卡片加「為此單找配套」按鈕
- smart-match 專頁：配套推薦 / 同區 / 較遠三區
