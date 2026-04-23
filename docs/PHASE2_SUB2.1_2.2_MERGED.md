# Phase 2 Sub-phase 2.1 + 2.2 合併執行

## 執行概述

將 Prisma schema 修改 + API 層改用新模組 **合併為一個 commit**。

這樣做的好處：「修改 schema + 更新 API」是原子操作，commit 歷史清晰。

---

## 前置確認

gogmo DB 現況：
- `drivers` 表：2 筆資料，都是 `carType = 'small_suv'`（待轉成 `vehicleType = 'SUV_5'`）
- `orders` 表：5 筆資料，全部 `vehicle = 'any'`（待轉成 `vehicleType = NULL, vehicleRequirement = 'ANY'`）

資料量小，migration 風險極低。

---

## Sub-phase 2.1：Prisma Schema + Migration

### 步驟 1：View 原始 schema

先讀取 `prisma/schema.prisma`，重點關注以下 model 的**原始內容**：

1. **Order model**（約第 250-300 行）：找到 `vehicle` 欄位定義
2. **Driver model**（約第 150-200 行）：找到 `carType` 欄位定義
3. **DriverPricing model**（約第 400-450 行）：找到 `vehicleType` 欄位定義（若存在）
4. **RegionPriceStats model**（約第 500-550 行）：找到 `vehicleType` 欄位定義（若存在）

完整讀取這些區塊後顯示給我看，讓我確認你抓對了位置。

### 步驟 2：修改 Prisma Schema

在 schema 頂部（最好放在 `model` 定義之前）新增以下 enum：

```prisma
// === 車型系統 enums ===

enum VehicleType {
  SEDAN_5
  SUV_5
  MPV_7
  VAN_9
  CUSTOM
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

然後按照 `/docs/VEHICLE_PHASE2_MIGRATION.md` 的「2.1.1 修改 Prisma Schema」小節修改以下 model：

#### Order model

移除：`vehicle String`
新增：
```prisma
vehicleType         VehicleType?
vehicleRequirement  RequirementLevel @default(EXACT)
customVehicleNote   String?
allowTaxiPlate      Boolean @default(false)
```

#### Driver model

移除：`carType String`
新增：
```prisma
vehicleType VehicleType @default(SEDAN_5)
plateType   PlateType @default(RENTAL)
```

#### DriverPricing model（若存在）

```prisma
// 修改原有的 vehicleType 欄位
vehicleType VehicleType  // 改成 enum，移除舊的 String 類型
```

#### RegionPriceStats model（若存在）

```prisma
// 修改原有的 vehicleType 欄位
vehicleType VehicleType?  // 改成 enum，仍保留 nullable
```

修改完後，請**顯示修改後的這幾個 model** 給我看，讓我確認無誤。

### 步驟 3：產生 Migration SQL（不執行）

執行：

```bash
npx prisma migrate dev --create-only --name vehicle_system_refactor
```

**不要執行** `npx prisma migrate dev`！我們需要先手動編輯 SQL。

這個命令會在 `prisma/migrations/{timestamp}_vehicle_system_refactor/` 建立一個資料夾，其中有 `migration.sql` 檔案。

請：
1. 找到那個自動產生的 `migration.sql`
2. **完整顯示** SQL 內容給我看
3. 不要執行 migration

### 步驟 4：手動編輯 Migration SQL

根據 `/docs/VEHICLE_PHASE2_MIGRATION.md` 的「2.1.3 手動編輯 Migration SQL」小節，按照以下**安全做法**編輯 SQL：

**安全做法的核心邏輯**：
1. 先建立新 enum
2. 先新增新欄位（不 DROP 舊欄位）
3. 執行資料轉換邏輯（UPDATE 語句）
4. 最後才 DROP 舊欄位

**具體要改的地方**：

如果自動產生的 SQL 中有這樣的 DROP 語句：

```sql
ALTER TABLE "orders" DROP COLUMN "vehicle";
```

改成分兩步：

```sql
-- (先新增新欄位)
ALTER TABLE "orders" ADD COLUMN "vehicleType" "VehicleType";
ALTER TABLE "orders" ADD COLUMN "vehicleRequirement" "RequirementLevel" NOT NULL DEFAULT 'EXACT';
-- ... 其他新欄位

-- (資料轉換)
UPDATE "orders" SET
  "vehicleType" = NULL,
  "vehicleRequirement" = 'ANY'
WHERE "vehicle" IN ('any', 'any_r', 'pending') OR "vehicle" IS NULL;

UPDATE "orders" SET
  "vehicleType" = 'SEDAN_5',
  "vehicleRequirement" = 'EXACT'
WHERE "vehicle" = 'small';

-- ... 更多 UPDATE（按 spec 新增）

