# gogmo 車型系統重構 Spec — Phase 3：清理與防呆

> **本階段目標**：徹底清除技術債、加入防呆機制、寫入專案規範
> **風險等級**：🟢 低風險 — 純清理與規範化
> **預計時間**：30-45 分鐘
> **前置條件**：Phase 1、Phase 2 已完成且通過驗收

---

## 一、本階段任務總覽（給 Claude Code 的完整說明）

Phase 2 已完成系統切換，但仍有一些「過渡期相容程式碼」殘留。本階段把這些殘留清掉，並加入防呆機制，確保未來開發不會重蹈覆轍。

任務分為 4 部分：

| 編號 | 任務 | 風險 |
|------|------|------|
| 3.1 | 移除過渡相容程式碼 | 🟢 |
| 3.2 | 加入 ESLint 防呆規則 | 🟢 |
| 3.3 | 更新專案文件（CLAUDE.md / CURRENT_WORK.md） | 🟢 |
| 3.4 | 最終全面驗證 | 🟢 |

---

## 二、Sub-phase 3.1：移除過渡相容程式碼

### 3.1.1 清理 types/index.ts

**修改前**先讀取並顯示 `types/index.ts` 的車型相關區塊。

Phase 2 為了向下相容，可能還保留了：

```typescript
// 保留的 re-export（Phase 2 中曾留下作為過渡）
export { VehicleType } from '@/lib/vehicle'
```

**本階段要做的**：

選項 A（推薦）：**完全移除 re-export**，強制所有檔案直接 import `@/lib/vehicle`

```typescript
// 完全刪除以下幾行：
// export { VehicleType } from '@/lib/vehicle'
// export type VehicleSizeType = ...
```

刪除後執行：

```bash
npx tsc --noEmit
```

如果有編譯錯誤，代表還有檔案在用 `import { VehicleType } from '@/types'`，把那些 import 改為 `from '@/lib/vehicle'`。

選項 B（保守）：**保留 re-export 但加上 `@deprecated` 註解**

```typescript
/** @deprecated 改用 import { VehicleType } from '@/lib/vehicle' */
export { VehicleType } from '@/lib/vehicle'
```

**建議選 A**，因為 gogmo 還在 MVP 階段，沒必要保留向下相容。

### 3.1.2 清理 src/lib/constants.ts

**修改前**讀取 `src/lib/constants.ts` 全文。

第 17-26 行的 `VEHICLE_LABELS` 在 Phase 2 應該已被移除。本階段確認：

```bash
grep -n "VEHICLE_LABELS\|VEHICLE_OPTIONS\|vehicle_labels" src/lib/constants.ts
```

預期結果：找不到任何車型相關 const。

如果還有殘留，整段刪除。

### 3.1.3 清理 parser-dictionary.ts 的舊代號相容（可選）

`src/lib/vehicle/parser-dictionary.ts` 中有大量舊代號相容（small, suv, van9, small_suv, van7 等）。這些是給 Parser 用的——AI 模型可能仍會輸出舊代號。

**評估規則**：
- AI prompt 已更新（Phase 2.3），告訴 AI 用新代號
- 但 AI 偶爾不聽話，可能還會輸出舊代號
- 字典開銷極低（一個物件查詢）

**建議**：**保留**舊代號字典作為「永久兜底」，加上註解說明用途：

```typescript
// === 舊代號相容字典 ===
// 雖 prompt 已要求 AI 輸出新代號，但 AI 偶爾仍會輸出舊代號，
// 此處保留作為永久兜底。請勿移除。
small: VehicleType.SEDAN_5,
suv: VehicleType.SUV_5,
// ...
```

### 3.1.4 Build Check

```bash
npx tsc --noEmit
npm run build
```

通過後 commit：

```
chore(vehicle): remove transitional compatibility code

  - Remove deprecated VehicleType re-export from types/index.ts
  - Remove obsolete VEHICLE_LABELS from constants.ts
  - Add explanatory comments to parser-dictionary legacy entries
  - All vehicle imports now go through @/lib/vehicle exclusively
```

---

## 三、Sub-phase 3.2：加入 ESLint 防呆規則

### 3.2.1 建立自訂 ESLint 規則

在 `.eslintrc.js`（或 `.eslintrc.json` / `eslint.config.js`，看你的專案結構）加入：

