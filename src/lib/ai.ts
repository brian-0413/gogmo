// AI Order Parsing Utility
// 只解析五個關鍵欄位：日期、時間、種類、起點、終點
// 其餘全部保留原文至備註欄位
// 地點邏輯（依使用者需求）：
//   - 接機：起點=○機（外層決定），終點=訊息中的地點
//   - 送機：起點=訊息中的地點，終點=○機（外層決定）

import { SYSTEM_PROMPT } from './prompts/order-parsing'
import type { OrderType, VehicleType, PlateType } from '@/types'

export type ParseStatus = 'ok' | 'incomplete' | 'rejected'

export interface ParsedOrder {
  date: string | null
  time: string | null       // "23:10" 或 "05:00"，若是落地則 "落地"
  type: OrderType
  vehicle: VehicleType
  plateType: PlateType
  price: number | null
  notes: string              // 原始行完整複製
  rawText: string            // 原始行文字
  pickupLocation?: string
  dropoffLocation?: string
  status: ParseStatus         // ok=正常, incomplete=待補正, rejected=拒絕
  reason?: string             // 當 rejected 或 incomplete 時的原因
  isPaired?: boolean          // 是否為套裝行程
  kenichiRequired?: boolean   // 是否為肯驛單
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

  // HHMM 格式（行首，可能有 * 等前綴）
  const hmmMatch = line.match(/^[*#]*(\d{4})/)
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
// 1. 基隆港→地點 或 基隆港-地點 → 接船（pickup_boat）
// 2. 地點→基隆港 → 送船（dropoff_boat）
// 3. 有「接」→ 接機（pickup）
// 4. 有「送」→ 送機（dropoff）
// 5. 「○機-地點」→ 送機（例：桃機-中正）
// 6. 「○機到X」→ 接機（例：桃機到台中南屯）
// 7. 「X到○機」→ 送機（例：台中南屯到桃機）
function extractType(line: string): OrderType {
  // 基隆港偵測（優先於機場）
  const hasKeelung = line.includes('基隆港')
  if (hasKeelung) {
    // 基隆港→地點 或 基隆港-地點 → 接船
    if (line.includes('→') || line.includes('-') || line.includes('接')) {
      return 'pickup_boat'
    }
    // 地點→基隆港 → 送船
    if (line.includes('到') || line.includes('送')) {
      return 'dropoff_boat'
    }
    // 基隆港存在，預設接船
    return 'pickup_boat'
  }

  // 「接」→ 接機
  if (line.includes('接')) {
    const after = line.split('接').slice(1).join('接').trim()
    if (after) return 'pickup'
  }

  // 「送」→ 送機
  if (line.includes('送')) {
    return 'dropoff'
  }

  // 「○機-地點」→ 送機（例：桃機-中正）
  if (findAirport(line) && line.includes('-')) {
    const airport = findAirport(line)!
    const dashIdx = line.indexOf('-')
    if (dashIdx > airport.keyword.length) return 'dropoff'
  }

  // 「○機到X」（機場在前、地點在後）→ 接機
  const airportBefore = findAirport(line.split('到')[0] || '')
  if (airportBefore && line.includes('到')) {
    return 'pickup'
  }

  // 「X到○機」（地點在前、機場在後）→ 送機
  if (findAirport(line) && line.includes('到')) {
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

  // 標題行繼承
  let inheritedDefaults = { ...defaults }

  for (const line of lines) {
    // ========== 標題行偵測 ==========
    // 沒有時間、沒有接送動作關鍵字、但有車型或 📌 標記
    const hasTime = /^\d{4}/.test(line) || /\d{1,2}:\d{2}/.test(line)
    const hasActionKeyword = /[接送]/.test(line) || line.includes('到') || line.includes('-')
    const hasVehicleKeyword = /[休旅]|大車|小車|任意|9座|📌/.test(line)

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

    // ========== notes = 原始行完整複製 ==========
    const notes = line // 只移除書名號，其他全保留

    // ========== 設定接送地點 ==========
    let pickupLocation: string | undefined
    let dropoffLocation: string | undefined
    const airportInLine = findAirport(line)

    if (type === 'pickup') {
      // 接機：起點=○機，終點=訊息地點
      pickupLocation = airportInLine?.airport || '桃園國際機場'
      if (line.includes('接')) {
        const parts = line.split('接')
        const after = parts.slice(1).join('接').trim()
          .replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】()（）]/g, '').replace(/\s+/g, ' ').trim()
        dropoffLocation = after || undefined
      }
    } else if (type === 'dropoff') {
      // 送機：終點=訊息地點，起點=○機
      // 「○機-地點」格式（例：桃機-中正 (L)）
      if (airportInLine && line.includes('-')) {
        const dashIdx = line.indexOf('-')
        const after = line.substring(dashIdx + 1)
          .replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】]/g, '').replace(/\([LK]\)/, '').replace(/\s+/g, ' ').trim()
        dropoffLocation = after || undefined
        pickupLocation = airportInLine.airport
      }
      // 「送」格式
      else if (line.includes('送')) {
        const sendIdx = line.indexOf('送')
        const before = line.substring(0, sendIdx).trim()
          .replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】]/g, '').trim()
        dropoffLocation = airportInLine?.airport || '桃園國際機場'
        pickupLocation = before || undefined
      }
      // 「X到○機」格式
      else if (line.includes('到') && airportInLine) {
        const parts = line.split('到')
        const before = parts[0].trim()
          .replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】]/g, '').trim()
        if (before) pickupLocation = before
        dropoffLocation = airportInLine.airport
      }
    } else if (type === 'pickup_boat') {
      // 接船：起點=基隆港，終點=訊息地點
      pickupLocation = '基隆港'
      // 從「接」或「→」或「-」之後提取地點
      const afterMatch = line.match(/基隆港[→-](.+)/)
        || line.match(/接(.+)/)
        || line.match(/→(.+)/)
      if (afterMatch) {
        const after = afterMatch[1].trim()
          .replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】()（）]/g, '').replace(/\s+/g, ' ').trim()
        dropoffLocation = after || undefined
      }
    } else if (type === 'dropoff_boat') {
      // 送船：起點=訊息地點，終點=基隆港
      dropoffLocation = '基隆港'
      // 從「送」之前或「到基隆港」之前提取地點
      if (line.includes('送')) {
        const sendIdx = line.indexOf('送')
        const before = line.substring(0, sendIdx).trim()
          .replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】]/g, '').replace(/\s+/g, ' ').trim()
        pickupLocation = before || undefined
      } else if (line.includes('到')) {
        const parts = line.split('到')
        const before = parts[0].trim()
          .replace(/^\d{4}/, '').replace(/[$💲]\d+/, '').replace(/\d{3,}$/, '').replace(/[\[\]【】]/g, '').replace(/\s+/g, ' ').trim()
        pickupLocation = before || undefined
      }
    } else if (type === 'transfer') {
      // 交通接駁
      const upMatch = line.match(/上[_-](.+)/)
      const downMatch = line.match(/下[_-](.+)/)
      if (upMatch) pickupLocation = upMatch[1].trim()
      if (downMatch) dropoffLocation = downMatch[1].trim()
    }

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
        status: 'ok',
      })
    }
  }

  return results
}

