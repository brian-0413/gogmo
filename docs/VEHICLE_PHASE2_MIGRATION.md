# gogmo 車型系統重構 Spec — Phase 2：遷移與切換

> **本階段目標**：將 Prisma schema、API、Parser、排程、前端全部切換到 Phase 1 建立的新模組
> **風險等級**：🟡 中風險 — 涉及 DB schema 改動與多處檔案修改
> **預計時間**：2-3 小時
> **前置條件**：Phase 1 已完成且通過驗收
> **執行原則**：分 5 個 sub-phase，每個 sub-phase 獨立 commit、獨立通過 build

---

## 一、本階段任務總覽（給 Claude Code 的完整說明）

本階段將舊的 4 套車型編碼系統全面切換到 Phase 1 建立的新模組，分為 5 個 sub-phase：

| Sub-phase | 內容 | 風險 | Build check |
|-----------|------|------|-------------|
| 2.1 | Prisma schema + Migration | 🔴 高 | ✅ |
| 2.2 | API 層改用新模組 | 🟡 中 | ✅ |
| 2.3 | Parser 輸出 normalize | 🟡 中 | ✅ |
| 2.4 | 排程邏輯改寫 | 🟡 中 | ✅ |
| 2.5 | 前端元件改用新模組 | 🟢 低 | ✅ |

每個 sub-phase 完成後**必須**：
1. `npx tsc --noEmit` 通過
2. `npm run build` 通過
3. Commit
4. 等使用者確認後再進下一個

---

## 二、執行前的環境準備

### 2.0.1 備份現有 DB

雖然 DB 中只有 1 筆 driver 與少量 order，建議仍做備份：

```bash
# Supabase Dashboard → Database → Backups → 手動備份
# 或使用 pg_dump（透過 Supabase 連線字串）
```

### 2.0.2 確認 Phase 1 模組可被引用

在任意檔案測試：

```typescript
import { VehicleType, normalizeVehicleInput } from '@/lib/vehicle'
```

無錯誤即可開始 Phase 2。

---

## Sub-phase 2.1：Prisma Schema + Migration

### 2.1.1 修改 Prisma Schema

**修改前**先讀取並顯示 `prisma/schema.prisma` 中以下區塊原始內容：
- `Order` model 第 275 行附近的 `vehicle` 欄位
- `Driver` model 第 178 行附近的 `carType` 欄位
- `DriverPricing` model 第 421 行附近的 `vehicleType` 欄位
- `RegionPriceStats` model 第 522 行附近的 `vehicleType` 欄位

**修改內容**：

#### A. 在 schema 頂部新增 enum

```prisma
// === 車型系統（與 src/lib/vehicle 同步） ===

enum VehicleType {
  SEDAN_5  // 5 人座（轎車）
  SUV_5    // 5 人座休旅（含 7 人座 SUV）
  MPV_7    // 7 人座 MPV
  VAN_9    // 9 人座
  CUSTOM   // 自訂車款
}

enum RequirementLevel {
  EXACT
  MIN
  ANY
}

enum PlateType {
  RENTAL
  TAXI
}
```

#### B. 修改 Order model

```prisma
model Order {
  // ... 其他原有欄位保持不變

  // === 車型相關欄位 ===
  // 移除舊欄位：
  // vehicle  String  // 已棄用：原為 small/suv/van9/any/any_r/pending

  // 新增以下欄位：
  vehicleType         VehicleType?      // null = 派單方未指定車型
  vehicleRequirement  RequirementLevel  @default(EXACT)
  customVehicleNote   String?           // 僅 vehicleType = CUSTOM 時填寫
  allowTaxiPlate      Boolean           @default(false)  // 是否允許 T 牌司機接單

  // ... 其他原有欄位保持不變
}
```

#### C. 修改 Driver model

```prisma
model Driver {
  // ... 其他原有欄位保持不變

  // === 車型相關欄位 ===
  // 移除舊欄位：
  // carType  String  // 已棄用

  // 新增以下欄位：
  vehicleType  VehicleType  @default(SEDAN_5)
  plateType    PlateType    @default(RENTAL)

  // ... 其他原有欄位保持不變
}
```