```javascript
module.exports = {
  // ... 既有設定
  rules: {
    // ... 既有規則

    // === 車型系統防呆規則 ===
    'no-restricted-syntax': [
      'error',
      // 禁止硬編碼舊車型代號字串
      {
        selector: "Literal[value=/^(small|suv|van7|van9|small_sedan|small_suv|any_r)$/]",
        message: '禁止硬編碼舊車型代號。請使用 import { VehicleType } from "@/lib/vehicle" 並使用 VehicleType.SEDAN_5 等標準代號。',
      },
      // 禁止硬編碼中文車型字串
      {
        selector: "Literal[value=/^(小車|休旅|休旅車|7人座|9人座|VITO|GRANVIA|自填)$/]",
        message: '禁止硬編碼中文車型字串。請從 @/lib/vehicle 引入 VEHICLE_LABELS 顯示中文。',
      },
    ],

    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@/types',
            importNames: ['VehicleType', 'VehicleSizeType'],
            message: '車型相關 type 請從 @/lib/vehicle import',
          },
          {
            name: '@/lib/constants',
            importNames: ['VEHICLE_LABELS'],
            message: 'VEHICLE_LABELS 請從 @/lib/vehicle import',
          },
        ],
      },
    ],
  },

  // 為 Phase 1 模組與 migration SQL 開後門（這些檔案需要使用舊代號）
  overrides: [
    {
      files: ['src/lib/vehicle/**/*.ts', 'prisma/migrations/**/*.sql'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
}
```

### 3.2.2 驗證 ESLint 規則生效

執行：

```bash
npx eslint src/ --ext .ts,.tsx
```

預期：通過（因為 Phase 2 已清掉所有硬編碼）。

接著做反向測試——在任意檔案臨時加上違規程式碼確認規則會擋：

```typescript
// 臨時測試：在某個 .tsx 檔案最上面加
const test = 'small'  // 應該被 ESLint 報錯
const test2 = '小車'   // 應該被 ESLint 報錯
```

確認 `npx eslint` 報錯後，把測試程式碼刪除。

### 3.2.3 把 ESLint 加入 build 流程（可選但推薦）

如果 `package.json` 還沒設定，加入：

```json
{
  "scripts": {
    "lint": "next lint",
    "build": "npm run lint && next build"
  }
}
```

這樣 `npm run build` 會先跑 ESLint，違規直接擋下不讓 build 過。

### 3.2.4 Commit

```
chore(vehicle): add ESLint rules to prevent hardcoded vehicle codes

  - Block hardcoded legacy codes: small, suv, van7, van9, small_suv, etc.
  - Block hardcoded Chinese strings: 小車, 休旅, 7人座, etc.
  - Block imports of VehicleType from @/types (must use @/lib/vehicle)
  - Allow legacy codes only in src/lib/vehicle/ and migration SQL
  - Integrate lint into npm run build
```

---

## 四、Sub-phase 3.3：更新專案文件

### 3.3.1 更新 CLAUDE.md

在 `CLAUDE.md` 中加入「車型系統規範」章節：

```markdown
## 車型系統規範

### 標準車型代號（請務必使用）

| 代號 | 中文 | 說明 |
|------|------|------|
| `SEDAN_5` | 5 人座 | 轎車 |
| `SUV_5` | 5 人座休旅 | 含 7 人座 SUV（行李空間不足，視為 5 人座） |
| `MPV_7` | 7 人座 MPV | 多功能休旅，例：Sienna、Odyssey、Custin |
| `VAN_9` | 9 人座 | 廂型車，例：Hiace、Tourneo、Starex |
| `CUSTOM` | 自訂車款 | VITO / GRANVIA / Alphard 等指定品牌 |

### 派單嚴格度

| 代號 | 說明 |
|------|------|
| `EXACT` | 必須是這個車型 |
| `MIN` | 最低需求，可派更高等級 |
| `ANY` | 任意車型 |

### 車牌類型

| 代號 | 說明 |
|------|------|
| `RENTAL` | R 牌（租賃車）— 預設，所有派單接受 |
| `TAXI` | T 牌（計程車）— 進階選項，僅當 `Order.allowTaxiPlate = true` 才會收到派單 |

### 程式碼規則

1. **必須** 從 `@/lib/vehicle` import 所有車型相關物件
2. **禁止** 在程式碼中硬編碼任何車型字串（包括 'small'、'5人座'、'small_suv' 等）
3. **禁止** 重複定義 `VEHICLE_LABELS` 或類似 mapping
4. 處理外部輸入（API body、AI 解析、LINE 訊息）一律走 `normalizeVehicleInput()`
5. 顯示車型中文一律使用 `VEHICLE_LABELS[vehicleType]`
6. 判斷司機可否接單一律使用 `isVehicleCompatible()`

### 新增車型的步驟

如果未來需要新增車型（例如 11 人座小巴）：

1. 在 `src/lib/vehicle/types.ts` 加入 enum 值（例：`MINIBUS_11`）
2. 在 `src/lib/vehicle/labels.ts` 加入中文標籤
3. 在 `src/lib/vehicle/capacity.ts` 加入 spec
4. 在 `src/lib/vehicle/parser-dictionary.ts` 加入常見寫法字典
5. 修改 Prisma schema 的 `VehicleType` enum
6. 跑 migration（`npx prisma migrate dev --name add_minibus_11`）
7. 在 ESLint 規則中將新代號加入「合法清單」（若有需要）

### 自訂車款（CUSTOM）特別說明

選擇 CUSTOM 時，**必須** 同時填寫 `customVehicleNote`（自由文字描述）。
建議派單方在 UI 提示「請註明車款與座位數」，但不強制。

CUSTOM 訂單的派發邏輯：
- 不會自動派給任何 5 種標準車型的司機
- 僅 `vehicleType = CUSTOM` 的司機會收到（理論上不應有此種司機）
- 實務上 CUSTOM 訂單由派單方手動指派
```

