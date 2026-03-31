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

// ============ 時間解析 ============
function extractTime(line: string): string | null {
  // 1. HH:MM 格式
  const hmMatch = line.match(/(\d{1,2}):(\d{2})(?!\d)/)
  if (hmMatch) {
    const h = parseInt(hmMatch[1])
    const m = parseInt(hmMatch[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m}`
    }
  }

  // 2. HHMM 格式（行首）
  const hmmMatch = line.match(/^(\d{4})/)
  if (hmmMatch) {
    const h = parseInt(hmmMatch[1].substring(0, 2))
    const m = parseInt(hmmMatch[1].substring(2, 4))
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m}`
    }
  }

  // 3. 單獨時分格式 "5:00" / "05:00"
  const singleTime = line.match(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/)
  if (singleTime) {
    const h = parseInt(singleTime[1])
    const m = parseInt(singleTime[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${h.toString().padStart(2, '0')}:${m}`
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
function extractType(line: string): OrderType {
  if (line.includes('接機') || line.includes('桃機接') || line.match(/機場接|抵達/i)) return 'pickup'
  if (line.includes('送機') || line.match(/送桃機|送.*機/i)) return 'dropoff'
  if (line.includes('接駁') || line.includes('交通')) return 'transfer'
  if (line.includes('包車')) return 'charter'

  // 推斷：含桃園/機場字樣
  const isAirportPickup = line.includes('桃機') || line.includes('機場')
  if (isAirportPickup) {
    if (line.includes('送')) return 'dropoff'
    if (line.includes('接')) return 'pickup'
  }

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

  for (const line of lines) {
    const parsed = parseSingleLine(line, defaults)

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

    // 套用預設車型
    if (parsed.vehicle === 'any' && defaults.vehicle) {
      parsed.vehicle = defaults.vehicle
    }
    if (parsed.plateType === 'any' && defaults.plateType) {
      parsed.plateType = defaults.plateType
    }

    // 套用預設種類（整批統一，車頭選擇後不再推斷）
    if (defaults.type && defaults.type !== 'pending') {
      parsed.type = defaults.type
    }

    // 套用預設金額
    if (parsed.price === null && defaults.price) {
      parsed.price = defaults.price
    }

    // 推斷接送種類並設定地點
    // 格式：X送桃機 → 送機，起點=X，終點=桃園機場
    // 格式：X送機 → 送機，起點=X，終點=桃園機場
    // 格式：X送(非桃機關鍵字) → 送機，起點=X
    // 格式：桃機到X → 接送，起點=桃園機場，終點=X
    // 格式：X到Y → 接送，起點=X，終點=Y（若含非桃園機場關鍵字）

    // 處理「X送桃機」或「X送機」（送機）
    if (line.includes('送桃機') || line.includes('送機')) {
      const location = parsed.notes
        .replace(/(送機|送桃機)$/, '')  // 移除結尾的送機/送桃機
        .replace(/\/.*$/, '')           // 移除 / 後面的車型標記
        .trim()
      if (location) parsed.pickupLocation = location
      else if (parsed.notes) parsed.pickupLocation = parsed.notes
      parsed.dropoffLocation = '桃園機場'
      if (parsed.type === 'pending') parsed.type = 'dropoff'
    }
    // 處理「桃機到X」（接送）
    else if (line.includes('桃機到')) {
      const location = parsed.notes
        .replace(/^(桃機到|桃機 到)/, '')  // 移除開頭的桃機到
        .replace(/\/.*$/, '')              // 移除 / 後面的車型標記
        .trim()
      if (location) parsed.dropoffLocation = location
      else if (parsed.notes) parsed.dropoffLocation = parsed.notes
      parsed.pickupLocation = '桃園機場'
      if (parsed.type === 'pending') parsed.type = 'pickup'
    }
    // 處理「X到Y」但不含接送關鍵字
    else if (line.includes('到') && !line.includes('送') && !line.includes('接')) {
      const parts = line.split('到')
      if (parts.length >= 2) {
        const beforeTo = parts[0].replace(/\/.*$/, '').trim() // 移除 / 後面的車型標記
        const afterTo = parts.slice(1).join('到').replace(/\/.*$/, '').trim()
        if (beforeTo) parsed.pickupLocation = beforeTo
        if (afterTo) parsed.dropoffLocation = afterTo
        if (parsed.type === 'pending') parsed.type = 'dropoff'
      }
    }
    // 處理「接機X」或「桃機接X」（接機）
    else if (line.includes('接機') || line.includes('桃機接')) {
      const location = parsed.notes
        .replace(/^(接機|桃機接)/, '')   // 移除開頭的接機/桃機接標記
        .replace(/\/.*$/, '')            // 移除 / 後面的車型標記
        .trim()
      if (location) parsed.dropoffLocation = location
      else if (parsed.notes) parsed.dropoffLocation = parsed.notes
      parsed.pickupLocation = '桃園機場'
      if (parsed.type === 'pending') parsed.type = 'pickup'
    }

    // 清理 notes 中的接送種類標記
    parsed.notes = parsed.notes
      .replace(/^(接機|送機|桃機接|送桃機|桃機到|桃機 到|接駁|包車)/, '')
      .replace(/\/.*$/, '') // 移除 / 後面的車型標記（已單獨解析）
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