#### D. 修改 DriverPricing model

```prisma
model DriverPricing {
  // ... 其他原有欄位

  // 移除舊欄位：
  // vehicleType  String

  // 新增：
  vehicleType  VehicleType
}
```

#### E. 修改 RegionPriceStats model

```prisma
model RegionPriceStats {
  // ... 其他原有欄位

  // 移除舊欄位：
  // vehicleType  String?

  // 新增：
  vehicleType  VehicleType?  // 仍 nullable，因可能統計「全車型」
}
```

### 2.1.2 產生 Migration

```bash
npx prisma migrate dev --name vehicle_system_refactor --create-only
```

**注意使用 `--create-only`**，不要立刻執行！我們需要先手動編輯 SQL 加入資料轉換邏輯。

### 2.1.3 手動編輯 Migration SQL

開啟 `prisma/migrations/{timestamp}_vehicle_system_refactor/migration.sql`，

Prisma 會自動產生類似這樣的內容（實際依你的 schema 結構而定）：

```sql
-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN_5', 'SUV_5', 'MPV_7', 'VAN_9', 'CUSTOM');
CREATE TYPE "RequirementLevel" AS ENUM ('EXACT', 'MIN', 'ANY');
CREATE TYPE "PlateType" AS ENUM ('RENTAL', 'TAXI');

-- AlterTable: orders
ALTER TABLE "orders" DROP COLUMN "vehicle";
ALTER TABLE "orders" ADD COLUMN "vehicleType" "VehicleType";
ALTER TABLE "orders" ADD COLUMN "vehicleRequirement" "RequirementLevel" NOT NULL DEFAULT 'EXACT';
ALTER TABLE "orders" ADD COLUMN "customVehicleNote" TEXT;
ALTER TABLE "orders" ADD COLUMN "allowTaxiPlate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: drivers
ALTER TABLE "drivers" DROP COLUMN "carType";
ALTER TABLE "drivers" ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'SEDAN_5';
ALTER TABLE "drivers" ADD COLUMN "plateType" "PlateType" NOT NULL DEFAULT 'RENTAL';

-- AlterTable: driver_pricing, region_price_stats（依實際 schema 而定）
-- ...
```

**問題**：上述 SQL 會直接 DROP 舊欄位，舊資料會丟失。

**改成以下安全做法（兩階段 ALTER）**：

