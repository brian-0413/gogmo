# gogmo 車型系統重構 Spec — Phase 1：基礎建設

> **本階段目標**：建立 `src/lib/vehicle/` 模組作為車型系統的「唯一真理之源」（Single Source of Truth）
> **風險等級**：🟢 零風險 — 純新增模組，不修改任何現有程式碼
> **預計時間**：30 分鐘
> **執行順序**：必須在 Phase 2 之前完成

---

## 一、本階段任務總覽（給 Claude Code 的完整說明）

本階段建立 `src/lib/vehicle/` 模組，集中管理所有車型相關邏輯。完成後，後續 Phase 2 的所有改動都會引用這個模組，不再有散落各處的硬編碼。

**本階段不修改任何現有檔案，純新增**。即使中途發現問題也不會影響線上系統。

---

## 二、背景說明（為什麼需要這個模組）

目前 gogmo 程式碼中車型有 **4 套不同的編碼系統**並存：

```
系統 A（API/Order）：small / suv / van9 / any / any_r / pending
系統 B（Parser AI）：small / suv / large / imported / mercedes_v / g_independent
系統 C（Driver 註冊）：small_sedan / small_suv / van7 / van9
系統 D（前端顯示）：'小車' / '休旅' / '7人座' / 'VITO' / 'GRANVIA' / '自填'
```

四套系統間沒有正式 mapping，靠散落的 `if-else` 和物件 literal 翻譯，造成：
- 派單方填「7 人座」→ DB 變 `van9`（與 9 人座合併）
- 司機註冊填 `small_suv` → 排程找不到對應 → 變成「可接所有車」（silent failure）
- Parser 解析 `large` / `imported` → API 拒收或 fallback 成 `any`（資訊丟失）
- 派單方輸入「自填：特斯拉」→ DB 存 `any`（自填內容消失）

**本階段建立的模組將成為新的標準**。

---

## 三、最終定案的車型設計

### 車型 enum（核心 5 種）

```typescript
SEDAN_5    // 5 人座（轎車）
SUV_5      // 5 人座休旅（含 7 人座 SUV，因為 7 人座 SUV 行李空間不足，視為 5 人座）
MPV_7      // 7 人座 MPV（多功能休旅車，例：Sienna、Odyssey、Custin）
VAN_9      // 9 人座（廂型車，例：Hiace、Tourneo、Starex）
CUSTOM     // 自訂車款（VITO、GRANVIA、Alphard 等豪華指定車）
```

### 派單要求嚴格度 enum

```typescript
EXACT      // 必須是這個車型
MIN        // 最低需求（可派更高等級）
ANY        // 任意車型
```

### 車牌類型 enum

```typescript
RENTAL     // R 牌（租賃車） — 預設
TAXI       // T 牌（計程車） — 進階選項
```

**業務規則**：
- 派單預設 `allowTaxiPlate = false`，僅派給 R 牌司機
- 派單方主動勾選 `allowTaxiPlate = true` 後，R 牌與 T 牌司機都會收到
- MVP 階段 UI 不暴露此選項，但 schema、後端邏輯、司機 plateType 欄位都先做好

---

## 四、檔案結構

```
src/lib/vehicle/
├── index.ts              # 統一匯出口
├── types.ts              # TypeScript types 與 enum-like const
├── labels.ts             # 中文顯示名稱
├── capacity.ts           # 座位數與行李容量
├── compatibility.ts      # 車型相容性規則（誰能接誰）
├── parser-dictionary.ts  # AI 解析字典（LINE 訊息文字 → 標準代號）
├── normalize.ts          # 將各種輸入 normalize 成標準代號
└── __tests__/            # 單元測試（可選但強烈建議）
    ├── normalize.test.ts
    └── compatibility.test.ts
```

---

## 五、實作步驟

### 步驟 1：建立 types.ts

`src/lib/vehicle/types.ts`：

