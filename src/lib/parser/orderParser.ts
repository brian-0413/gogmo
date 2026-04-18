/**
 * gogmo Order Parser
 * Uses Claude Haiku API with SKILL.md system prompt to parse LINE-style dispatch messages.
 */
import { SKILL_SYSTEM_PROMPT } from './prompts'
import type { ParseResult, ParseMode, DuplicateWarning } from './types'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_RETRIES = 2

interface ParseOrderOptions {
  mode?: ParseMode
  defaultDate?: string
}

/**
 * Parse a raw dispatch message into structured gogmo orders.
 */
export async function parseOrder(
  rawMessage: string,
  options: ParseOrderOptions = {}
): Promise<ParseResult> {
  const { mode = 'strict', defaultDate = new Date().toISOString().split('T')[0] } = options

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }

  const userMessage = buildUserMessage(rawMessage, defaultDate, mode)
  const systemPrompt = SKILL_SYSTEM_PROMPT.replace('"strict"', `"${mode}"`)

  let lastError: string = ''

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(500 * attempt)
    }

    try {
      const result = await callClaudeHaiku(apiKey, systemPrompt, userMessage, defaultDate, mode)
      return result
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      // Only retry on 529 (overloaded)
      if (!lastError.includes('529') && !lastError.includes('overloaded')) {
        throw err
      }
    }
  }

  throw new Error(`parseOrder failed after ${MAX_RETRIES + 1} attempts: ${lastError}`)
}

function buildUserMessage(rawMessage: string, defaultDate: string, mode: ParseMode): string {
  return `請解析以下訂單訊息（${mode} 模式）：

${rawMessage}

注意：
- 日期預設參考：${defaultDate}
- 只回傳 JSON 物件，不要任何其他文字，不要用 markdown code block
- 嚴格模式下，缺欄位一律 rejected 並提供 rewrite_suggestion
- 寬鬆模式下，缺欄位給 needs_review 並降低 confidence`
}

async function callClaudeHaiku(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  defaultDate: string,
  mode: ParseMode
): Promise<ParseResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (response.status === 529) {
    throw new Error('Anthropic Overloaded (529)')
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${text}`)
  }

  const data = await response.json() as { content?: Array<{ text: string }> }
  const rawText = data.content?.[0]?.text?.trim() ?? ''

  if (!rawText) {
    throw new Error('Empty response from Claude API')
  }

  return parseJsonResponse(rawText, defaultDate, mode)
}

function parseJsonResponse(rawText: string, defaultDate: string, mode: ParseMode): ParseResult {
  let cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown

  // Try to find JSON object starting with {
  const objStart = cleaned.indexOf('{')
  if (objStart !== -1) {
    const result = extractBalancedJson(cleaned, objStart)
    if (result) {
      parsed = JSON.parse(result)
    }
  }

  // Fallback: try parsing the whole thing
  if (!parsed) {
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error(`JSON parse error. Raw response:\n${rawText.substring(0, 500)}`)
    }
  }

  const obj = parsed as Record<string, unknown>
  const meta = obj.parse_metadata as Record<string, unknown> | undefined

  // Validate duplicate_warning shape — must have required 'detected' field
  const rawDuplicateWarning = meta?.duplicate_warning
  const duplicateWarning: ParseResult['parse_metadata']['duplicate_warning'] =
    rawDuplicateWarning && typeof rawDuplicateWarning === 'object' && !Array.isArray(rawDuplicateWarning) && 'detected' in rawDuplicateWarning
      ? rawDuplicateWarning as DuplicateWarning
      : null

  // Normalize and validate the structure
  const result: ParseResult = {
    parse_metadata: {
      parsed_at: new Date().toISOString(),
      total_orders_detected: Array.isArray(obj.orders) ? obj.orders.length : 0,
      noise_filtered_count: typeof meta?.noise_filtered_count === 'number' ? Number(meta.noise_filtered_count) : 0,
      duplicate_warning: duplicateWarning,
      mode_used: mode,
      message_sent_at: typeof meta?.message_sent_at === 'string' ? meta.message_sent_at : undefined,
      dispatcher_id: typeof meta?.dispatcher_id === 'string' ? meta.dispatcher_id : undefined,
    },
    orders: normalizeOrders(obj.orders, defaultDate),
    rejected_messages: normalizeRejections(obj.rejected_messages),
  }

  return result
}

function extractBalancedJson(text: string, start: number): string | null {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.substring(start, i + 1)
    }
  }
  return null
}

function normalizeOrders(orders: unknown, defaultDate: string): ParseResult['orders'] {
  if (!Array.isArray(orders)) return []

  return orders.map((o: unknown) => {
    const order = o as Record<string, unknown>
    const fields = normalizeFields(order.fields, defaultDate)

    return {
      id: typeof order.id === 'string' ? order.id : undefined,
      parse_status: normalizeStatus(order.parse_status),
      overall_confidence: typeof order.overall_confidence === 'number'
        ? order.overall_confidence
        : 0,
      fields,
      rejection_reasons: Array.isArray(order.rejection_reasons)
        ? order.rejection_reasons as string[]
        : [],
      rewrite_suggestion: typeof order.rewrite_suggestion === 'string'
        ? order.rewrite_suggestion
        : null,
      raw_segment: typeof order.raw_segment === 'string' ? order.raw_segment : undefined,
      dispatcher_ref: typeof order.dispatcher_ref === 'string' ? order.dispatcher_ref : undefined,
      bundle_intent: Boolean(order.bundle_intent),
      bundle_ref: typeof order.bundle_ref === 'string' ? order.bundle_ref : undefined,
      multi_stop: Boolean(order.multi_stop),
    }
  })
}

function normalizeFields(fields: unknown, defaultDate: string): ParseResult['orders'][0]['fields'] {
  const f = (fields as Record<string, unknown>) || {}

  const normalizeField = <T,>(name: string, defaultValue: T): { value: T; confidence: number; raw?: string | null } => {
    const field = f[name] as Record<string, unknown> | undefined
    if (!field) return { value: defaultValue, confidence: 0, raw: null }
    return {
      value: (field.value as T) ?? defaultValue,
      confidence: typeof field.confidence === 'number' ? field.confidence : 0,
      raw: field.raw != null ? String(field.raw) : null,
    }
  }

  return {
    date: normalizeField('date', null),
    time: normalizeField('time', null),
    type: normalizeField('type', null),
    origin: normalizeField('origin', null),
    destination: normalizeField('destination', null),
    price: normalizeField('price', null),
    vehicle_type: normalizeField('vehicle_type', null),
    flight_number: normalizeField('flight_number', null),
    passenger_count: normalizeField('passenger_count', null),
    luggage_count: normalizeField('luggage_count', null),
    special_requirements: normalizeField('special_requirements', null),
  }
}

function normalizeRejections(rejections: unknown): ParseResult['rejected_messages'] {
  if (!Array.isArray(rejections)) return []
  return rejections.map((r: unknown) => {
    const rej = r as Record<string, unknown>
    return {
      raw: typeof rej.raw === 'string' ? rej.raw : '',
      reasons: Array.isArray(rej.reasons) ? rej.reasons as string[] : [],
      rewrite_suggestion: typeof rej.rewrite_suggestion === 'string' ? rej.rewrite_suggestion : undefined,
    }
  })
}

function normalizeStatus(s: unknown): ParseResult['orders'][0]['parse_status'] {
  if (s === 'accepted' || s === 'needs_review' || s === 'rejected') return s
  return 'rejected'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
