# Phase 2 Sub-phase 2.3 + 2.4 + 2.5 自動執行

## 執行模式

執行 Phase 2 的剩餘三個 sub-phase（2.3 / 2.4 / 2.5），**每個 sub-phase 完成後停下來等待確認**。

```
2.3 完成 → 停下來等確認 → 我回覆「下一步」
2.4 完成 → 停下來等確認 → 我回覆「下一步」
2.5 完成 → 停下來等確認 → 我回覆「下一步」
```

---

## Sub-phase 2.3：Parser 輸出 normalize

根據 `/docs/VEHICLE_PHASE2_MIGRATION.md` 的「2.3 Parser 輸出 normalize」小節執行。

### 修改的檔案

1. `src/lib/ai.ts` — extractVehicle() 函式
2. `src/lib/parser/prompts.ts` — vehicle_type prompt
3. `src/lib/parser/types.ts` — ParserOutput type 定義

### 執行步驟

#### 步驟 1：View 並修改 src/lib/ai.ts

- View `src/lib/ai.ts` 的 `extractVehicle()` 函式（約第 104-171 行）
- 在函式頂部加入 import：
  ```typescript
  import { normalizeParserOutput } from '@/lib/vehicle'
  ```
- 在函式回傳前，將 AI 輸出包裝進 normalize：
  ```typescript
  return normalizeParserOutput(aiOutput)
  ```
- Build check：`npx tsc --noEmit && npm run build`

#### 步驟 2：View 並修改 src/lib/parser/prompts.ts

- View 第 63-68 行的 vehicle_type 列舉部分
- 更新 prompt，告訴 AI 新的標準代號（SEDAN_5、SUV_5、MPV_7、VAN_9、CUSTOM）
- 保留舊代號的 fallback（因為 normalize dictionary 會兜底）
- Build check

#### 步驟 3：View 並修改 src/lib/parser/types.ts

- View 第 19 行附近的 `vehicle_type` type 定義
- 修改為更寬鬆的型別（允許 string，配合 normalize 兜底）：
  ```typescript
  import type { VehicleType } from '@/lib/vehicle'
  
  export interface ParserOutput {
    // ... 其他欄位
    vehicle_type: VehicleType | string | null
    custom_vehicle_note?: string | null
  }
  ```
- Build check

### 完成回報

```
✅ Sub-phase 2.3 完成
- 修改 src/lib/ai.ts：extractVehicle() 加入 normalizeParserOutput()
- 修改 src/lib/parser/prompts.ts：更新 vehicle_type prompt
- 修改 src/lib/parser/types.ts：放寬 vehicle_type 型別
- tsc：✅ pass
- build：✅ pass
- commit hash: [hash]

等待確認，準備進入 Sub-phase 2.4
```

---

## Sub-phase 2.4：排程邏輯改寫

根據 `/docs/VEHICLE_PHASE2_MIGRATION.md` 的「2.4 排程邏輯改寫」小節執行。

### 修改的檔案

1. `src/lib/scheduling.ts` — isVehicleCompatible() 邏輯
2. `src/lib/availability.ts` — VEHICLE_SCOPE 邏輯
3. `src/app/dashboard/driver/page.tsx` — 中文映射邏輯

### 執行步驟

#### 步驟 1：修改 src/lib/scheduling.ts

- View `src/lib/scheduling.ts` 的 `isVehicleCompatible()` 函式（約第 429-435 行）
- 移除原本的函式定義
- 改為 import 並直接使用：
  ```typescript
  import { isVehicleCompatible } from '@/lib/vehicle'
  ```
- 檢查所有呼叫此函式的地方，確保傳入 3 個參數：
  ```typescript
  isVehicleCompatible(driverVehicleType, orderVehicleType, orderRequirement)
  ```
  - 如果原本只傳 2 個參數，從 `order.vehicleRequirement` 取第 3 個
- Build check

#### 步驟 2：修改 src/lib/availability.ts

- View 第 110-116 行的 `VEHICLE_SCOPE` 邏輯
- 移除舊的 VEHICLE_SCOPE 物件定義
- 改為使用新函式：
  ```typescript
  import { getCompatibleVehicleTypes, VehicleType, RequirementLevel } from '@/lib/vehicle'
  
  export function getDriverScope(driverVehicleType: VehicleType): VehicleType[] {
    return [VehicleType.SEDAN_5, VehicleType.SUV_5, VehicleType.MPV_7, VehicleType.VAN_9, VehicleType.CUSTOM]
      .filter((orderType) =>
        isVehicleCompatible(driverVehicleType, orderType, RequirementLevel.EXACT)
      )
  }
  ```
- Build check

#### 步驟 3：修改 src/app/dashboard/driver/page.tsx

- View 第 34-47 行的中文 → 車型映射邏輯
- 移除 VEHICLE_SCOPE 相關程式碼
- 改為使用新模組：
  ```typescript
  import { VehicleType, VEHICLE_LABELS, normalizeVehicleInput } from '@/lib/vehicle'
  
  // 顯示中文時：
  <span>{VEHICLE_LABELS[driver.vehicleType]}</span>
  ```
- Build check

### 整合測試（重要）

修改完成後，請進行以下測試（**不用真的跑應用程式，只要確認邏輯正確**）：

1. 確認 `isVehicleCompatible()` 的 3 種模式能正確判斷：
   - EXACT：司機車型必須完全相符
   - MIN：司機車型 tier 須 >= 訂單車型 tier
   - ANY：任何司機都可

