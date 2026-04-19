import { VehicleType } from './types'

/**
 * AI 解析字典：LINE 訊息中的各種車型寫法 → 標準代號
 *
 * 使用方式：在 Parser 解析後，將 AI 輸出值丟進 normalizeVehicleType()
 * 此字典涵蓋 Parser 可能輸出的舊代號、中文寫法，品牌型號
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