```typescript
/**
 * 車型代號（單一真理之源）
 *
 * 設計原則：
 * - 大寫 SCREAMING_SNAKE_CASE 與 Prisma enum 一致
 * - 命名包含座位數，未來擴充直觀（例如未來可加 MINIBUS_11）
 * - SUV_5 包含 7 人座 SUV（因 7 人座 SUV 行李空間不足，業務上視為 5 人座）
 * - CUSTOM 用於 VITO / GRANVIA / Alphard 等需自由描述的車款
 */
export const VehicleType = {
  SEDAN_5: 'SEDAN_5',
  SUV_5: 'SUV_5',
  MPV_7: 'MPV_7',
  VAN_9: 'VAN_9',
  CUSTOM: 'CUSTOM',
} as const

export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType]

/** 所有車型的完整列表（按等級由低到高排序） */
export const ALL_VEHICLE_TYPES: readonly VehicleType[] = [
  VehicleType.SEDAN_5,
  VehicleType.SUV_5,
  VehicleType.MPV_7,
  VehicleType.VAN_9,
  VehicleType.CUSTOM,
] as const

/**
 * 派單方對車型的要求嚴格度
 *
 * - EXACT: 必須是這個車型（例：派單 MPV_7，只接受 MPV_7 司機）
 * - MIN:   最低需求，可派更高等級（例：派單 SEDAN_5 但 MIN，SUV_5/MPV_7/VAN_9 都可接）
 * - ANY:   任意車型（最寬鬆，等同於原本的 any）
 */
export const RequirementLevel = {
  EXACT: 'EXACT',
  MIN: 'MIN',
  ANY: 'ANY',
} as const

export type RequirementLevel = (typeof RequirementLevel)[keyof typeof RequirementLevel]

/**
 * 車牌類型
 *
 * - RENTAL: R 牌租賃車（一般情況均派給此類司機）
 * - TAXI:   T 牌計程車（目前法規禁止接機，但保留給未來開放使用；
 *           部分派單方在缺車時會主動勾選接受 T 牌）
 */
export const PlateType = {
  RENTAL: 'RENTAL',
  TAXI: 'TAXI',
} as const

export type PlateType = (typeof PlateType)[keyof typeof PlateType]
```

---

### 步驟 2：建立 labels.ts

`src/lib/vehicle/labels.ts`：

```typescript
import { VehicleType, RequirementLevel, PlateType } from './types'

/** 車型中文顯示名稱（給 UI 與通知文字使用） */
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  [VehicleType.SEDAN_5]: '5 人座',
  [VehicleType.SUV_5]: '5 人座休旅',
  [VehicleType.MPV_7]: '7 人座 MPV',
  [VehicleType.VAN_9]: '9 人座',
  [VehicleType.CUSTOM]: '自訂車款',
}

/** 車型簡短顯示（適合空間小的場合，例如卡片角落、列表） */
export const VEHICLE_LABELS_SHORT: Record<VehicleType, string> = {
  [VehicleType.SEDAN_5]: '5 人',
  [VehicleType.SUV_5]: '休旅',
  [VehicleType.MPV_7]: '7 人',
  [VehicleType.VAN_9]: '9 人',
  [VehicleType.CUSTOM]: '自訂',
}

export const REQUIREMENT_LABELS: Record<RequirementLevel, string> = {
  [RequirementLevel.EXACT]: '指定車型',
  [RequirementLevel.MIN]: '最低需求',
  [RequirementLevel.ANY]: '任意車型',
}

export const PLATE_LABELS: Record<PlateType, string> = {
  [PlateType.RENTAL]: 'R 牌（租賃車）',
  [PlateType.TAXI]: 'T 牌（計程車）',
}

/** 派單方下拉選單選項（按 UI 顯示順序） */
export const VEHICLE_DROPDOWN_OPTIONS = [
  { value: VehicleType.SEDAN_5, label: VEHICLE_LABELS[VehicleType.SEDAN_5] },
  { value: VehicleType.SUV_5, label: VEHICLE_LABELS[VehicleType.SUV_5] },
  { value: VehicleType.MPV_7, label: VEHICLE_LABELS[VehicleType.MPV_7] },
  { value: VehicleType.VAN_9, label: VEHICLE_LABELS[VehicleType.VAN_9] },
  { value: VehicleType.CUSTOM, label: VEHICLE_LABELS[VehicleType.CUSTOM] },
] as const
```