```sql
-- ============================================
-- gogmo 車型系統重構 Migration
-- 安全做法：先建新欄位 → 轉移資料 → 再 DROP 舊欄位
-- ============================================

-- (1) 建立新 enum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN_5', 'SUV_5', 'MPV_7', 'VAN_9', 'CUSTOM');
CREATE TYPE "RequirementLevel" AS ENUM ('EXACT', 'MIN', 'ANY');
CREATE TYPE "PlateType" AS ENUM ('RENTAL', 'TAXI');

-- (2) orders 表：先新增欄位（不 DROP 舊欄位）
ALTER TABLE "orders" ADD COLUMN "vehicleType" "VehicleType";
ALTER TABLE "orders" ADD COLUMN "vehicleRequirement" "RequirementLevel" NOT NULL DEFAULT 'EXACT';
ALTER TABLE "orders" ADD COLUMN "customVehicleNote" TEXT;
ALTER TABLE "orders" ADD COLUMN "allowTaxiPlate" BOOLEAN NOT NULL DEFAULT false;

-- (3) orders 表：資料轉換
-- 規則：
--   any / any_r / pending / NULL  → vehicleType = NULL, requirement = ANY
--   small        → SEDAN_5, EXACT
--   suv          → SUV_5, EXACT
--   van9         → VAN_9, EXACT  (保守做法：舊 van9 都當 9 人座)
UPDATE "orders" SET
  "vehicleType" = NULL,
  "vehicleRequirement" = 'ANY'
WHERE "vehicle" IN ('any', 'any_r', 'pending') OR "vehicle" IS NULL;

UPDATE "orders" SET
  "vehicleType" = 'SEDAN_5',
  "vehicleRequirement" = 'EXACT'
WHERE "vehicle" = 'small';

UPDATE "orders" SET
  "vehicleType" = 'SUV_5',
  "vehicleRequirement" = 'EXACT'
WHERE "vehicle" = 'suv';

UPDATE "orders" SET
  "vehicleType" = 'VAN_9',
  "vehicleRequirement" = 'EXACT'
WHERE "vehicle" = 'van9';

-- (4) orders 表：移除舊欄位
ALTER TABLE "orders" DROP COLUMN "vehicle";

-- (5) drivers 表：先新增欄位
ALTER TABLE "drivers" ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'SEDAN_5';
ALTER TABLE "drivers" ADD COLUMN "plateType" "PlateType" NOT NULL DEFAULT 'RENTAL';

-- (6) drivers 表：資料轉換
-- 規則：
--   small_sedan  → SEDAN_5
--   small_suv    → SUV_5
--   van7         → MPV_7
--   van9         → VAN_9
--   small        → SEDAN_5
--   suv          → SUV_5
UPDATE "drivers" SET "vehicleType" = 'SEDAN_5' WHERE "carType" IN ('small_sedan', 'small');
UPDATE "drivers" SET "vehicleType" = 'SUV_5' WHERE "carType" IN ('small_suv', 'suv');
UPDATE "drivers" SET "vehicleType" = 'MPV_7' WHERE "carType" = 'van7';
UPDATE "drivers" SET "vehicleType" = 'VAN_9' WHERE "carType" = 'van9';
-- 預設 plateType = RENTAL (R 牌)，符合目前所有司機的實際情況

-- (7) drivers 表：移除舊欄位
ALTER TABLE "drivers" DROP COLUMN "carType";

-- (8) driver_pricing 表（若存在）
ALTER TABLE "driver_pricing" ADD COLUMN "vehicleType_new" "VehicleType";
UPDATE "driver_pricing" SET "vehicleType_new" = 'SEDAN_5' WHERE "vehicleType" = 'small';
UPDATE "driver_pricing" SET "vehicleType_new" = 'SUV_5' WHERE "vehicleType" = 'suv';
UPDATE "driver_pricing" SET "vehicleType_new" = 'VAN_9' WHERE "vehicleType" = 'van9';
ALTER TABLE "driver_pricing" DROP COLUMN "vehicleType";
ALTER TABLE "driver_pricing" RENAME COLUMN "vehicleType_new" TO "vehicleType";
ALTER TABLE "driver_pricing" ALTER COLUMN "vehicleType" SET NOT NULL;

-- (9) region_price_stats 表（若存在）
ALTER TABLE "region_price_stats" ADD COLUMN "vehicleType_new" "VehicleType";
UPDATE "region_price_stats" SET "vehicleType_new" = 'SEDAN_5' WHERE "vehicleType" = 'small';
UPDATE "region_price_stats" SET "vehicleType_new" = 'SUV_5' WHERE "vehicleType" = 'suv';
UPDATE "region_price_stats" SET "vehicleType_new" = 'VAN_9' WHERE "vehicleType" = 'van9';
ALTER TABLE "region_price_stats" DROP COLUMN "vehicleType";
ALTER TABLE "region_price_stats" RENAME COLUMN "vehicleType_new" TO "vehicleType";
-- 此表 vehicleType 仍 nullable，無 SET NOT NULL
```

**重要提示**：
- 上面的 driver_pricing 和 region_price_stats 部分用了「新增欄位 → 轉資料 → DROP 舊欄位 → RENAME」的手法，因為 Prisma 預設不允許從 `String` 直接 ALTER 成 enum 型別
- 若你的實際 schema 中這些表有其他相依關係（外鍵、索引），請小心處理

### 2.1.4 執行 Migration

```bash
npx prisma migrate dev
```

如果報錯，回到 SQL 檔案修正。**完成後必須**：

```bash
# 重新產生 Prisma Client
npx prisma generate

# 確認 schema 與 DB 同步
npx prisma db pull --print  # 比對 DB 實際結構
```

### 2.1.5 驗證 DB 資料

到 Supabase SQL Editor 執行：

```sql
SELECT "vehicleType", COUNT(*) FROM orders GROUP BY "vehicleType";
SELECT "vehicleType", "plateType", COUNT(*) FROM drivers GROUP BY "vehicleType", "plateType";
```

