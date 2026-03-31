// AI Order Parsing Utility
// 以 regex 為主，精確提取五個關鍵欄位（日期/時間/種類/車型/金額）
// 其餘全部保留原文至備註欄位

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
  notes: string              // 所有未解析的內容
  rawText: string            // 原始行文字
  // 地點（由外層補全）
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

/** 從文字中找出第一個機場關鍵字及其名稱 */
function findAirport(str: string): { keyword: string; airport: string } | null {
  for (const p of AIRPORT_PATTERNS) {
    if (str.includes(p.keyword)) return p
  }
  return null
}

/** 從文字中移除所有機場關鍵字 */
function removeAirportKeywords(str: string): string {
  let result = str
  for (const p of AIRPORT_PATTERNS) {
    result = result.replace(new RegExp(p.keyword, 'g'), '')
  }
  return result
}

/** 從文字開頭移除接送/機場標記，回傳剩餘內容 */
function removeLocationMarkers(str: string): string {
  return str
    .replace(/^(接機|桃機接|送機|送桃機|桃機到|桃機 到|松機到|松機 到|小港到|小港 到|清泉崗到|清泉崗 到)/, '')
    .replace(/^(機場接|機場到|機場送)/, '')
    .replace(/\/.*$/g, '') // 移除 / 後面的車型標記
    .trim()
}