---

### 步驟 3：建立 capacity.ts

`src/lib/vehicle/capacity.ts`：

```typescript
import { VehicleType } from './types'

/**
 * 車型基本規格
 *
 * 注意：CUSTOM 為自訂車款，無法預先得知座位數
 *       （派單方在 Order.customVehicleNote 中自行註明）
 */
export interface VehicleSpec {
  /** 標準座位數 */
  seats: number
  /** 滿座時可載行李數（27 吋大行李箱） */
  luggage: number
  /** 排程演算法用的「車型等級」(數字越大代表越高階) */
  tier: number
}

export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec | null> = {
  [VehicleType.SEDAN_5]: { seats: 5, luggage: 2, tier: 1 },
  [VehicleType.SUV_5]: { seats: 5, luggage: 3, tier: 2 },
  [VehicleType.MPV_7]: { seats: 7, luggage: 4, tier: 3 },
  [VehicleType.VAN_9]: { seats: 9, luggage: 6, tier: 4 },
  [VehicleType.CUSTOM]: null, // 由派單方自填
}

/**
 * 根據人數與行李數，找出可承載的最低車型
 * 排程演算法可呼叫此函式做車型推薦
 */
export function findMinimumVehicleType(
  passengerCount: number,
  luggageCount: number
): VehicleType | null {
  for (const type of [
    VehicleType.SEDAN_5,
    VehicleType.SUV_5,
    VehicleType.MPV_7,
    VehicleType.VAN_9,
  ]) {
    const spec = VEHICLE_SPECS[type]
    if (spec && spec.seats >= passengerCount && spec.luggage >= luggageCount) {
      return type
    }
  }
  return null // 沒有任何車型能容納，需走 CUSTOM
}
```

---

### 步驟 4：建立 compatibility.ts

`src/lib/vehicle/compatibility.ts`：

```typescript
import { VehicleType, RequirementLevel } from './types'
import { VEHICLE_SPECS } from './capacity'

/**
 * 判斷司機是否可以接這張訂單
 *
 * 規則：
 * - EXACT：司機車型必須完全符合訂單車型
 * - MIN：司機車型 tier 須 >= 訂單車型 tier（例：訂單要 SEDAN_5，SUV_5/MPV_7/VAN_9 都可接）
 * - ANY：任何司機車型都可接（除非訂單指定 CUSTOM，CUSTOM 須由派單方手動指派）
 *
 * CUSTOM 處理：
 * - 訂單為 CUSTOM 時，預設不自動派發（需派單方手動選司機）
 * - 司機為 CUSTOM 時，僅能接 CUSTOM 訂單
 */
export function isVehicleCompatible(
  driverVehicle: VehicleType,
  orderVehicle: VehicleType,
  requirement: RequirementLevel
): boolean {
  // CUSTOM 必須完全相等（不參與升降級邏輯）
  if (driverVehicle === VehicleType.CUSTOM || orderVehicle === VehicleType.CUSTOM) {
    return driverVehicle === orderVehicle
  }

  switch (requirement) {
    case RequirementLevel.EXACT:
      return driverVehicle === orderVehicle

    case RequirementLevel.MIN: {
      const driverTier = VEHICLE_SPECS[driverVehicle]?.tier ?? 0
      const orderTier = VEHICLE_SPECS[orderVehicle]?.tier ?? 0
      return driverTier >= orderTier
    }

    case RequirementLevel.ANY:
      return true

    default:
      return false
  }
}

/**
 * 取得指定訂單可派發給的所有合適車型清單
 * 排程演算法可用此函式快速篩選候選司機
 */
export function getCompatibleVehicleTypes(
  orderVehicle: VehicleType,
  requirement: RequirementLevel
): VehicleType[] {
  return [
    VehicleType.SEDAN_5,
    VehicleType.SUV_5,
    VehicleType.MPV_7,
    VehicleType.VAN_9,
    VehicleType.CUSTOM,
  ].filter((driverType) => isVehicleCompatible(driverType, orderVehicle, requirement))
}
```

---

