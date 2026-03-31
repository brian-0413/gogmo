// AI Order Parsing Utility
// 只解析五個關鍵欄位：日期、時間、種類、起點、終點
// 其餘全部保留原文至備註欄位
// 地點邏輯（依使用者需求）：
//   - 接機：起點=○機（外層決定），終點=訊息中的地點
//   - 送機：起點=訊息中的地點，終點=○機（外層決定）

export type OrderType = 'pickup' | 'dropoff' | 'transfer' | 'charter' | 'pending'
export type VehicleType = 'small' | 'suv' | 'van9' | 'any' | 'any_r' | 'pending'
export type PlateType = 'R' | 'T' | 'any'

export interface ParsedOrder {
  date: string | null       // "3/28" 格式，相對日期
  time: string | null       // "23:10" 或 "05:00"
  type: OrderType
  vehicle: VehicleType
  plateType: PlateType
  price: number | null
  notes: string              // 所有未解析的內容（含地點）
  rawText: string            // 原始行文字
  pickupLocation?: string
  dropoffLocation?: string
}

export interface BatchOrderDefaults {
  price?: number
  vehicle?: VehicleType
  plateType?: PlateType
  date?: string
  type?: OrderType
  kenichiRequired?: boolean
  flightNumber?: string
}

// ============ 機場關鍵字 ============
const AIRPORT_PATTERNS: Array<{ keyword: string; airport: string }> = [
  { keyword: '桃園國際機場', airport: '桃園國際機場' },
  { keyword: '桃園機場', airport: '桃園國際機場' },
  { keyword: '桃機', airport: '桃園國際機場' },
  { keyword: 'TPE', airport: '桃園國際機場' },
  { keyword: '松山國際機場', airport: '松山國際機場' },
  { keyword: '松山機場', airport: '松山國際機場' },
  { keyword: '松機', airport: '松山國際機場' },
  { keyword: 'TSA', airport: '松山國際機場' },
  { keyword: '高雄國際機場', airport: '高雄國際機場' },
  { keyword: '高雄機場', airport: '高雄國際機場' },
  { keyword: '小港', airport: '高雄國際機場' },
  { keyword: 'KHH', airport: '高雄國際機場' },
  { keyword: '清泉崗', airport: '清泉崗機場' },
  { keyword: '台中機場', airport: '清泉崗機場' },
  { keyword: 'RMQ', airport: '清泉崗機場' },
]

function findAirport(str: string): { keyword: string; airport: string } | null {
  for (const p of AIRPORT_PATTERNS) {
    if (str.includes(p.keyword)) return p
  }
  return null
}