預期結果：
- `orders.vehicleType` 全部為 `NULL`（因原本全是 'any'）
- `drivers.vehicleType` 為 `SUV_5`（因原本是 'small_suv'）
- `drivers.plateType` 全部為 `RENTAL`

### 2.1.6 Build Check

```bash
npm run build
```

⚠️ **預期會出現許多 TypeScript 錯誤**，因為現有程式碼還在使用 `order.vehicle`、`driver.carType` 等舊欄位。**這些錯誤會在 sub-phase 2.2-2.5 逐步修復**。

**建議做法**：
- 將這些錯誤暫時用 `// @ts-expect-error TODO: vehicle refactor phase 2` 註解標記，讓 build 先通過
- 或建立一個 `git stash` 暫存目前修改，先把 sub-phase 2.2-2.5 整批做完再 commit

**較理想的做法**：將 sub-phase 2.1 與 2.2 合併為一個 commit，因為 schema 變動後 API 必須立即跟上才能讓系統運作。

### 2.1.7 Commit

```
feat(vehicle): migrate Prisma schema to unified VehicleType enum

  - Add VehicleType, RequirementLevel, PlateType enums
  - Order: replace `vehicle` String with vehicleType enum + requirement + customNote + allowTaxiPlate
  - Driver: replace `carType` String with vehicleType enum + plateType
  - DriverPricing, RegionPriceStats: migrate vehicleType to enum
  - Migration includes safe data conversion (small→SEDAN_5, small_suv→SUV_5, van7→MPV_7, etc.)
  - Existing data successfully migrated (orders.vehicle=any → vehicleType=NULL, requirement=ANY)
```

---

## Sub-phase 2.2：API 層改用新模組

### 2.2.1 修改 src/app/api/orders/route.ts

**修改前**先讀取並顯示原始內容（特別是第 265 行附近的 `validVehicles` 白名單）。

**修改要點**：

```typescript
// 移除：
// const validVehicles = ['small','suv','van9','any','any_r','pending']
// if (!validVehicles.includes(body.vehicle)) { ... }

// 改為：
import { normalizeVehicleInput, VehicleType, RequirementLevel } from '@/lib/vehicle'

// 在 POST handler 中：
const normalized = normalizeVehicleInput(body.vehicle ?? body.vehicleType)

const order = await prisma.order.create({
  data: {
    // ... 其他欄位
    vehicleType: normalized.vehicleType,
    vehicleRequirement: normalized.requirement,
    customVehicleNote: normalized.customVehicleNote,
    allowTaxiPlate: body.allowTaxiPlate ?? false,
  },
})
```

### 2.2.2 修改 src/app/api/orders/self-publish/route.ts

同上，第 97 行的 `validVehicles` 白名單也要移除，改用 `normalizeVehicleInput`。

### 2.2.3 修改其他相關 API

請 Claude Code 搜尋以下關鍵字並逐一修正：

```bash
grep -r "validVehicles" src/
grep -r "order.vehicle" src/  # 注意：避免誤改 order.vehicleType
grep -r "driver.carType" src/
```

**修改原則**：
- 讀取車型 → 改用新欄位 `vehicleType`
- 寫入車型 → 透過 `normalizeVehicleInput` 處理輸入
- 顯示車型 → 改用 `VEHICLE_LABELS[order.vehicleType]`

### 2.2.4 Build Check

```bash
npx tsc --noEmit
npm run build
```

必須全部通過。

### 2.2.5 Commit

```
refactor(vehicle): migrate API layer to use unified vehicle module

  - Replace hardcoded validVehicles whitelist with normalizeVehicleInput()
  - Update orders POST/PUT routes to use new vehicleType + requirement + customNote
  - Update self-publish route similarly
  - All vehicle reads now go through @/lib/vehicle module
```

---

## Sub-phase 2.3：Parser 輸出 normalize

### 2.3.1 修改 src/lib/ai.ts

**修改前**讀取並顯示 `extractVehicle()` 函式（約第 104-171 行）。

**修改要點**：