### 步驟 5：建立 parser-dictionary.ts

`src/lib/vehicle/parser-dictionary.ts`：

```typescript
import { VehicleType } from './types'

/**
 * AI 解析字典：LINE 訊息中的各種車型寫法 → 標準代號
 *
 * 使用方式：在 Parser 解析後，將 AI 輸出值丟進 normalizeVehicleType()
 * 此字典涵蓋 Parser 可能輸出的舊代號、中文寫法、品牌型號
 *
 * 維護原則：
 * - 新增 LINE 訊息常見寫法時，加入此字典
 * - 當 AI 輸出新的 vehicle_type 時，務必同步更新
 * - 找不到對應時 normalize 會回傳 null，由呼叫端決定 fallback 策略
 */
export const VEHICLE_PARSER_DICTIONARY: Record<string, VehicleType> = {
  // === 標準新代號（同名映射，用於驗證） ===
  SEDAN_5: VehicleType.SEDAN_5,
  SUV_5: VehicleType.SUV_5,
  MPV_7: VehicleType.MPV_7,
  VAN_9: VehicleType.VAN_9,
  CUSTOM: VehicleType.CUSTOM,

  // === 舊代號相容（從 system A/B/C 過渡） ===
  // 系統 A
  small: VehicleType.SEDAN_5,
  suv: VehicleType.SUV_5,
  van9: VehicleType.VAN_9, // 注意：舊 van9 同時代表 7/9 人座，預設轉 VAN_9
  // 'any', 'any_r', 'pending' 不在此字典 → 由呼叫端處理為「未指定車型」

  // 系統 B（Parser 舊輸出）
  large: VehicleType.VAN_9,
  imported: VehicleType.CUSTOM,
  mercedes_v: VehicleType.CUSTOM,
  g_independent: VehicleType.CUSTOM,

  // 系統 C（Driver 註冊）
  small_sedan: VehicleType.SEDAN_5,
  small_suv: VehicleType.SUV_5,
  van7: VehicleType.MPV_7,

  // === 中文寫法（LINE 訊息常見） ===
  小車: VehicleType.SEDAN_5,
  五人座: VehicleType.SEDAN_5,
  '5人座': VehicleType.SEDAN_5,
  '5人': VehicleType.SEDAN_5,
  轎車: VehicleType.SEDAN_5,
  一般車: VehicleType.SEDAN_5,
  房車: VehicleType.SEDAN_5,

  休旅: VehicleType.SUV_5,
  休旅車: VehicleType.SUV_5,
  '5人座休旅': VehicleType.SUV_5,
  小休旅: VehicleType.SUV_5,
  福祉車: VehicleType.SUV_5, // 多數福祉車為 5 人座休旅改裝

  '7人座': VehicleType.MPV_7,
  七人座: VehicleType.MPV_7,
  '7人': VehicleType.MPV_7,
  MPV: VehicleType.MPV_7,
  mpv: VehicleType.MPV_7,

  '9人座': VehicleType.VAN_9,
  九人座: VehicleType.VAN_9,
  '9人': VehicleType.VAN_9,
  廂型車: VehicleType.VAN_9,
  商旅車: VehicleType.VAN_9,
  van: VehicleType.VAN_9,
  Van: VehicleType.VAN_9,
  VAN: VehicleType.VAN_9,

  // === 品牌型號（一律歸 CUSTOM，車款名稱由呼叫端寫入 customVehicleNote） ===
  Sienna: VehicleType.CUSTOM,
  sienna: VehicleType.CUSTOM,
  Alphard: VehicleType.CUSTOM,
  alphard: VehicleType.CUSTOM,
  ALPHARD: VehicleType.CUSTOM,
  Vellfire: VehicleType.CUSTOM,
  VITO: VehicleType.CUSTOM,
  Vito: VehicleType.CUSTOM,
  vito: VehicleType.CUSTOM,
  GRANVIA: VehicleType.CUSTOM,
  Granvia: VehicleType.CUSTOM,
  granvia: VehicleType.CUSTOM,
  Hiace: VehicleType.CUSTOM, // 雖然 Hiace 多為 9 人座，但若被特別點名屬高階指定
  賓士V: VehicleType.CUSTOM,
  賓士v: VehicleType.CUSTOM,
}

/**
 * 已知的「未指定」標記（API 應將這些值轉為 null + ANY 要求）
 */
export const UNSPECIFIED_VEHICLE_MARKERS = ['any', 'any_r', 'pending', '任意', '任意車', '任意R', '不限', '都可'] as const
```