// ============ 時間解析 ============
function extractTime(line: string): string | null {
  // HH:MM 格式
  const hmMatch = line.match(/(\d{1,2}):(\d{2})(?!\d)/)
  if (hmMatch) {
    const h = parseInt(hmMatch[1])
    const m = parseInt(hmMatch[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
  }

  // HHMM 格式（行首）
  const hmmMatch = line.match(/^(\d{4})/)
  if (hmmMatch) {
    const h = parseInt(hmmMatch[1].substring(0, 2))
    const m = parseInt(hmmMatch[1].substring(2, 4))
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
  }

  return null
}

// ============ 金額解析 ============
function extractPrice(line: string): number | null {
  const dollarMatch = line.match(/[$💲](\d+)/)
  if (dollarMatch) return parseInt(dollarMatch[1], 10)

  const endNumMatch = line.match(/(\d{3,})$/)
  if (endNumMatch) return parseInt(endNumMatch[1], 10)

  return null
}

// ============ 車型解析 ============
function extractVehicle(line: string): { vehicle: VehicleType; plateType: PlateType } {
  if (line.includes('9人') || line.includes('九人') || line.match(/van9/i)) {
    return { vehicle: 'van9', plateType: 'any' }
  }
  if (line.includes('休旅') || line.match(/suv/i)) {
    if (line.match(/any.?r/i) || line.includes('任意R') || line.includes('任R')) {
      return { vehicle: 'any_r', plateType: 'R' }
    }
    return { vehicle: 'suv', plateType: 'any' }
  }
  if (line.includes('小車') || line.includes('轎車')) {
    return { vehicle: 'small', plateType: 'any' }
  }
  if (line.includes('任意') || line.includes('不限') || line.match(/any/i)) {
    return { vehicle: 'any', plateType: 'any' }
  }
  if (line.match(/\/R\b/) || line.includes('R牌')) {
    return { vehicle: 'any', plateType: 'R' }
  }
  if (line.match(/\/T\b/) || line.includes('T牌')) {
    return { vehicle: 'any', plateType: 'T' }
  }
  return { vehicle: 'any', plateType: 'any' }
}

// ============ 種類解析 ============
// 規則（有明確優先順序）：
// 1. 有「接」→ 接機（pickup）
// 2. 有「送」→ 送機（dropoff）
// 3. 「○機到X」→ 接機（機場在前、地點在後）
// 4. 「X到○機」→ 送機（地點在前、機場在後）
function extractType(line: string): OrderType {
  // 「接」→ 接機
  if (line.includes('接')) {
    const after = line.split('接').slice(1).join('接').trim()
    if (after) return 'pickup'
  }

  // 「送」→ 送機
  if (line.includes('送')) {
    return 'dropoff'
  }

  // 「○機到X」（機場在前、地點在後）→ 接機
  // 例如「桃機到台中南屯」
  const airportBefore = findAirport(line.split('到')[0] || '')
  if (airportBefore && line.includes('到')) {
    return 'pickup'
  }

  // 「X到○機」（地點在前、機場在後）→ 送機
  // 例如「台中南屯到桃機」
  const airportAfter = findAirport(line)
  if (airportAfter && line.includes('到')) {
    return 'dropoff'
  }

  // 交通接駁
  if (line.includes('交通接駁') || line.includes('上-') || line.includes('下-')) {
    return 'transfer'
  }

  // 包車
  if (line.includes('包車') || line.includes('時租')) return 'charter'

  return 'pending'
}

// ============ 批次解析 ============
export function parseBatchOrders(
  text: string,
  defaults: BatchOrderDefaults
): ParsedOrder[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  const results: ParsedOrder[] = []

  // 標題行繼承：累積的預設值（可被後續標題行覆蓋）
  let inheritedDefaults = { ...defaults }

  for (const line of lines) {
    // ========== 標題行偵測 ==========
    const hasTime = /^\d{4}/.test(line) || /\d{1,2}:\d{2}/.test(line)
    const hasActionKeyword = /[接送]/.test(line) || line.includes('到')
    const hasVehicleKeyword = /[休旅]|大車|小車|任意|9座/i.test(line)

    if (!hasTime && !hasActionKeyword && hasVehicleKeyword) {
      const { vehicle, plateType } = extractVehicle(line)
      if (vehicle !== 'any') inheritedDefaults = { ...inheritedDefaults, vehicle }
      if (plateType !== 'any') inheritedDefaults = { ...inheritedDefaults, plateType }
      continue
    }

    // ========== 跳過空行 ==========
    if (!line) continue

    // ========== 基本解析 ==========
    const time = extractTime(line)
    const price = extractPrice(line)
    const { vehicle, plateType } = extractVehicle(line)
    let type = extractType(line)

    // 套用 UI 預設種類（最高優先）
    if (inheritedDefaults.type && inheritedDefaults.type !== 'pending') {
      type = inheritedDefaults.type
    }

    // 套用 inheritedDefaults 車型/車牌/金額
    let v = vehicle
    let pt = plateType
    if (v === 'any' && inheritedDefaults.vehicle) v = inheritedDefaults.vehicle
    if (pt === 'any' && inheritedDefaults.plateType) pt = inheritedDefaults.plateType
    let px = price
    if (px === null && inheritedDefaults.price) px = inheritedDefaults.price

    // ========== 組合 notes（只移除時間和金額） ==========
    let notes = line
    if (time) {
      notes = notes.replace(/^\d{4}/, '').trim()
    }
    if (price !== null) {
      notes = notes.replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').trim()
    }
    notes = notes.replace(/[\[\]【】()（）]/g, '').trim()

    // ========== 設定接送地點 ==========
    // 接機：起點=○機（外層決定），終點=訊息中的地點
    // 送機：起點=訊息中的地點，終點=○機（外層決定）
    let pickupLocation: string | undefined
    let dropoffLocation: string | undefined

    // 先從訊息找明確的機場關鍵字（作為參考）
    const airportInLine = findAirport(line)

    if (type === 'pickup') {
      // 接機：終點從訊息提取（「接」後面的內容）
      pickupLocation = airportInLine?.airport || '桃園國際機場'
      if (line.includes('接')) {
        const parts = line.split('接')
        const after = parts.slice(1).join('接').trim()
        dropoffLocation = after.replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】()（）]/g, '').trim() || undefined
      }
    } else if (type === 'dropoff') {
      // 送機：起點從訊息提取（「送」前面的內容）
      dropoffLocation = airportInLine?.airport || '桃園國際機場'
      if (line.includes('送')) {
        const sendIdx = line.indexOf('送')
        const before = line.substring(0, sendIdx).trim()
          .replace(/^\d{4}/, '')
          .replace(/[$💲]\d+/, '')
          .replace(/\d{3,}$/, '')
          .replace(/[\[\]【】()（）]/g, '')
          .trim()
        pickupLocation = before || undefined
      }
      // 「X到○機」格式
      if (line.includes('到') && airportInLine) {
        const parts = line.split('到')
        const before = parts[0].trim()
          .replace(/^\d{4}/, '')
          .replace(/[$💲]\d+/, '')
          .replace(/\d{3,}$/, '')
          .replace(/[\[\]【】()（）]/g, '')
          .trim()
        if (before) pickupLocation = before
        dropoffLocation = airportInLine.airport
      }
    } else if (type === 'transfer') {
      // 交通接駁：上-為起點，下-為終點
      const upMatch = line.match(/上[_-](.+)/)
      const downMatch = line.match(/下[_-](.+)/)
      if (upMatch) pickupLocation = upMatch[1].trim()
      if (downMatch) dropoffLocation = downMatch[1].trim()
    }

    // ========== 清理 notes ==========
    // 移除行首接送關鍵字
    notes = notes.replace(/^[接送]/g, '').trim()
    // 移除行尾「送」關鍵字（例：「三重送」→ 只留「三重」）
    notes = notes.replace(/[送]$/, '').trim()
    // 移除「到」關鍵字
    notes = notes.replace(/到/g, ' ')
    // 移除「○機」機場關鍵字
    notes = notes.replace(/桃機|桃園|松機|TSA|小港|KHH|清泉崗|RMQ|機場/g, '')
    notes = notes.replace(/\s+/g, ' ').trim()

    // ========== 產出結果 ==========
    if (time) {
      results.push({
        date: defaults.date || null,
        time,
        type,
        vehicle: v,
        plateType: pt,
        price: px,
        notes,
        rawText: line,
        pickupLocation,
        dropoffLocation,
      })
    }
  }

  return results
}