```typescript
import { normalizeParserOutput } from '@/lib/vehicle'

export async function extractVehicle(text: string) {
  // ... 原有的 AI 呼叫邏輯保持不變

  const aiOutput = await callAI(text)

  // 在回傳前加上 normalize
  return normalizeParserOutput(aiOutput)
}
```

### 2.3.2 修改 src/lib/parser/prompts.ts

**修改前**讀取第 63-68 行的 vehicle_type 列舉部分。

**修改要點**：

更新 prompt 中告訴 AI 輸出哪些 vehicle_type 值。讓 AI 知道新的標準代號，但仍接受舊代號（因為 normalize 會兜底）：

```typescript
// 在 prompt 中加入：
const vehiclePromptSection = `
"vehicle_type" 欄位請輸出以下其中一個標準代號：
- "SEDAN_5"  : 5 人座轎車
- "SUV_5"    : 5 人座休旅（含 7 人座 SUV）
- "MPV_7"    : 7 人座 MPV（多功能休旅）
- "VAN_9"    : 9 人座廂型車
- "CUSTOM"   : 自訂車款（VITO / GRANVIA / Alphard / 其他指定品牌）

如為 CUSTOM，請在 "custom_vehicle_note" 欄位填入車款描述。
若訊息中未明確指定車型，請輸出 null。
`
```

### 2.3.3 修改 src/lib/parser/types.ts

**修改前**讀取第 19 行附近的 `vehicle_type` type 定義。

**修改要點**：

```typescript
// 移除舊定義：
// vehicle_type: "small" | "suv" | "large" | "van9" | "any" | "imported" | "mercedes_v" | "g_independent"

// 改為（使用 string 型別配合 normalize 兜底，避免硬綁特定值）：
import type { VehicleType } from '@/lib/vehicle'

export interface ParserOutput {
  // ... 其他欄位
  vehicle_type: VehicleType | string | null  // 接受標準代號、舊代號、品牌名、null
  custom_vehicle_note?: string | null
}
```

### 2.3.4 Build Check

```bash
npx tsc --noEmit
npm run build
```

### 2.3.5 Commit

```
refactor(parser): normalize AI vehicle output through unified module

  - Update extractVehicle to wrap AI output through normalizeParserOutput
  - Update parser prompt to teach AI new standard codes (SEDAN_5, etc.)
  - Update parser type definitions for vehicle_type field
  - Old codes (small, suv, large, imported, mercedes_v) still handled by dictionary fallback
```

---

## Sub-phase 2.4：排程邏輯改寫

### 2.4.1 修改 src/lib/scheduling.ts

**修改前**讀取第 429-435 行的 `isVehicleCompatible()` 函式。

**修改要點**：直接 import 並使用 Phase 1 建立的版本：

```typescript
// 移除原本的 isVehicleCompatible 函式定義

// 改為從新模組 import：
import { isVehicleCompatible } from '@/lib/vehicle'

// 呼叫時參數順序：
// isVehicleCompatible(driverVehicleType, orderVehicleType, requirement)
```

**注意呼叫端的參數調整**：原本可能只傳 2 個參數（driver, order），新版需要傳第 3 個 `requirement`。從 `order.vehicleRequirement` 取得。

### 2.4.2 修改 src/lib/availability.ts

**修改前**讀取第 110-116 行的 `VEHICLE_SCOPE` 邏輯。

**修改要點**：

```typescript
import { getCompatibleVehicleTypes, VehicleType } from '@/lib/vehicle'

// 移除原本的 VEHICLE_SCOPE 物件
// 改為使用 getCompatibleVehicleTypes()

export function getDriverScope(driverVehicleType: VehicleType): VehicleType[] {
  // 司機可接的訂單車型清單（含升級接單邏輯）
  return [VehicleType.SEDAN_5, VehicleType.SUV_5, VehicleType.MPV_7, VehicleType.VAN_9, VehicleType.CUSTOM]
    .filter((orderType) =>
      // 預設用 EXACT 模式檢查（嚴格相符）
      // 實際使用時請依業務情境決定是否使用 MIN
      isVehicleCompatible(driverVehicleType, orderType, RequirementLevel.EXACT)
    )
}
```

### 2.4.3 修改 src/app/dashboard/driver/page.tsx