---

### 步驟 6：建立 normalize.ts

`src/lib/vehicle/normalize.ts`：

```typescript
import { VehicleType, RequirementLevel } from './types'
import {
  VEHICLE_PARSER_DICTIONARY,
  UNSPECIFIED_VEHICLE_MARKERS,
} from './parser-dictionary'

export interface NormalizedVehicle {
  /** 標準車型代號（null = 派單方未指定） */
  vehicleType: VehicleType | null
  /** 派單方要求嚴格度 */
  requirement: RequirementLevel
  /** 若為 CUSTOM，車款描述（由原始輸入字串轉錄） */
  customVehicleNote: string | null
}

/**
 * 將任意輸入字串 normalize 為標準車型結構
 *
 * 處理邏輯：
 * 1. 空字串 / null / undefined → 未指定（ANY）
 * 2. 命中「未指定」標記（any/any_r/pending/任意…） → 未指定（ANY）
 * 3. 命中字典 → 標準代號（CUSTOM 時保留原字串為 customVehicleNote）
 * 4. 都不符合 → 視為 CUSTOM，原字串存入 customVehicleNote
 *
 * 此函式為 idempotent（多次呼叫結果相同）
 */
export function normalizeVehicleInput(input: string | null | undefined): NormalizedVehicle {
  // 空值 → 未指定
  if (!input || input.trim() === '') {
    return { vehicleType: null, requirement: RequirementLevel.ANY, customVehicleNote: null }
  }

  const trimmed = input.trim()

  // 「未指定」標記
  if (UNSPECIFIED_VEHICLE_MARKERS.includes(trimmed as any)) {
    return { vehicleType: null, requirement: RequirementLevel.ANY, customVehicleNote: null }
  }

  // 字典查詢（先精確比對，再嘗試部分比對）
  const exactMatch = VEHICLE_PARSER_DICTIONARY[trimmed]
  if (exactMatch) {
    return {
      vehicleType: exactMatch,
      requirement: RequirementLevel.EXACT,
      customVehicleNote: exactMatch === VehicleType.CUSTOM ? trimmed : null,
    }
  }

  // 部分比對（包含關鍵字）
  for (const [keyword, type] of Object.entries(VEHICLE_PARSER_DICTIONARY)) {
    if (trimmed.includes(keyword)) {
      return {
        vehicleType: type,
        requirement: RequirementLevel.EXACT,
        customVehicleNote: type === VehicleType.CUSTOM ? trimmed : null,
      }
    }
  }

  // 完全不認識 → CUSTOM（保留原字串）
  return {
    vehicleType: VehicleType.CUSTOM,
    requirement: RequirementLevel.EXACT,
    customVehicleNote: trimmed,
  }
}

/**
 * 從 Parser 輸出 normalize 為標準結構
 * （Parser 已輸出結構化資料，此函式做最終驗證與轉換）
 */
export function normalizeParserOutput(parserOutput: {
  vehicle_type?: string | null
}): NormalizedVehicle {
  return normalizeVehicleInput(parserOutput.vehicle_type)
}
```

---

### 步驟 7：建立 index.ts（統一匯出口）

`src/lib/vehicle/index.ts`：