### 3.3.2 更新 CURRENT_WORK.md

加入：

```markdown
## 已完成項目

### 車型系統重構（2026-04）

- ✅ Phase 1：建立 `src/lib/vehicle/` 統一模組
- ✅ Phase 2：Prisma migration、API、Parser、排程、前端全面切換
- ✅ Phase 3：清除過渡程式碼、加入 ESLint 防呆規則、寫入規範

**重構成果**：
- 從原本 4 套不同編碼系統（API/Parser/Driver 註冊/前端中文）統一為單一 `VehicleType` enum
- 修復新司機註冊 `small_suv` 後排程匹配失效的 silent failure
- 修復 Parser 高階車型（Alphard、VITO 等）資訊丟失問題
- 加入車牌類型欄位（RENTAL / TAXI），為未來開放 T 牌接機預留
- 加入派單嚴格度欄位（EXACT / MIN / ANY）

**新增關鍵檔案**：
- `src/lib/vehicle/` 全套模組
- 三份 spec 文件：`VEHICLE_PHASE1_FOUNDATION.md`、`PHASE2_MIGRATION.md`、`PHASE3_CLEANUP.md`

**ESLint 規則**：
新增禁止硬編碼車型字串的規則，違規會在 build 時被擋下。
```

### 3.3.3 Commit

```
docs(vehicle): document unified vehicle system in CLAUDE.md and CURRENT_WORK.md

  - Add comprehensive vehicle system specification to CLAUDE.md
  - Document standard codes, requirement levels, plate types
  - Document mandatory rules for vehicle code usage
  - Document procedure for adding new vehicle types
  - Update CURRENT_WORK.md with refactor completion status
```

---

## 五、Sub-phase 3.4：最終全面驗證

### 3.4.1 全文搜尋舊代號殘留

```bash
# 搜尋舊代號（應該完全找不到，除了 vehicle/ 模組與 migration 檔案）
grep -rn "['\"]small['\"]" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "src/lib/vehicle/"
grep -rn "['\"]small_suv['\"]" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "src/lib/vehicle/"
grep -rn "['\"]van7['\"]\|['\"]van9['\"]" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "src/lib/vehicle/"
grep -rn "['\"]any_r['\"]" src/ --include="*.ts" --include="*.tsx"
grep -rn "['\"]large['\"]\|['\"]imported['\"]\|['\"]mercedes_v['\"]\|['\"]g_independent['\"]" src/ \
  --include="*.ts" --include="*.tsx" | grep -v "src/lib/vehicle/"

# 搜尋中文車型硬編碼（應該完全找不到，除了 vehicle/ 模組）
grep -rn "['\"]小車['\"]\|['\"]休旅車['\"]\|['\"]7人座['\"]\|['\"]9人座['\"]" src/ \
  --include="*.ts" --include="*.tsx" | grep -v "src/lib/vehicle/"

# 搜尋舊欄位名稱（應該完全找不到）
grep -rn "\.vehicle[^A-Za-z]" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "vehicleType\|vehicleRequirement\|vehicleNote"
grep -rn "\.carType" src/ --include="*.ts" --include="*.tsx"
```

預期：以上所有搜尋都應**毫無結果**（或只剩 `src/lib/vehicle/`、`prisma/migrations/` 內的檔案）。

### 3.4.2 ESLint 完整檢查

```bash
npx eslint src/ --ext .ts,.tsx
```

零 error、零 warning。

### 3.4.3 TypeScript 完整檢查

```bash
npx tsc --noEmit
```

零 error。

### 3.4.4 Production Build

```bash
npm run build
```

成功通過（含 lint + build）。

### 3.4.5 端對端流程驗證（最終 smoke test）

按照 Phase 2.5.8 的測試項目再跑一次，確認所有功能正常：