**修改前**讀取第 34-47 行的中文 → 車型映射邏輯。

**修改要點**：移除整段中文映射邏輯，改用新模組：

```typescript
// 移除：
// const VEHICLE_SCOPE = { '小車': 'small', '轎車': 'small', '休旅': 'suv', ... }

// 改為：
import { VehicleType, VEHICLE_LABELS, normalizeVehicleInput } from '@/lib/vehicle'

// 任何需要顯示車型中文的地方：
<span>{VEHICLE_LABELS[driver.vehicleType]}</span>

// 任何需要從中文字串轉代號的地方（理論上應已不需要，因為前端應直接使用 VehicleType）：
const result = normalizeVehicleInput(chineseInput)
```

### 2.4.4 Build Check

```bash
npx tsc --noEmit
npm run build
```

### 2.4.5 整合測試

實際測試以下流程，確認排程行為正確：
1. 建立一張 `MPV_7` + `EXACT` 的訂單，確認只有 MPV_7 司機看得到
2. 建立一張 `SEDAN_5` + `MIN` 的訂單，確認 SEDAN_5/SUV_5/MPV_7/VAN_9 司機都能看到
3. 建立一張 `vehicleType = NULL` + `ANY` 的訂單，確認所有司機都看得到
4. 建立一張 `CUSTOM` + 任意 requirement 的訂單，確認只有 CUSTOM 司機看得到

### 2.4.6 Commit

```
refactor(scheduling): use unified compatibility logic from vehicle module

  - Replace local isVehicleCompatible with import from @/lib/vehicle
  - Replace VEHICLE_SCOPE with getCompatibleVehicleTypes()
  - Remove Chinese-to-code mapping in driver dashboard
  - All scheduling logic now uses VehicleType enum + RequirementLevel
```

---

## Sub-phase 2.5：前端元件改用新模組

### 2.5.1 待修改的前端元件清單

按掃描報告，以下檔案需要改：

1. `src/components/dispatcher/CreateDefaultsCard.tsx`（第 8 行）
2. `src/components/driver/SelfDispatchChat.tsx`（第 69-74 行）
3. `src/components/driver/DriverCustomers.tsx`（第 33-35 行）
4. `src/components/driver/QRPricingPanel.tsx`（第 20-23 行）
5. `src/components/auth/RegisterStep3.tsx`（第 3-8 行）
6. `src/app/dashboard/dispatcher/page.tsx`（第 301-303 行的中文映射邏輯）
7. `src/lib/constants.ts`（第 17-26 行的 `VEHICLE_LABELS`，**此檔案的 VEHICLE_LABELS 將整批移除**）

### 2.5.2 統一改寫原則

**所有檔案改寫遵循相同模式**：

```typescript
// ❌ 移除這類硬編碼：
const VEHICLE_LABELS = { small: '小車', suv: '休旅車', van9: '9人座' }
const options = ['任意車', '小車', '休旅', '7人座', '9人座', 'VITO', 'GRANVIA', '自填']

// ✅ 改為：
import { VEHICLE_LABELS, VEHICLE_DROPDOWN_OPTIONS, VehicleType } from '@/lib/vehicle'

// 顯示用：
<span>{VEHICLE_LABELS[VehicleType.MPV_7]}</span>

// 下拉選單：
<select>
  {VEHICLE_DROPDOWN_OPTIONS.map(opt => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</select>
```

### 2.5.3 派單方下拉選單特別處理

`src/components/dispatcher/CreateDefaultsCard.tsx` 與 `src/app/dashboard/dispatcher/page.tsx` 是派單方建單的核心元件，改寫時要特別注意：

**舊邏輯**：選「自填」→ 顯示文字框 → 提交時做中文 → 代號的 mapping
**新邏輯**：選「自訂車款」→ 顯示文字框 + 提示「請註明座位數」→ 提交時直接以 `vehicleType: 'CUSTOM'`, `customVehicleNote: 文字內容` 送出

範例 UI 結構：