```typescript
/**
 * gogmo 車型系統統一入口
 *
 * 使用原則：
 * - 所有車型相關邏輯一律從此模組 import
 * - 嚴禁在其他檔案中硬編碼車型字串（'small', '5人座' 等）
 * - 新增車型相關功能時，先在此模組擴充，再供他處使用
 */

// Types & enums
export {
  VehicleType,
  RequirementLevel,
  PlateType,
  ALL_VEHICLE_TYPES,
} from './types'

// Display labels
export {
  VEHICLE_LABELS,
  VEHICLE_LABELS_SHORT,
  REQUIREMENT_LABELS,
  PLATE_LABELS,
  VEHICLE_DROPDOWN_OPTIONS,
} from './labels'

// Specs & capacity
export {
  VEHICLE_SPECS,
  findMinimumVehicleType,
  type VehicleSpec,
} from './capacity'

// Compatibility logic
export {
  isVehicleCompatible,
  getCompatibleVehicleTypes,
} from './compatibility'

// AI parser dictionary
export {
  VEHICLE_PARSER_DICTIONARY,
  UNSPECIFIED_VEHICLE_MARKERS,
} from './parser-dictionary'

// Input normalization
export {
  normalizeVehicleInput,
  normalizeParserOutput,
  type NormalizedVehicle,
} from './normalize'
```

---

### 步驟 8（可選但強烈建議）：建立單元測試

`src/lib/vehicle/__tests__/normalize.test.ts`：

```typescript
import { describe, it, expect } from 'vitest' // 或 jest
import { normalizeVehicleInput } from '../normalize'
import { VehicleType, RequirementLevel } from '../types'

describe('normalizeVehicleInput', () => {
  it('空值回傳未指定', () => {
    expect(normalizeVehicleInput('')).toEqual({
      vehicleType: null,
      requirement: RequirementLevel.ANY,
      customVehicleNote: null,
    })
    expect(normalizeVehicleInput(null)).toEqual({
      vehicleType: null,
      requirement: RequirementLevel.ANY,
      customVehicleNote: null,
    })
  })

  it('「任意R」轉為未指定', () => {
    const result = normalizeVehicleInput('任意R')
    expect(result.vehicleType).toBeNull()
    expect(result.requirement).toBe(RequirementLevel.ANY)
  })

  it('舊代號 small 轉為 SEDAN_5', () => {
    expect(normalizeVehicleInput('small').vehicleType).toBe(VehicleType.SEDAN_5)
  })

  it('舊代號 small_suv 轉為 SUV_5', () => {
    expect(normalizeVehicleInput('small_suv').vehicleType).toBe(VehicleType.SUV_5)
  })

  it('舊代號 van7 轉為 MPV_7', () => {
    expect(normalizeVehicleInput('van7').vehicleType).toBe(VehicleType.MPV_7)
  })

  it('中文「7人座」轉為 MPV_7', () => {
    expect(normalizeVehicleInput('7人座').vehicleType).toBe(VehicleType.MPV_7)
  })

  it('Alphard 轉為 CUSTOM 並保留車款名稱', () => {
    const result = normalizeVehicleInput('Alphard')
    expect(result.vehicleType).toBe(VehicleType.CUSTOM)
    expect(result.customVehicleNote).toBe('Alphard')
  })

  it('完全未知的字串視為 CUSTOM', () => {
    const result = normalizeVehicleInput('Tesla Model X 6 人座')
    expect(result.vehicleType).toBe(VehicleType.CUSTOM)
    expect(result.customVehicleNote).toBe('Tesla Model X 6 人座')
  })
})
```

`src/lib/vehicle/__tests__/compatibility.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { isVehicleCompatible } from '../compatibility'
import { VehicleType, RequirementLevel } from '../types'

describe('isVehicleCompatible', () => {
  describe('EXACT 模式', () => {
    it('完全符合時可接', () => {
      expect(
        isVehicleCompatible(VehicleType.MPV_7, VehicleType.MPV_7, RequirementLevel.EXACT)
      ).toBe(true)
    })

    it('不符合時不可接', () => {
      expect(
        isVehicleCompatible(VehicleType.SEDAN_5, VehicleType.MPV_7, RequirementLevel.EXACT)
      ).toBe(false)
    })
  })

  describe('MIN 模式', () => {
    it('司機車型較高時可接', () => {
      expect(
        isVehicleCompatible(VehicleType.MPV_7, VehicleType.SEDAN_5, RequirementLevel.MIN)
      ).toBe(true)
    })

    it('司機車型較低時不可接', () => {
      expect(
        isVehicleCompatible(VehicleType.SEDAN_5, VehicleType.MPV_7, RequirementLevel.MIN)
      ).toBe(false)
    })
  })

  describe('ANY 模式', () => {
    it('任何車型都可接', () => {
      expect(
        isVehicleCompatible(VehicleType.SEDAN_5, VehicleType.VAN_9, RequirementLevel.ANY)
      ).toBe(true)
    })
  })

  describe('CUSTOM 模式', () => {
    it('CUSTOM 訂單僅 CUSTOM 司機可接', () => {
      expect(
        isVehicleCompatible(VehicleType.CUSTOM, VehicleType.CUSTOM, RequirementLevel.EXACT)
      ).toBe(true)
      expect(
        isVehicleCompatible(VehicleType.MPV_7, VehicleType.CUSTOM, RequirementLevel.ANY)
      ).toBe(false)
    })
  })
})
```