-- (最後才 DROP)
ALTER TABLE "orders" DROP COLUMN "vehicle";
```

編輯完後，請**顯示編輯後的完整 SQL** 給我看，我確認無誤後再讓你執行。

### 步驟 5：執行 Migration

確認 SQL 無誤後執行：

```bash
npx prisma migrate dev
```

確認通過（不應有錯誤）。

### 步驟 6：驗證 DB 資料

到 Supabase SQL Editor 執行以下查詢，確認資料轉換正確：

```sql
-- 驗證 orders 資料轉換
SELECT "vehicleType", "vehicleRequirement", COUNT(*) as cnt
FROM orders
GROUP BY "vehicleType", "vehicleRequirement"
ORDER BY COUNT(*) DESC;
-- 預期：vehicleType=NULL, vehicleRequirement=ANY, cnt=5

-- 驗證 drivers 資料轉換
SELECT "vehicleType", "plateType", COUNT(*) as cnt
FROM drivers
GROUP BY "vehicleType", "plateType"
ORDER BY COUNT(*) DESC;
-- 預期：vehicleType=SUV_5, plateType=RENTAL, cnt=2

-- 確認舊欄位已移除
SELECT * FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'vehicle';
-- 預期：0 筆（欄位已移除）

SELECT * FROM information_schema.columns
WHERE table_name = 'drivers' AND column_name = 'carType';
-- 預期：0 筆（欄位已移除）
```

執行這些查詢並回報結果。**如果資料不對，停下來，不要繼續**。

---

## Sub-phase 2.2：API 層改用新模組

### 步驟 7：修改 API 檔案

根據 `/docs/VEHICLE_PHASE2_MIGRATION.md` 的「2.2 API 層改用新模組」小節，修改：

1. `src/app/api/orders/route.ts`（第 265 行附近的 `validVehicles` 白名單）
2. `src/app/api/orders/self-publish/route.ts`（第 97 行附近的 `validVehicles` 白名單）
3. 其他相關 API 檔案（用 `grep -r "validVehicles"` 找出所有地方）

**修改原則**：

移除硬編碼的白名單：
```typescript
// ❌ 移除這種
const validVehicles = ['small','suv','van9','any','any_r','pending']
if (!validVehicles.includes(body.vehicle)) { ... }
```

改為使用新模組：
```typescript
// ✅ 改為這樣
import { normalizeVehicleInput, VehicleType, RequirementLevel } from '@/lib/vehicle'

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

**修改前**請先 view 相關檔案段落，確認改動位置。

### 步驟 8：搜尋並修改所有相關 API

執行：

```bash
grep -r "validVehicles\|order\.vehicle\|driver\.carType" src/app/api --include="*.ts"
```

找出所有相關地方，逐一修改。

### 步驟 9：Build Check

```bash
npx tsc --noEmit
npm run build
```

**必須全部通過**。如果有錯誤，逐一修正（不要跳過）。

---

## 合併 Commit

Sub-phase 2.1 + 2.2 都完成、且 build 通過後，合併 commit：

```bash
git add .
git commit -m "refactor(vehicle): migrate Prisma schema and API layer to unified vehicle system

  - Add VehicleType, RequirementLevel, PlateType enums to schema
  - Order: replace vehicle String with vehicleType enum + requirement + customNote + allowTaxiPlate
  - Driver: replace carType String with vehicleType enum + plateType
  - DriverPricing, RegionPriceStats: migrate vehicleType to enum
  - Migration includes safe data conversion (any→vehicleType=NULL, small→SEDAN_5, small_suv→SUV_5)
  - Update all API routes to use normalizeVehicleInput() instead of hardcoded whitelist
  - All vehicle reads now go through @/lib/vehicle module
  - tsc + build: ✅ pass"
```

---

## 完成回報

commit 成功後，請回報：

```
✅ Commit: [commit hash] [message]
✅ tsc --noEmit: [結果]
✅ npm run build: [結果]
✅ DB 驗證：
  - orders: vehicleType=NULL, vehicleRequirement=ANY, 5 筆 ✅
  - drivers: vehicleType=SUV_5, plateType=RENTAL, 2 筆 ✅
✅ 修改的檔案：
  - prisma/schema.prisma
  - prisma/migrations/{timestamp}_vehicle_system_refactor/migration.sql
  - src/app/api/orders/route.ts
  - src/app/api/orders/self-publish/route.ts
  - [其他修改的檔案]

準備進入 Sub-phase 2.3：Parser 輸出 normalize
```

---

## 注意事項

1. **執行 SQL 前一定要給我看**——尤其是 migration.sql，確認安全做法有落實（新增 → 轉資料 → DROP）

2. **DB 驗證很重要**——如果資料轉換失敗，不要繼續，停下來讓我檢查

3. **Build 一定要通過**——不要用 `// @ts-ignore` 跳過錯誤

4. **遇到不確定就停下來問**——例如如果發現有其他車型相關的欄位或邏輯我沒提到，問一下

祝順利！🚀