- [ ] 派單方可以建立 5 種車型的訂單
- [ ] 派單方可以建立「自訂車款」訂單，customVehicleNote 正確儲存
- [ ] 派單方可以建立「任意車型」(`requirement: ANY`) 訂單
- [ ] SUV_5 司機只看得到符合條件的訂單
- [ ] MPV_7 司機可以接 MIN 模式的低階訂單
- [ ] CUSTOM 訂單由派單方手動指派
- [ ] AI Parser 解析「Alphard」→ `vehicleType: CUSTOM, customVehicleNote: 'Alphard'`
- [ ] AI Parser 解析「7 人座」→ `vehicleType: MPV_7`
- [ ] 註冊新司機可以選 5 種標準車型
- [ ] 派單通知文字顯示正確中文（例：「7 人座 MPV」而非「van9」）

### 3.4.6 DB 資料健康檢查

到 Supabase SQL Editor 執行：

```sql
-- 1. 確認所有訂單車型都合法
SELECT "vehicleType", "vehicleRequirement", COUNT(*)
FROM orders
GROUP BY "vehicleType", "vehicleRequirement"
ORDER BY COUNT(*) DESC;

-- 2. 確認 CUSTOM 訂單都有 customVehicleNote
SELECT id, "customVehicleNote"
FROM orders
WHERE "vehicleType" = 'CUSTOM' AND ("customVehicleNote" IS NULL OR "customVehicleNote" = '');
-- 預期：0 筆

-- 3. 確認 vehicleType NULL 的訂單都搭配 ANY
SELECT COUNT(*)
FROM orders
WHERE "vehicleType" IS NULL AND "vehicleRequirement" != 'ANY';
-- 預期：0 筆

-- 4. 確認所有司機都有合法車型
SELECT "vehicleType", "plateType", COUNT(*)
FROM drivers
GROUP BY "vehicleType", "plateType";
```

---

## 六、Phase 3 完成標誌

當以下全部達成，整個車型系統重構正式完成：

- [x] 全文搜尋找不到任何舊代號硬編碼
- [x] ESLint 規則生效並全綠
- [x] TypeScript 編譯零錯誤
- [x] `npm run build` 成功通過（含 lint）
- [x] 端對端 smoke test 全數通過
- [x] DB 資料健康檢查無異常
- [x] CLAUDE.md 已記錄車型系統規範
- [x] CURRENT_WORK.md 已標記重構完成

---

## 七、給 Claude Code 的執行指令

請把這份 spec 完整貼給 Claude Code，並加上以下指令：

```
請依照 VEHICLE_PHASE3_CLEANUP.md 的內容，完成車型系統重構的最後階段。

執行原則：
1. 嚴格按照 4 個 sub-phase 順序執行：3.1 → 3.2 → 3.3 → 3.4
2. 每個 sub-phase 完成後執行 npx tsc --noEmit + npm run build，通過才能 commit
3. Sub-phase 3.4 是最終驗證階段，請完整執行所有檢查項目並回報結果
4. 任何步驟有疑問就停下來問我

從 Sub-phase 3.1 開始。
```

---

## 八、後續維護建議

### 永久守則

- 任何新增車型相關功能，**先**改 `src/lib/vehicle/` 模組
- ESLint 規則不可關閉
- AI prompt 修改後務必更新 parser-dictionary

### 何時需要再次重構

未來若出現以下狀況，可能需要進一步演進：

1. **派單方頻繁使用 CUSTOM 且常指定特定車款**
   → 考慮加入 `vehicleModel` 系統（Toyota Alphard、Mercedes V 等）

2. **需要區分豪華等級**
   → 考慮加入 `vehicleTier` 欄位（STANDARD / PREMIUM / LUXURY）

3. **法規開放 T 牌接機**
   → 在派單方 UI 暴露 `allowTaxiPlate` 選項即可（schema 已就緒）

4. **新增非機場接送業務（例如包車、長途）**
   → 可能需要 `serviceType` 欄位，與 `vehicleType` 形成二維矩陣

這些演進都建立在當前的乾淨基礎上，不會再重蹈「四套系統並存」的覆轍。

---

## 九、給 Brian 的最後提醒

完成這三個 phase 後，gogmo 的車型系統就會是一個**乾淨、清晰、可擴充**的基礎。但有兩件事建議你親自做：

1. **跑一次 Lighthouse**：確認重構沒有意外影響效能
2. **手動建立幾筆訂單**：用真實的派單方視角測試 UI 流程，特別是「自訂車款」的引導文字是否清楚

如果在 Phase 2 或 Phase 3 過程中遇到 spec 沒涵蓋的情況，隨時把 Claude Code 的提問轉貼回來，我會幫你判斷該怎麼處理。