// ============ 舊版 API 相容性 ============
export interface LegacyParsedOrder {
  passengerName?: string
  passengerPhone?: string
  flightNumber?: string
  pickupLocation?: string
  pickupAddress?: string
  dropoffLocation?: string
  dropoffAddress?: string
  passengerCount?: number
  luggageCount?: number
  scheduledTime?: string
  scheduledDate?: string
  price?: number
  note?: string
  rawText?: string
  orderType?: 'pickup' | 'dropoff'
}

// 舊版 parseOrderText（保留相容性）
export function parseOrderText(rawText: string): LegacyParsedOrder {
  const result: LegacyParsedOrder = {}

  const lines = rawText.split(/[\n,，;；]+/).map(l => l.trim()).filter(Boolean)
  const fullText = rawText.replace(/[\n,，;；]/g, ' ')

  // Extract flight number
  const flightMatches = [...fullText.matchAll(/([A-Z]{2})\s*(\d{3,4})/gi)]
  if (flightMatches.length > 0) {
    result.flightNumber = flightMatches[0][0].toUpperCase().replace(/\s/g, '')
  }

  // Extract phone number
  const phoneMatches = [...fullText.matchAll(/(?:09|8869|\+886)[0-9]{8,9}/g)]
  if (phoneMatches.length > 0) {
    result.passengerPhone = phoneMatches[0][0].replace(/\+886/, '0')
  }

  // Extract passenger count
  const countMatch = fullText.match(/(?:共?|總共?|大約)?\s*(\d+)\s*(?:位|人|名|大人|小孩)/i)
  if (countMatch) {
    result.passengerCount = parseInt(countMatch[1], 10)
  }

  // Extract time
  const timeMatch = fullText.match(/(\d{1,2})[\/:](\d{2})\s*(?:AM|PM|上午|下午|點|時)?/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const isPM = fullText.match(/PM|下午|點/i)
    if (isPM && hours < 12) hours += 12
    if (!isPM && hours === 12) hours = 0
    result.scheduledTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Extract price
  const priceMatch = fullText.match(/(?:價格?|費用?|價錢?|收費?|多少|元)\s*[：:：]?\s*(\d+)/i)
    || fullText.match(/\$(\d+)/)
  if (priceMatch) {
    result.price = parseInt(priceMatch[1], 10)
  }

  // Extract note
  const noteMatch = rawText.match(/備註[：:：]?\s*(.+)/i)
    || rawText.match(/\(([^)]+)\)/)
  if (noteMatch) {
    result.note = noteMatch[1].trim()
  }

  return result
}

// Validate parsed order has required fields
export function validateParsedOrder(order: ParsedOrder): { valid: boolean; missingFields: string[] } {
  const requiredFields = ['time', 'pickupLocation', 'dropoffLocation']
  const missingFields: string[] = []

  for (const field of requiredFields) {
    if (!order[field as keyof ParsedOrder]) {
      missingFields.push(field)
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  }
}

// 車型顯示用
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  small: '小車',
  suv: '休旅車',
  van9: '9人座',
  any: '任意車型',
  any_r: '任意R牌',
  pending: '待確認',
}

export const TYPE_LABELS: Record<OrderType, string> = {
  pickup: '接機',
  dropoff: '送機',
  transfer: '接駁',
  charter: '包車',
  pending: '待確認',
}

export const PLATETYPE_LABELS: Record<PlateType, string> = {
  R: 'R牌',
  T: 'T牌',
  any: '任意',
}