// ============ 時間解析 ============
function extractTime(line: string): string | null {
  // 1. HH:MM 格式
  const hmMatch = line.match(/(\d{1,2}):(\d{2})(?!\d)/)
  if (hmMatch) {
    const h = parseInt(hmMatch[1])
    const m = parseInt(hmMatch[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
  }

  // 2. HHMM 格式（行首）
  const hmmMatch = line.match(/^(\d{4})/)
  if (hmmMatch) {
    const h = parseInt(hmmMatch[1].substring(0, 2))
    const m = parseInt(hmmMatch[1].substring(2, 4))
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
  }

  // 3. 單獨時分格式 "5:00" / "05:00"
  const singleTime = line.match(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/)
  if (singleTime) {
    const h = parseInt(singleTime[1])
    const m = parseInt(singleTime[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
  }

  return null
}

// ============ 金額解析 ============
function extractPrice(line: string): number | null {
  // $數字、💲數字、結尾數字
  const dollarMatch = line.match(/[$💲](\d+)/)
  if (dollarMatch) return parseInt(dollarMatch[1], 10)

  // 句尾純數字（至少3位，避免誤抓時間）
  const endNumMatch = line.match(/(\d{3,})$/)
  if (endNumMatch) return parseInt(endNumMatch[1], 10)

  return null
}

// ============ 車型解析 ============
function extractVehicle(line: string): { vehicle: VehicleType; plateType: PlateType } {
  const vehicleLower = line.toLowerCase

  // 車型關鍵字
  if (line.includes('9人') || line.includes('九人') || line.includes('VAN') || line.match(/van9/i)) {
    return { vehicle: 'van9', plateType: 'any' }
  }
  if (line.includes('休旅') || line.match(/suv/i)) {
    // 任意R = 車牌R開頭的休旅車
    if (line.includes('任意R') || line.includes('任R') || line.match(/any.?r/i)) {
      return { vehicle: 'any_r', plateType: 'R' }
    }
    return { vehicle: 'suv', plateType: 'any' }
  }
  if (line.includes('小車') || line.includes('轎車') || line.match(/\/小\b|\/轎\b/)) {
    return { vehicle: 'small', plateType: 'any' }
  }
  if (line.includes('任意') || line.includes('不限') || line.match(/any|隨便/i)) {
    return { vehicle: 'any', plateType: 'any' }
  }

  // 車牌類型單獨出現
  if (line.includes('R牌') || line.includes('R牌') || line.match(/\/R\b/)) {
    return { vehicle: 'any', plateType: 'R' }
  }
  if (line.includes('T牌') || line.match(/\/T\b/)) {
    return { vehicle: 'any', plateType: 'T' }
  }

  return { vehicle: 'any', plateType: 'any' }
}

// ============ 種類解析 ============
// 根據文件「種類判斷優先順序」，實作五種格式模式
function extractType(line: string): OrderType {
  // 模式 A：「機場關鍵字 + 到 + 地點」→ 接機
  if (findAirport(line)) {
    if (/桃機.*到|桃園.*到|松機.*到|小港.*到|清泉崗.*到/i.test(line)) return 'pickup'
    if (/機場.*到/i.test(line)) return 'pickup'
  }

  // 模式 B：「地點 + 到 + 機場關鍵字」→ 送機
  if (/到.*桃機|到.*桃園|到.*松機|到.*TSA|到.*小港|到.*KHH|到.*清泉崗/i.test(line)) return 'dropoff'

  // 模式 D2：「送機 + 時間 + 地點-機場」→ 送機
  if (/送機\s*\d|送機.*[到-].*機/i.test(line)) return 'dropoff'

  // 模式 C：「接 + 地點」（如「接土城」「接機北屯」）→ 接機
  if (line.includes('接')) {
    const after = line.split('接').slice(1).join('接').trim()
    // 「接」後面是中文字 → 接機
    if (after) return 'pickup'
  }

  // 模式 D2：「送機 + 時間 + 地點-機場」→ 送機
  if (/送機\s*\d|送機.*[到-].*機/i.test(line)) return 'dropoff'

  // 模式 D：「地點 + 送」（不一定有「機」）→ 送機
  // 例如「南港送」「板橋送」「彰化市送」「彰化市送桃機」
  if (line.includes('送')) {
    const sendIdx = line.indexOf('送')
    const after = line.substring(sendIdx + 1)
    // 「送」後面若不是中文字（可能是標點、數字、空）→ 送機
    if (!/[\u4e00-\u9fff]/.test(after)) return 'dropoff'
    // 否則「送」後面若含有機場關鍵字 → 送機
    if (findAirport(after)) return 'dropoff'
  }

  // 模式 E：交通接駁
  if (line.includes('交通接駁') || line.includes('上-') || line.includes('下-') || line.includes('上:') || line.includes('下:')) return 'transfer'

  // 包車
  if (line.includes('包車') || line.includes('時租')) return 'charter'

  return 'pending'
}

// ============ 日期解析 ============
function extractDate(line: string, defaultDate: string): string | null {
  // M/D 格式
  const mdMatch = line.match(/(\d{1,2})\/(\d{1,2})/)
  if (mdMatch) {
    return `${mdMatch[1]}/${mdMatch[2]}`
  }

  // 今天/明天
  if (line.includes('今天') || line.includes('今日')) return 'today'
  if (line.includes('明天') || line.includes('明日')) return 'tomorrow'

  return null
}

// ============ 單行解析 ============
function parseSingleLine(line: string, defaults: BatchOrderDefaults): ParsedOrder {
  const trimmed = line.trim()
  if (!trimmed) {
    return {
      date: null, time: null, type: 'pending',
      vehicle: defaults.vehicle || 'any', plateType: defaults.plateType || 'any',
      price: null, notes: '', rawText: '',
    }
  }

  const time = extractTime(trimmed)
  const price = extractPrice(trimmed)
  const { vehicle, plateType } = extractVehicle(trimmed)
  const type = extractType(trimmed)
  const date = extractDate(trimmed, defaults.date || '')

  // 組合備註：移除已解析的部分，保留原文
  let notes = trimmed

  // 移除已提取的時間
  if (time) {
    if (notes.match(/^\d{4}/)) {
      notes = notes.replace(/^\d{4}/, '').trim()
    } else {
      notes = notes.replace(/\d{1,2}:\d{2}/, '').trim()
    }
  }

  // 移除已提取的金額
  if (price !== null) {
    notes = notes.replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').trim()
  }

  // 移除日期
  if (date && date !== 'today' && date !== 'tomorrow') {
    notes = notes.replace(/\d{1,2}\/\d{1,2}/, '').trim()
  }

  // 移除常見標記
  notes = notes.replace(/[\[\]【】()（）]/g, '').trim()

  return {
    date,
    time,
    type,
    vehicle,
    plateType,
    price,
    notes,
    rawText: trimmed,
  }
}

// ============ 批次解析 ============
export function parseBatchOrders(
  text: string,
  defaults: BatchOrderDefaults
): ParsedOrder[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  const results: ParsedOrder[] = []
  let lastDate: string | null = null

  // 標題行繼承：累積的預設值（可被後續標題行覆蓋）
  let inheritedDefaults = { ...defaults }

  for (const line of lines) {
    const parsed = parseSingleLine(line, inheritedDefaults)

    // 標題行偵測：沒有時間、沒有接送關鍵字、但有車型關鍵字
    const hasActionKeyword = /[接送]|到/.test(line)
    const hasVehicleKeyword = /[休旅]|大車|小車|任意|9座/i.test(line)
    const hasTime = parsed.time !== null

    if (!hasTime && !hasActionKeyword && hasVehicleKeyword) {
      // 這是標題行：更新 inheritedDefaults，不寫入 results
      if (parsed.vehicle !== 'any') {
        inheritedDefaults = { ...inheritedDefaults, vehicle: parsed.vehicle }
      }
      if (parsed.plateType !== 'any') {
        inheritedDefaults = { ...inheritedDefaults, plateType: parsed.plateType }
      }
      continue
    }

    // 跨行日期邏輯：如果這行有日期，則更新 lastDate
    if (parsed.date === 'today') {
      lastDate = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
    } else if (parsed.date === 'tomorrow') {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      lastDate = d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
    } else if (parsed.date) {
      lastDate = parsed.date
    }

    // 套用 inheritedDefaults 中的預設值（標題行設定）
    if (parsed.vehicle === 'any' && inheritedDefaults.vehicle) {
      parsed.vehicle = inheritedDefaults.vehicle
    }
    if (parsed.plateType === 'any' && inheritedDefaults.plateType) {
      parsed.plateType = inheritedDefaults.plateType
    }

    // 套用 UI 預設種類（最高優先，車頭選擇後覆蓋標題行）
    if (inheritedDefaults.type && inheritedDefaults.type !== 'pending') {
      parsed.type = inheritedDefaults.type
    }

    // 套用 inheritedDefaults 中的預設金額
    if (parsed.price === null && inheritedDefaults.price) {
      parsed.price = inheritedDefaults.price
    }

    // 推斷接送種類並設定地點（依文件「種類判斷優先順序」）
    // 這裡的 notes 是移除時間、金額、日期後的剩餘文字

    const airport = findAirport(line)
    const raw = parsed.notes

    // 模式 A：「機場關鍵字 + 到 + 地點」→ pickup=桃園/松山/..., dropoff=地點
    if (airport && raw.includes('到')) {
      const parts = raw.split('到')
      const before = removeLocationMarkers(parts[0]).trim()
      const after = parts.slice(1).join('到').trim()
      // 機場在前、地點在後 = 接機
      const airportBefore = findAirport(before)
      if (airportBefore) {
        parsed.pickupLocation = airportBefore.airport
        parsed.dropoffLocation = after || undefined
        parsed.type = 'pickup'
      }
      // 地點在前、機場在後 = 送機
      else {
        parsed.pickupLocation = before || undefined
        parsed.dropoffLocation = airport.airport
        parsed.type = 'dropoff'
      }
    }
    // 模式 B（無機場關鍵字但有「地點+送」）→ pickup=地點, dropoff=桃園預設
    else if (parsed.type === 'dropoff' && raw.includes('送')) {
      const sendIdx = raw.indexOf('送')
      const before = raw.substring(0, sendIdx).trim()
      const after = raw.substring(sendIdx + 1).trim()
      parsed.pickupLocation = before || undefined
      const afterAirport = findAirport(after)
      parsed.dropoffLocation = afterAirport ? afterAirport.airport : '桃園國際機場'
    }
    // 模式 C：「接+地點」（如「接土城」「接機北屯」）→ pickup=預設, dropoff=地點
    else if (parsed.type === 'pickup' && raw.includes('接')) {
      const after = raw.split('接').slice(1).join('接').trim()
      parsed.dropoffLocation = after || undefined
      // pickup 預設為桃園（可依上下文或機場關鍵字調整）
      const airport2 = findAirport(raw)
      parsed.pickupLocation = airport2 ? airport2.airport : '桃園國際機場'
    }
    // 模式 E：交通接駁（有「上-」「下-」）
    else if (parsed.type === 'transfer') {
      const upMatch = raw.match(/上[_-](.+)/)
      const downMatch = raw.match(/下[_-](.+)/)
      if (upMatch) parsed.pickupLocation = upMatch[1].trim()
      if (downMatch) parsed.dropoffLocation = downMatch[1].trim()
    }

    // 清理 notes 中的接送種類標記
    parsed.notes = removeLocationMarkers(raw)
      .replace(/^(任意|不限)/, '')
      .replace(/任意R|任R|任意.*車|不限.*車/g, '')
      .trim()

    // 只有包含時間的才視為有效訂單
    if (parsed.time) {
      results.push(parsed)
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