2. 確認 `getDriverScope()` 能正確回傳司機可接的訂單車型清單

3. 確認 `VEHICLE_LABELS` 能正確顯示中文

### 完成回報

```
✅ Sub-phase 2.4 完成
- 修改 src/lib/scheduling.ts：改用 @/lib/vehicle 的 isVehicleCompatible()
- 修改 src/lib/availability.ts：改用 getCompatibleVehicleTypes()
- 修改 src/app/dashboard/driver/page.tsx：改用 VEHICLE_LABELS
- tsc：✅ pass
- build：✅ pass
- commit hash: [hash]

等待確認，準備進入 Sub-phase 2.5
```

---

## Sub-phase 2.5：前端元件改用新模組

根據 `/docs/VEHICLE_PHASE2_MIGRATION.md` 的「2.5 前端元件改用新模組」小節執行。

### 待修改的檔案清單

1. `src/components/dispatcher/CreateDefaultsCard.tsx`
2. `src/components/driver/SelfDispatchChat.tsx`
3. `src/components/driver/DriverCustomers.tsx`
4. `src/components/driver/QRPricingPanel.tsx`
5. `src/components/auth/RegisterStep3.tsx`
6. `src/app/dashboard/dispatcher/page.tsx`
7. `src/lib/constants.ts`（移除 VEHICLE_LABELS）
8. `src/types/index.ts`（移除或 re-export 舊 types）

### 執行步驟

#### 步驟 1：統一改寫原則

所有前端元件改寫遵循同一模式：

```typescript
// ❌ 移除硬編碼
const VEHICLE_LABELS = { small: '小車', suv: '休旅車' }
const options = ['任意車', '小車', '休旅', '7人座', '9人座']

// ✅ 改為
import { VEHICLE_LABELS, VEHICLE_DROPDOWN_OPTIONS, VehicleType } from '@/lib/vehicle'

// 顯示用
<span>{VEHICLE_LABELS[VehicleType.MPV_7]}</span>

// 下拉選單用
{VEHICLE_DROPDOWN_OPTIONS.map(opt => (
  <option key={opt.value} value={opt.value}>{opt.label}</option>
))}
```

#### 步驟 2：修改派單方元件

**CreateDefaultsCard.tsx** 和 **dispatcher/page.tsx**：
- 移除中文 → 代號的 mapping 邏輯
- 改為使用 `VEHICLE_DROPDOWN_OPTIONS`
- 當選「自訂車款」(CUSTOM) 時，顯示文字輸入框 + 提示文字
- Build check

#### 步驟 3：修改司機端元件

**RegisterStep3.tsx**：
- 更新車型選項為完整 5 種（排除 CUSTOM）
- 新增車牌類型選擇（MVP 可先預設 RENTAL，不暴露 UI，但 schema 已支援）
- Build check

**SelfDispatchChat.tsx** / **DriverCustomers.tsx** / **QRPricingPanel.tsx**：
- 移除硬編碼的車型標籤
- 改為使用 `VEHICLE_LABELS[driver.vehicleType]`
- Build check

#### 步驟 4：清理舊定義

**src/lib/constants.ts**：
- 移除 `VEHICLE_LABELS` 定義

**src/types/index.ts**：
- 移除或 re-export 舊的 `VehicleType` / `VehicleSizeType` 型別定義
- 改為 re-export 新模組（過渡期相容）

#### 步驟 5：端對端測試（重要）

修改完成後，請在腦海中走一遍以下流程（**確認邏輯無誤，不用實際啟動應用**）：

1. 派單方建立訂單：
   - 下拉選單顯示 5 種車型（SEDAN_5 / SUV_5 / MPV_7 / VAN_9 / CUSTOM）
   - 選「自訂車款」時，出現文字輸入框 + 提示

2. 司機註冊：
   - 能選 5 種車型（排除 CUSTOM）
   - 車牌類型預設 RENTAL（若暴露 UI，可選 RENTAL / TAXI）

3. 司機 Dashboard：
   - 顯示的車型中文正確（例：「7 人座 MPV」而非 `van7`）

### 完成回報

```
✅ Sub-phase 2.5 完成
- 修改派單方元件：CreateDefaultsCard、dispatcher/page.tsx
- 修改司機端元件：RegisterStep3、SelfDispatchChat、DriverCustomers、QRPricingPanel
- 清理常數定義：移除 constants.ts 的 VEHICLE_LABELS
- 更新 types/index.ts 型別定義
- tsc：✅ pass
- build：✅ pass
- commit hash: [hash]

✅ Phase 2 全部完成！（2.1 + 2.2 + 2.3 + 2.4 + 2.5）

等待確認，準備進入 Phase 3
```

---

## 防線設定

### 必須停下來的地方

- 每個 sub-phase 完成後都要停下來等確認
- 任何 tsc 或 build 錯誤都要停下來，不要跳過
- 任何 spec 未涵蓋的地方，停下來問

### 遇到問題

如果在執行過程中發現：
- 檔案結構與 spec 預期不符
- 有多個版本的類似邏輯（例如 VEHICLE_LABELS 定義在多個地方）
- 有隱藏的相依關係（例如其他檔案 import 你要刪除的常數）

**立即停下來，列出發現的問題**，等我指示再繼續。

---

## 開始

現在執行 **Sub-phase 2.3**。完成後停下來等確認。

加油！🚀