// ============ LLM 訂單解析（使用 Claude Haiku） ============

export interface LLMParseResult {
  orders: ParsedOrder[]
  rawResponse: string
}

/**
 * 使用 Claude Haiku 解析 LINE 訂單文字
 */
export async function parseBatchOrdersLLM(
  text: string,
  defaults: BatchOrderDefaults
): Promise<LLMParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未設定')
  }

  const defaultDate = defaults.date || new Date().toISOString().split('T')[0]
  const systemPrompt = SYSTEM_PROMPT.replace('{DEFAULT_DATE}', defaultDate)

  const userMessage = `請解析以下訂單訊息：

${text}

日期：${defaultDate}
種類：${defaults.type ? defaults.type : '（未指定）'}
車型：${defaults.vehicle || '任意'}
車牌：${defaults.plateType || '任意'}
金額：${defaults.price || '未指定'}

只回傳 JSON array，不要任何其他文字，不要用 markdown code block。`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const rawResponse = data.content?.[0]?.text || '[]'

  // Parse JSON from response
  let orders: any[] = []
  try {
    // Strip markdown code block markers if present
    let cleaned = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    // Try to extract JSON array - find the array boundaries robustly
    const jsonStart = cleaned.indexOf('[')
    if (jsonStart !== -1) {
      // Count brackets to find the matching closing bracket
      let depth = 0
      let end = jsonStart
      for (let i = jsonStart; i < cleaned.length; i++) {
        if (cleaned[i] === '{') depth++
        else if (cleaned[i] === '}') depth--
        else if (cleaned[i] === '[') depth++
        else if (cleaned[i] === ']') depth--
        if (depth === 0 && cleaned[i] === ']') {
          end = i
          break
        }
      }
      const jsonStr = cleaned.substring(jsonStart, end + 1)
      orders = JSON.parse(jsonStr)
    } else {
      orders = JSON.parse(cleaned)
    }
  } catch (e) {
    throw new Error(`JSON parse error: ${e}, response: ${rawResponse}`)
  }

  // Validate and normalize each order
  const validatedOrders: ParsedOrder[] = (orders || []).map((o: any) => ({
    date: o.date || defaultDate,
    time: o.time || null,
    type: (o.type || 'pending') as any,
    vehicle: (o.vehicle || 'any') as any,
    plateType: (o.plateType || 'any') as any,
    price: o.price != null ? Number(o.price) : null,
    notes: o.notes || o.rawText || '',
    rawText: o.rawText || '',
    pickupLocation: o.pickupLocation,
    dropoffLocation: o.dropoffLocation,
    status: (o.status || 'ok') as any,
    reason: o.reason,
    isPaired: o.isPaired || false,
    kenichiRequired: o.kenichiRequired || false,
  }))

  return { orders: validatedOrders, rawResponse }
}

// ============ 舊版 API 相容性 ============
/**
 * @deprecated 舊版解析邏輯，已被 parseBatchOrders / parseBatchOrdersLLM 取代，預計下個 major version 移除
 */
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
/**
 * @deprecated 舊版單行解析，已被 parseBatchOrders / parseBatchOrdersLLM 取代，預計下個 major version 移除
 */
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

// Re-export from constants.ts for backward compatibility
export { VEHICLE_LABELS, TYPE_LABELS, PLATETYPE_LABELS } from './constants'