```typescript
<div>
  <label>車型</label>
  <select
    value={vehicleType ?? ''}
    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
  >
    <option value="">請選擇</option>
    {VEHICLE_DROPDOWN_OPTIONS.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>

  {vehicleType === VehicleType.CUSTOM && (
    <div>
      <label>自訂車款描述</label>
      <input
        type="text"
        placeholder="例：Alphard 6 人座豪華版"
        value={customNote}
        onChange={(e) => setCustomNote(e.target.value)}
      />
      <p className="text-sm text-gray-500">
        💡 請註明車款與座位數，方便司機判斷
      </p>
    </div>
  )}
</div>
```

### 2.5.4 司機註冊頁特別處理

`src/components/auth/RegisterStep3.tsx` 是司機選擇車型的地方，原本只有 `van7` / `van9` 兩個選項，現在要改為完整 5 個選項：

```typescript
import { VEHICLE_DROPDOWN_OPTIONS, VehicleType, PlateType } from '@/lib/vehicle'

// 車型選擇
<select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)}>
  {VEHICLE_DROPDOWN_OPTIONS
    .filter(opt => opt.value !== VehicleType.CUSTOM) // 司機通常不選 CUSTOM
    .map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
</select>

// 車牌類型選擇（MVP 可先預設 RENTAL，不暴露 UI）
// 但 schema 已支援，未來開放時改為：
<select value={plateType} onChange={(e) => setPlateType(e.target.value as PlateType)}>
  <option value={PlateType.RENTAL}>R 牌（租賃車）</option>
  <option value={PlateType.TAXI}>T 牌（計程車）</option>
</select>
```

### 2.5.5 移除 src/lib/constants.ts 中的 VEHICLE_LABELS

第 17-26 行的 `VEHICLE_LABELS` 整段移除。任何引用這個 const 的地方，改為從 `@/lib/vehicle` import。

執行替換時請逐一檢查以下引用：

```bash
grep -r "from.*constants.*VEHICLE_LABELS" src/
grep -r "constants\.VEHICLE_LABELS" src/
```

### 2.5.6 移除 types/index.ts 中的舊 type

```typescript
// 第 51 行：移除
// export type VehicleSizeType = 'small_sedan' | 'small_suv' | 'van7' | 'van9'

// 第 64 行：移除
// export type VehicleType = 'small' | 'suv' | 'van9' | 'any' | 'any_r' | 'pending'

// 改為 re-export 新模組（保持向後相容期間）：
export { VehicleType } from '@/lib/vehicle'
```

⚠️ 注意：原本 `types/index.ts` 的 `VehicleType` 是 string union，現在 `@/lib/vehicle` 的 `VehicleType` 是 enum-like const + type。任何使用 `'small'`, `'suv'` 等字串字面值的地方都會 TypeScript 報錯，這正是我們要的——強制全部改用 `VehicleType.SEDAN_5` 等。

### 2.5.7 Build Check

```bash
npx tsc --noEmit
npm run build
```

修正所有錯誤直到全部通過。

### 2.5.8 整合測試

實際走完以下流程：
1. 派單方登入 → 建立預設車型 → 確認 5 個選項顯示正確
2. 派單方建立訂單 → 選「自訂車款」→ 填「Alphard」→ 確認 DB 儲存正確
3. 司機登入 → 確認可看到符合自己車型的訂單
4. 派單方建立 ANY 訂單 → 確認所有司機看得到
5. 註冊新司機 → 選 MPV_7 → 確認 DB 寫入正確

### 2.5.9 Commit

```
refactor(ui): migrate all frontend components to unified vehicle module

  - Update dispatcher CreateDefaultsCard, page.tsx with VEHICLE_DROPDOWN_OPTIONS
  - Update driver SelfDispatchChat, DriverCustomers, QRPricingPanel
  - Update RegisterStep3 with all 5 vehicle types
  - Add CUSTOM vehicle UI flow with customVehicleNote input
  - Remove duplicate VEHICLE_LABELS from constants.ts
  - Remove obsolete VehicleType / VehicleSizeType from types/index.ts
  - All UI now reads vehicle data through @/lib/vehicle exclusively
```

---

## 三、Phase 2 整體驗收

完成所有 5 個 sub-phase 後執行：

### 3.1 全專案編譯檢查

```bash
npx tsc --noEmit
npm run build
```

