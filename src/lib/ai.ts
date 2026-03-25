// AI Order Parsing Utility
// Uses pattern matching and heuristics to parse order text

export interface ParsedOrder {
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
  orderType?: 'pickup' | 'dropoff' // 接機 or 送機
}

// Default values for batch order creation
export interface BatchOrderDefaults {
  price?: number
  carType?: string
  date?: string
  passengerCount?: number
  flightNumber?: string
}

// Parse a single line of order text
function parseOrderLine(line: string, defaults: BatchOrderDefaults): Partial<ParsedOrder> {
  const result: Partial<ParsedOrder> = {}
  const trimmed = line.trim()

  if (!trimmed) return result

  // Extract time - first 4 digit number (HHMM format)
  const timeMatch = trimmed.match(/^(\d{4})/)
  if (timeMatch) {
    const timeStr = timeMatch[1]
    const hours = timeStr.substring(0, 2)
    const minutes = timeStr.substring(2, 4)
    // Validate it's a reasonable time (00-23:00-59)
    const h = parseInt(hours)
    const m = parseInt(minutes)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      result.scheduledTime = `${hours}:${minutes}`
    }
  }

  // Extract price if explicitly marked with $
  const priceMatch = trimmed.match(/\$(\d+)/)
  if (priceMatch) {
    result.price = parseInt(priceMatch[1], 10)
  }

  // Extract car type requirements from notes
  const notes: string[] = []
  if (trimmed.includes('/休旅')) notes.push('休旅車')
  if (trimmed.includes('/限V')) notes.push('限V')
  if (trimmed.includes('+安')) notes.push('+安')
  if (trimmed.includes('+大園')) notes.push('+大園')
  if (notes.length > 0) {
    result.note = notes.join('、')
  }

  // Determine direction and locations
  // "送桃機" = going to airport (pickup: XX, dropoff: 桃園機場) → 送機
  // "接XX" = from airport (pickup: 桃園機場, dropoff: XX) → 接機
  if (trimmed.includes('送桃機')) {
    // Format: "0400 XX送桃機" or "0400 XX送桃機/休旅"
    result.orderType = 'dropoff' // 送機
    const match = trimmed.match(/(\d{4})?\s*(.+?)\s*送桃機/)
    if (match) {
      result.pickupLocation = match[2].replace(/\/.*$/, '').trim()
      result.dropoffLocation = '桃園機場'
      result.pickupAddress = result.pickupLocation
      result.dropoffAddress = '桃園國際機場'
    }
  } else if (trimmed.includes('桃機接')) {
    // Format: "1545桃機接萬華"
    result.orderType = 'pickup' // 接機
    const match = trimmed.match(/(\d{4})?\s*桃機接(.+)/)
    if (match) {
      result.pickupLocation = '桃園機場'
      result.dropoffLocation = match[2].replace(/\/.*$/, '').trim()
      result.pickupAddress = '桃園國際機場'
      result.dropoffAddress = result.dropoffLocation
    }
  }

  return result
}

// Batch parse multiple order lines
export function parseBatchOrders(
  text: string,
  defaults: BatchOrderDefaults
): ParsedOrder[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  const results: ParsedOrder[] = []

  for (const line of lines) {
    const parsed = parseOrderLine(line, defaults)

    // Apply defaults
    const order: ParsedOrder = {
      ...parsed,
      price: parsed.price ?? defaults.price,
      scheduledDate: defaults.date,
      passengerCount: defaults.passengerCount ?? 1,
      flightNumber: defaults.flightNumber,
      rawText: line,
      note: parsed.note || undefined,
    }

    // Only add if we have at least time and a location
    if (order.scheduledTime && (order.pickupLocation || order.dropoffLocation)) {
      results.push(order)
    }
  }

  return results
}

// Old parse function for backward compatibility
export function parseOrderText(rawText: string): ParsedOrder {
  const result: ParsedOrder = {}

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
  const requiredFields = ['scheduledTime', 'pickupLocation', 'dropoffLocation']
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