執行測試：

```bash
npm run test -- src/lib/vehicle
```

---

## 六、驗收標準

完成本階段後，以下檢查必須全部通過：

### 6.1 檔案結構檢查

```bash
ls -la src/lib/vehicle/
```

必須包含：`index.ts`, `types.ts`, `labels.ts`, `capacity.ts`, `compatibility.ts`, `parser-dictionary.ts`, `normalize.ts`

### 6.2 TypeScript 編譯檢查

```bash
npx tsc --noEmit
```

不可有任何 error。

### 6.3 Build 檢查

```bash
npm run build
```

必須成功（因為純新增模組，理論上不會影響原有 build）。

### 6.4 模組可被 import

在任何檔案測試引用：

```typescript
import { VehicleType, normalizeVehicleInput } from '@/lib/vehicle'
```

不可有 import error。

### 6.5 單元測試（若已建立）

```bash
npm run test -- src/lib/vehicle
```

所有測試通過。

### 6.6 既有功能無影響

```bash
npm run dev
```

啟動後實際測試派單流程、司機端，確認**完全沒有任何行為變化**（因為本階段不修改任何現有檔案）。

---

## 七、Git Commit 規劃

本階段建議分為 2 個 commit：

```
feat(vehicle): add unified vehicle module with types, labels, and compatibility

  - Add src/lib/vehicle/ as single source of truth for vehicle logic
  - Define VehicleType enum: SEDAN_5, SUV_5, MPV_7, VAN_9, CUSTOM
  - Define RequirementLevel: EXACT, MIN, ANY
  - Define PlateType: RENTAL, TAXI
  - Add labels, capacity specs, compatibility rules
  - Add parser dictionary for AI output normalization
  - Add normalizeVehicleInput() for unified input handling
  - No changes to existing code (zero-risk addition)

test(vehicle): add unit tests for normalize and compatibility logic
```

---

## 八、給 Claude Code 的執行指令

請把這份 spec 完整貼給 Claude Code，並加上以下指令：

```
請依照 VEHICLE_PHASE1_FOUNDATION.md 的內容，建立 src/lib/vehicle/ 模組。

要求：
1. 嚴格按照步驟 1-7 順序建立檔案，內容直接從 spec 複製
2. 步驟 8 的單元測試請建立（如專案無測試框架，先 skip 並回報）
3. 建立完成後執行：
   - npx tsc --noEmit  確認 TypeScript 無錯誤
   - npm run build      確認 production build 成功
4. 不可修改 src/lib/vehicle/ 以外的任何檔案
5. 完成後 commit 並回報：
   - 建立的檔案清單
   - tsc/build 結果
   - 測試結果（若有建立）
6. 回報後等我確認，我會接著執行 Phase 2 的 spec
```

---

## 九、Phase 2 預告

Phase 1 完成後，Phase 2 會進行：

- Prisma schema 改動 + migration（含 SQL 範例）
- API 白名單改用新模組
- Parser 輸出改走 normalize
- 排程 isVehicleCompatible 改寫
- 所有前端元件改從 `@/lib/vehicle` import

**Phase 2 是有風險的階段**（會動到 DB 與多處檔案），需逐步進行。但因為 Phase 1 已準備好所有工具，Phase 2 的改動會清晰許多。