全部通過。

### 3.2 全文搜尋舊代號

確認以下關鍵字在程式碼中**已不存在**（除了 migration SQL 與 normalize 字典）：

```bash
grep -rn "'small'" src/ --include="*.ts" --include="*.tsx" | grep -v vehicle/parser-dictionary
grep -rn "'small_suv'" src/ --include="*.ts" --include="*.tsx" | grep -v vehicle/parser-dictionary
grep -rn "'van9'" src/ --include="*.ts" --include="*.tsx" | grep -v vehicle/parser-dictionary
grep -rn "'any_r'" src/ --include="*.ts" --include="*.tsx"
```

預期結果：除了 `src/lib/vehicle/parser-dictionary.ts`（保留兼容字典）以外，其他地方應該都看不到。

### 3.3 端對端流程測試

**派單方視角**：
- [ ] 建立 5 種車型的訂單各一筆
- [ ] 建立「自訂車款」訂單，文字註記 Alphard
- [ ] 建立「任意車型」(`requirement: ANY`) 訂單
- [ ] 建立「最低需求 SEDAN_5」(`requirement: MIN`) 訂單

**司機視角**：
- [ ] SUV_5 司機只看得到 SUV_5 / ANY / MIN(SEDAN_5) 訂單
- [ ] MPV_7 司機看得到 MPV_7 / ANY / MIN(SEDAN_5/SUV_5/MPV_7) 訂單
- [ ] CUSTOM 訂單只有 CUSTOM 司機看得到

**Parser 測試**（用 LINE 訊息原始文字測）：
- [ ] 「7 人座」 → MPV_7
- [ ] 「9 人座」 → VAN_9
- [ ] 「Alphard」 → CUSTOM + customVehicleNote = 'Alphard'
- [ ] 「任意 R」 → vehicleType = NULL, requirement = ANY

### 3.4 DB 完整性檢查

```sql
-- 確認沒有資料殘留
SELECT * FROM orders WHERE "vehicleType" IS NULL AND "vehicleRequirement" != 'ANY';
-- 預期：0 筆（vehicleType NULL 應該都搭配 ANY）

SELECT * FROM orders WHERE "vehicleType" = 'CUSTOM' AND "customVehicleNote" IS NULL;
-- 預期：0 筆（CUSTOM 必有 customVehicleNote）
```

如有異常資料，回頭檢查 normalize 邏輯。

---

## 四、Phase 3 預告

Phase 2 完成後，Phase 3 會進行：
- 完全移除舊 type 定義（`types/index.ts` 的 re-export 可全部清掉）
- 移除 `src/lib/constants.ts` 殘留
- 加入 ESLint rule 防止再次硬編碼
- 更新 CLAUDE.md 記錄車型系統規範
- 更新 CURRENT_WORK.md 標記重構完成

---

## 五、給 Claude Code 的執行指令

請把這份 spec 完整貼給 Claude Code，並加上以下指令：

```
請依照 VEHICLE_PHASE2_MIGRATION.md 的內容，將 gogmo 車型系統切換到 Phase 1 建立的新模組。

執行原則：
1. 嚴格按照 5 個 sub-phase 順序執行，每個 sub-phase 完成後：
   a. 執行 npx tsc --noEmit
   b. 執行 npm run build
   c. 兩者通過才能 commit
   d. commit 後停下來等我確認，再進入下一個 sub-phase

2. Sub-phase 2.1 涉及 Prisma migration：
   - 使用 --create-only 先產生 SQL 檔案
   - 顯示原始 SQL 給我看
   - 按照 spec 的安全做法手動編輯 SQL（先新增欄位 → 轉資料 → DROP 舊欄位）
   - 編輯後再執行 npx prisma migrate dev
   - 完成後在 Supabase SQL Editor 確認資料

3. 修改任何現有檔案前，先 view 該檔案並顯示原始內容給我看

4. 每個 sub-phase commit 完後，回報：
   - 修改的檔案清單
   - tsc/build 結果
   - 任何需要我決策的細節

5. 若遇到 spec 未涵蓋的情況，停下來問我，不要自行猜測

從 Sub-phase 2.1 開始。
```
