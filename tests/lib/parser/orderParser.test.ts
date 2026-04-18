import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseOrder } from '@/lib/parser/orderParser'

// Mock the entire fetch call
vi.stubGlobal('fetch', vi.fn())

const mockFetch = vi.mocked(fetch)

// Helper to mock successful Claude Haiku response
function mockHaikuResponse(json: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ text: JSON.stringify(json) }] }),
  } as unknown as Response)
}

// Helper to mock 529 overloaded response (triggers retry)
function mockHaikuOverloaded(attempts: number, finalResponse: unknown) {
  const calls = []
  for (let i = 0; i < attempts; i++) {
    calls.push(mockResolvedValueOnce({
      ok: false,
      status: 529,
      text: async () => 'Overloaded',
    } as unknown as Response))
  }
  calls.push(mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ text: JSON.stringify(finalResponse) }] }),
  } as unknown as Response))
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(calls.shift()!))
}

function mockResolvedValueOnce(res: Response) {
  return Promise.resolve(res)
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-api-key-for-mock'
})

describe('parseOrder', () => {
  describe('Case 1: Standard format (accepted)', () => {
    it('should parse a fully-compliant order with high confidence', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'accepted',
          overall_confidence: 0.97,
          fields: {
            date: { value: '2026-04-19', confidence: 1.0, raw: '4/19' },
            time: { value: '22:10', confidence: 1.0, raw: '22:10' },
            type: { value: 'pickup', confidence: 1.0, raw: '接機' },
            origin: { value: 'TPE', confidence: 0.9, raw: '(隱含)' },
            destination: { value: '大安區信義路四段', confidence: 1.0 },
            price: { value: 850, confidence: 1.0, raw: '850' },
            vehicle_type: { value: 'small', confidence: 1.0, raw: '小車' },
            flight_number: { value: 'CI920', confidence: 1.0, raw: 'CI920' },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: [], confidence: 1.0 },
          },
          rewrite_suggestion: null,
          raw_segment: '4/19 22:10 接機 大安區信義路四段 小車 CI920 850',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder('4/19 22:10 接機 大安區信義路四段 小車 CI920 850')

      expect(result.orders[0].parse_status).toBe('accepted')
      expect(result.orders[0].overall_confidence).toBeGreaterThanOrEqual(0.9)
      expect(result.orders[0].fields.date.value).toBe('2026-04-19')
      expect(result.orders[0].fields.time.value).toBe('22:10')
      expect(result.orders[0].fields.type.value).toBe('pickup')
      expect(result.orders[0].fields.price.value).toBe(850)
      expect(result.orders[0].fields.vehicle_type.value).toBe('small')
      expect(result.orders[0].fields.flight_number.value).toBe('CI920')
      expect(result.orders[0].rewrite_suggestion).toBeNull()
    })
  })

  describe('Case 2: Minimal format (rejected)', () => {
    it('should reject order missing date and price', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'rejected',
          overall_confidence: 0.3,
          fields: {
            date: { value: null, confidence: 0, raw: null },
            time: { value: '00:05', confidence: 1.0, raw: '0:05' },
            type: { value: 'dropoff', confidence: 0.85, raw: '送' },
            origin: { value: '三重區', confidence: 0.9, raw: '三重' },
            destination: { value: 'TPE', confidence: 0.85, raw: '(隱含)' },
            price: { value: null, confidence: 0, raw: null },
            vehicle_type: { value: null, confidence: 0 },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: null, confidence: 0 },
          },
          rejection_reasons: ['missing_date', 'missing_price'],
          rewrite_suggestion: '⚠️ 缺日期、缺價格\n✏️ 建議改寫：`4/19 00:05 送機 三重區 700`\n📖 為什麼：「送」字預設終點是桃園機場，但日期和價格不能省',
          raw_segment: '0:05三重送',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder('0:05三重送')

      expect(result.orders[0].parse_status).toBe('rejected')
      expect(result.orders[0].fields.date.value).toBeNull()
      expect(result.orders[0].fields.price.value).toBeNull()
      expect(result.orders[0].rejection_reasons).toContain('missing_date')
      expect(result.orders[0].rejection_reasons).toContain('missing_price')
      expect(result.orders[0].rewrite_suggestion).toContain('建議改寫')
    })
  })

  describe('Case 3: Group title inheritance (strict mode)', () => {
    it('should reject orders missing date in order block', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 2, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'rejected',
          overall_confidence: 0.4,
          fields: {
            date: { value: null, confidence: 0, raw: null },
            time: { value: '20:10', confidence: 1.0, raw: '20:10' },
            type: { value: 'pickup', confidence: 1.0, raw: '接' },
            origin: { value: 'TPE', confidence: 0.85, raw: '(隱含)' },
            destination: { value: '彰化社頭', confidence: 0.95 },
            price: { value: 1800, confidence: 1.0, raw: '$1800' },
            vehicle_type: { value: 'any', confidence: 1.0 },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: null, confidence: 0 },
          },
          rejection_reasons: ['missing_date_in_order_block'],
          rewrite_suggestion: '⚠️ 整批訂單建議改寫成：\n`4/19 20:10 接機 彰化社頭 1800`\n`4/20 00:55 接機 台中西屯 1600`\n📖 為什麼：標題日期不會被當作訂單欄位，每筆訂單需獨立明寫日期',
          raw_segment: '20:10 接-彰化社頭 $1800',
        }],
        rejected_messages: [{
          raw: '20:10 接-彰化社頭 $1800',
          reasons: ['missing_date_in_order_block'],
          rewrite_suggestion: '⚠️ 整批訂單建議改寫成：\n`4/19 20:10 接機 彰化社頭 1800`',
        }],
      })

      const input = `4/19 桃機-接
任意R-小車/大車皆可
20:10 接-彰化社頭 $1800
4/20(一)桃機-接
任意R-小車/大車皆可
00:55 接-台中西屯 $1600`

      const result = await parseOrder(input)

      expect(result.orders.length).toBeGreaterThan(0)
      const rejectedOrder = result.orders.find(o => o.parse_status === 'rejected')
      expect(rejectedOrder).toBeDefined()
      expect(rejectedOrder?.rejection_reasons).toContain('missing_date_in_order_block')
    })
  })

  describe('Case 4: Bundle orders "一套不拆"', () => {
    it('should split into two orders with bundle_intent=true', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 2, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [
          {
            parse_status: 'needs_review',
            overall_confidence: 0.6,
            fields: {
              date: { value: null, confidence: 0, raw: null },
              time: { value: '03:30', confidence: 1.0, raw: '03:30' },
              type: { value: 'dropoff', confidence: 1.0, raw: '送' },
              origin: { value: '台中東區', confidence: 0.95 },
              destination: { value: 'TPE', confidence: 0.85, raw: '(隱含)' },
              price: { value: 1800, confidence: 1.0, raw: '$1800' },
              vehicle_type: { value: 'imported', confidence: 1.0, raw: '進口車' },
              flight_number: { value: null, confidence: 0 },
              passenger_count: { value: null, confidence: 0 },
              luggage_count: { value: null, confidence: 0 },
              special_requirements: { value: null, confidence: 0 },
            },
            bundle_intent: true,
            bundle_ref: '=1-2=',
            rewrite_suggestion: '⚠️「一套不拆」是 LINE 時代的權宜寫法\n✏️ 在 gogmo App 上分別建立這 2 筆訂單，再點「綁定派單」按鈕\n📖 為什麼：平台的綁定機制會強制司機接下整套，比文字說明可靠',
            raw_segment: '03:30 台中東區-送 (進口車) $1800',
          },
          {
            parse_status: 'needs_review',
            overall_confidence: 0.6,
            fields: {
              date: { value: null, confidence: 0, raw: null },
              time: { value: '18:45', confidence: 1.0, raw: '18:45' },
              type: { value: 'pickup', confidence: 1.0, raw: '接' },
              origin: { value: 'TPE', confidence: 0.85, raw: '(隱含)' },
              destination: { value: '台中西屯', confidence: 0.95 },
              price: { value: 1800, confidence: 1.0, raw: '$1800' },
              vehicle_type: { value: 'imported', confidence: 1.0, raw: '進口車' },
              flight_number: { value: null, confidence: 0 },
              passenger_count: { value: null, confidence: 0 },
              luggage_count: { value: null, confidence: 0 },
              special_requirements: { value: null, confidence: 0 },
            },
            bundle_intent: true,
            bundle_ref: '=1-2=',
            rewrite_suggestion: null,
            raw_segment: '18:45 接-台中西屯 (進口車) $1800',
          },
        ],
        rejected_messages: [],
      })

      const result = await parseOrder(`=1-2==一套不拆
03:30 台中東區-送 (進口車) $1800
18:45 接-台中西屯 (進口車) $1800`)

      expect(result.orders.length).toBe(2)
      expect(result.orders[0].bundle_intent).toBe(true)
      expect(result.orders[1].bundle_intent).toBe(true)
      expect(result.orders[0].bundle_ref).toBe('=1-2=')
      expect(result.orders[1].bundle_ref).toBe('=1-2=')
      expect(result.orders[0].rewrite_suggestion).toContain('一套不拆')
    })
  })

  describe('Case 5: Message timestamp stripping', () => {
    it('should strip LINE message timestamp and parse "明天 4/19" as explicit date', async () => {
      mockHaikuResponse({
        parse_metadata: {
          parsed_at: '2026-04-19T00:00:00Z',
          total_orders_detected: 1,
          noise_filtered_count: 0,
          duplicate_warning: null,
          mode_used: 'strict',
          message_sent_at: '17:21',
          dispatcher_id: 'ᴛᴀ是小ㄚ迪',
        },
        orders: [{
          parse_status: 'accepted',
          overall_confidence: 0.92,
          fields: {
            date: { value: '2026-04-19', confidence: 1.0, raw: '4/19' },
            time: { value: '22:10', confidence: 1.0, raw: '22:10抵達' },
            type: { value: 'pickup', confidence: 1.0, raw: '接機' },
            origin: { value: 'TPE', confidence: 0.9, raw: '(隱含)' },
            destination: { value: '台北市大安區信義路四段', confidence: 1.0 },
            price: { value: 850, confidence: 1.0, raw: '$850' },
            vehicle_type: { value: 'small', confidence: 1.0, raw: '小車' },
            flight_number: { value: 'CI920', confidence: 1.0, raw: 'CI920' },
            passenger_count: { value: 1, confidence: 1.0, raw: '1人' },
            luggage_count: { value: 1, confidence: 1.0, raw: '1行李' },
            special_requirements: { value: ['late_night_surcharge:100:23:00'], confidence: 1.0 },
          },
          rewrite_suggestion: null,
          raw_segment: '17:21 ᴛᴀ是小ㄚ迪 明天小車接機，CI920，4/19 接機，22:10抵達，1人1行李，台北市大安區信義路四段，$850（小車）',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder(`17:21 ᴛᴀ是小ㄚ迪 明天小車接機，CI920，4/19 接機，22:10抵達，1人1行李，台北市大安區信義路四段，$850（小車）
（如超過23:00搭車+$100深夜自取）`)

      expect(result.parse_metadata.message_sent_at).toBe('17:21')
      expect(result.parse_metadata.dispatcher_id).toBe('ᴛᴀ是小ㄚ迪')
      expect(result.orders[0].fields.date.value).toBe('2026-04-19')
      expect(result.orders[0].fields.special_requirements.value).toContain('late_night_surcharge:100:23:00')
    })
  })

  describe('Case 6: Multi-stop order', () => {
    it('should parse multi-stop destination as array and mark multi_stop=true', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'needs_review',
          overall_confidence: 0.85,
          fields: {
            date: { value: null, confidence: 0, raw: null },
            time: { value: '23:20', confidence: 1.0, raw: '23:20' },
            type: { value: 'pickup', confidence: 1.0, raw: '接機' },
            origin: { value: 'TPE', confidence: 0.85, raw: '(隱含)' },
            destination: { value: ['南港區玉成街', '汐止區福德一路'], confidence: 0.95, raw: '1.南港區玉成街 2.汐止區福德一路' },
            price: { value: 1000, confidence: 1.0, raw: '$1000' },
            vehicle_type: { value: 'suv', confidence: 1.0, raw: '休旅' },
            flight_number: { value: 'JX805', confidence: 1.0, raw: 'JX805' },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: null, confidence: 0 },
          },
          multi_stop: true,
          dispatcher_ref: 'A80',
          rejection_reasons: ['missing_date'],
          rewrite_suggestion: '⚠️ 缺日期\n✏️ 建議改寫：`4/19 23:20 接機 南港區玉成街+汐止區福德一路 休旅 JX805 1000`\n📖 多停點訂單請用 `+` 連接，並務必明寫日期',
          raw_segment: 'A80\n23:20接機JX805 \n1.南港區玉成街\n2.汐止區福德一路\n休旅💲1000',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder(`A80
23:20接機JX805
1.南港區玉成街
2.汐止區福德一路
休旅💲1000`)

      expect(result.orders[0].multi_stop).toBe(true)
      expect(Array.isArray(result.orders[0].fields.destination.value)).toBe(true)
      expect((result.orders[0].fields.destination.value as string[]).length).toBe(2)
      expect(result.orders[0].dispatcher_ref).toBe('A80')
    })
  })

  describe('Case 8: City transfer (non-airport)', () => {
    it('should parse transfer type with airport=null', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'accepted',
          overall_confidence: 0.93,
          fields: {
            date: { value: '2026-04-19', confidence: 1.0, raw: '4/19' },
            time: { value: '00:30', confidence: 1.0, raw: '00:30' },
            type: { value: 'transfer', confidence: 1.0, raw: '接駁趟' },
            origin: { value: '松山區', confidence: 0.95 },
            destination: { value: '高雄', confidence: 0.85 },
            price: { value: 5700, confidence: 1.0, raw: '$5700' },
            vehicle_type: { value: 'large', confidence: 1.0, raw: '大車' },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: 4, confidence: 1.0, raw: '客四' },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: null, confidence: 0 },
          },
          rewrite_suggestion: null,
          raw_segment: '4/19。00:30 接駁趟\n客四\n松山區-高雄\n🈯️大車 5700$',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder(`4/19。00:30 接駁趟
客四
松山區-高雄
🈯️大車 5700$`)

      expect(result.orders[0].fields.type.value).toBe('transfer')
      expect(result.orders[0].fields.origin.value).toBe('松山區')
      expect(result.orders[0].fields.destination.value).toBe('高雄')
      expect(result.orders[0].fields.passenger_count.value).toBe(4)
      expect(result.orders[0].fields.vehicle_type.value).toBe('large')
    })
  })

  describe('Case 9: Conditional surcharge', () => {
    it('should parse base price and late-night surcharge separately without adding them', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'needs_review',
          overall_confidence: 0.75,
          fields: {
            date: { value: null, confidence: 0, raw: null },
            time: { value: null, confidence: 0, raw: null },
            type: { value: null, confidence: 0, raw: null },
            origin: { value: null, confidence: 0 },
            destination: { value: null, confidence: 0 },
            price: { value: 850, confidence: 1.0, raw: '$850' },
            vehicle_type: { value: 'small', confidence: 1.0, raw: '小車' },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: ['late_night_surcharge:100:23:00'], confidence: 1.0, raw: '（如超過23:00搭車+$100深夜自取）' },
          },
          rejection_reasons: ['missing_date', 'missing_time', 'missing_type', 'missing_location'],
          rewrite_suggestion: '⚠️ 缺日期、時間、種類、地點\n✏️ 建議改寫：`4/19 22:00 接機 [目的地] 小車 850`\n📖 深夜加價會在實際派單時根據抵達時間動態計算',
          raw_segment: '$850（小車）\n（如超過23:00搭車+$100深夜自取）',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder(`$850（小車）
（如超過23:00搭車+$100深夜自取）`)

      expect(result.orders[0].fields.price.value).toBe(850)
      expect(result.orders[0].fields.special_requirements.value).toContain('late_night_surcharge:100:23:00')
      // Verify the surcharge was NOT added to the base price
      expect(result.orders[0].fields.price.value).not.toBe(950)
    })
  })

  describe('Case 10: Composite job (送+接+送)', () => {
    it('should split into 3 orders with bundle_intent=true and no merged price', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 3, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [
          {
            parse_status: 'needs_review',
            overall_confidence: 0.5,
            fields: {
              date: { value: '2026-04-18', confidence: 1.0, raw: '4/18' },
              time: { value: '17:05', confidence: 1.0, raw: '17:05' },
              type: { value: 'pickup', confidence: 0.7, raw: '接' },
              origin: { value: 'TPE', confidence: 0.85 },
              destination: { value: '大同', confidence: 0.85 },
              price: { value: null, confidence: 0 },
              vehicle_type: { value: 'large', confidence: 0.8, raw: '大車配小' },
              flight_number: { value: null, confidence: 0 },
              passenger_count: { value: null, confidence: 0 },
              luggage_count: { value: null, confidence: 0 },
              special_requirements: { value: null, confidence: 0 },
            },
            bundle_intent: true,
            bundle_ref: 'auto:3job:2300',
            rewrite_suggestion: '⚠️ 整套價 $2300 無法自動拆分到個別訂單\n✏️ 請在 gogmo App 上：\n  1. 建立這 3 筆訂單，各自填寫個別價格（總和 = 2300）\n  2. 點「綁定派單」連成一套\n📖 為什麼：每筆訂單需要獨立價格，司機才能評估是否接單',
            raw_segment: '後天4/18 大車配小\n17:05接大同\n+\n20:00松山機場接中正\n+\n23:30中正送\n$2300',
          },
          {
            parse_status: 'needs_review',
            overall_confidence: 0.5,
            fields: {
              date: { value: '2026-04-18', confidence: 1.0 },
              time: { value: '20:00', confidence: 1.0 },
              type: { value: 'pickup', confidence: 0.85 },
              origin: { value: 'TSA', confidence: 0.95 },
              destination: { value: '中正', confidence: 0.9 },
              price: { value: null, confidence: 0 },
              vehicle_type: { value: 'large', confidence: 0.8 },
              flight_number: { value: null, confidence: 0 },
              passenger_count: { value: null, confidence: 0 },
              luggage_count: { value: null, confidence: 0 },
              special_requirements: { value: null, confidence: 0 },
            },
            bundle_intent: true,
            bundle_ref: 'auto:3job:2300',
            rewrite_suggestion: null,
          },
          {
            parse_status: 'needs_review',
            overall_confidence: 0.5,
            fields: {
              date: { value: '2026-04-18', confidence: 1.0 },
              time: { value: '23:30', confidence: 1.0 },
              type: { value: 'dropoff', confidence: 0.85 },
              origin: { value: '中正', confidence: 0.9 },
              destination: { value: 'TPE', confidence: 0.85 },
              price: { value: null, confidence: 0 },
              vehicle_type: { value: 'large', confidence: 0.8 },
              flight_number: { value: null, confidence: 0 },
              passenger_count: { value: null, confidence: 0 },
              luggage_count: { value: null, confidence: 0 },
              special_requirements: { value: null, confidence: 0 },
            },
            bundle_intent: true,
            bundle_ref: 'auto:3job:2300',
            rewrite_suggestion: null,
          },
        ],
        rejected_messages: [],
      })

      const result = await parseOrder(`後天4/18 大車配小
17:05接大同
+
20:00松山機場接中正
+
23:30中正送
$2300`)

      expect(result.orders.length).toBe(3)
      result.orders.forEach(order => {
        expect(order.bundle_intent).toBe(true)
        expect(order.bundle_ref).toBe('auto:3job:2300')
        expect(order.fields.price.value).toBeNull() // Total $2300 not split
      })
      expect(result.orders[0].rewrite_suggestion).toContain('$2300')
      expect(result.orders[0].rewrite_suggestion).toContain('綁定派單')
    })
  })

  describe('Error handling', () => {
    it('should throw when ANTHROPIC_API_KEY is not set', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      await expect(parseOrder('test message')).rejects.toThrow('ANTHROPIC_API_KEY')

      if (originalKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalKey
      }
    })

    it('should retry on 529 overloaded and return successful result', async () => {
      // Mock: first call → 529, second call → success
      const successResponse = {
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'accepted',
          overall_confidence: 0.97,
          fields: {
            date: { value: '2026-04-19', confidence: 1.0, raw: '4/19' },
            time: { value: '22:10', confidence: 1.0, raw: '22:10' },
            type: { value: 'pickup', confidence: 1.0, raw: '接機' },
            origin: { value: 'TPE', confidence: 0.9 },
            destination: { value: '大安區信義路四段', confidence: 1.0 },
            price: { value: 850, confidence: 1.0, raw: '850' },
            vehicle_type: { value: 'small', confidence: 1.0 },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: [], confidence: 1.0 },
          },
          rewrite_suggestion: null,
          raw_segment: '4/19 22:10 接機 大安區信義路四段 小車 850',
        }],
        rejected_messages: [],
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: false, status: 529, text: async () => 'Overloaded' } as unknown as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: [{ text: JSON.stringify(successResponse) }] }) } as unknown as Response)

      const result = await parseOrder('4/19 22:10 接機 大安區信義路四段 小車 850')

      expect(result.orders[0].parse_status).toBe('accepted')
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    })

    it('should throw on non-529 errors without retrying', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as unknown as Response)

      await expect(parseOrder('test')).rejects.toThrow('401')
    })
  })

  describe('parse_mode option', () => {
    it('should pass strict mode to metadata', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'rejected',
          overall_confidence: 0.3,
          fields: {
            date: { value: null, confidence: 0, raw: null },
            time: { value: '00:05', confidence: 1.0, raw: '0:05' },
            type: { value: 'dropoff', confidence: 0.85, raw: '送' },
            origin: { value: '三重區', confidence: 0.9 },
            destination: { value: 'TPE', confidence: 0.85 },
            price: { value: null, confidence: 0 },
            vehicle_type: { value: null, confidence: 0 },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: null, confidence: 0 },
          },
          rejection_reasons: ['missing_date', 'missing_price'],
          rewrite_suggestion: '⚠️ 缺日期、缺價格\n✏️ 建議改寫',
          raw_segment: '0:05三重送',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder('0:05三重送', { mode: 'strict' })
      expect(result.parse_metadata.mode_used).toBe('strict')
    })

    it('should pass lenient mode to metadata', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'lenient' },
        orders: [{
          parse_status: 'needs_review',
          overall_confidence: 0.6,
          fields: {
            date: { value: null, confidence: 0, raw: null },
            time: { value: '00:05', confidence: 1.0, raw: '0:05' },
            type: { value: 'dropoff', confidence: 0.85, raw: '送' },
            origin: { value: '三重區', confidence: 0.9 },
            destination: { value: 'TPE', confidence: 0.85 },
            price: { value: null, confidence: 0 },
            vehicle_type: { value: null, confidence: 0 },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: null, confidence: 0 },
          },
          rewrite_suggestion: '⚠️ 缺日期\n✏️ 建議改寫',
          raw_segment: '0:05三重送',
        }],
        rejected_messages: [],
      })

      const result = await parseOrder('0:05三重送', { mode: 'lenient' })
      expect(result.parse_metadata.mode_used).toBe('lenient')
    })
  })

  describe('Response normalization', () => {
    it('should handle markdown-wrapped JSON responses', async () => {
      mockHaikuResponse({
        parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
        orders: [{
          parse_status: 'accepted',
          overall_confidence: 0.97,
          fields: {
            date: { value: '2026-04-19', confidence: 1.0, raw: '4/19' },
            time: { value: '22:10', confidence: 1.0, raw: '22:10' },
            type: { value: 'pickup', confidence: 1.0, raw: '接機' },
            origin: { value: 'TPE', confidence: 0.9 },
            destination: { value: '大安區信義路四段', confidence: 1.0 },
            price: { value: 850, confidence: 1.0, raw: '850' },
            vehicle_type: { value: 'small', confidence: 1.0 },
            flight_number: { value: null, confidence: 0 },
            passenger_count: { value: null, confidence: 0 },
            luggage_count: { value: null, confidence: 0 },
            special_requirements: { value: [], confidence: 1.0 },
          },
          rewrite_suggestion: null,
          raw_segment: '4/19 22:10 接機 大安區信義路四段 小車 850',
        }],
        rejected_messages: [],
      })

      // Simulate markdown-wrapped response by directly setting mock
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: '```json\n' + JSON.stringify({
            parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
            orders: [{
              parse_status: 'accepted',
              overall_confidence: 0.97,
              fields: {
                date: { value: '2026-04-19', confidence: 1.0, raw: '4/19' },
                time: { value: '22:10', confidence: 1.0, raw: '22:10' },
                type: { value: 'pickup', confidence: 1.0, raw: '接機' },
                origin: { value: 'TPE', confidence: 0.9 },
                destination: { value: '大安區信義路四段', confidence: 1.0 },
                price: { value: 850, confidence: 1.0, raw: '850' },
                vehicle_type: { value: 'small', confidence: 1.0 },
                flight_number: { value: null, confidence: 0 },
                passenger_count: { value: null, confidence: 0 },
                luggage_count: { value: null, confidence: 0 },
                special_requirements: { value: [], confidence: 1.0 },
              },
              rewrite_suggestion: null,
              raw_segment: '4/19 22:10 接機 大安區信義路四段 小車 850',
            }],
            rejected_messages: [],
          }) + '\n```' }],
        }),
      } as unknown as Response)

      // Re-mock the normal response since we overrode above
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify({
            parse_metadata: { parsed_at: '2026-04-19T00:00:00Z', total_orders_detected: 1, noise_filtered_count: 0, duplicate_warning: null, mode_used: 'strict' },
            orders: [{
              parse_status: 'accepted',
              overall_confidence: 0.97,
              fields: {
                date: { value: '2026-04-19', confidence: 1.0, raw: '4/19' },
                time: { value: '22:10', confidence: 1.0, raw: '22:10' },
                type: { value: 'pickup', confidence: 1.0, raw: '接機' },
                origin: { value: 'TPE', confidence: 0.9 },
                destination: { value: '大安區信義路四段', confidence: 1.0 },
                price: { value: 850, confidence: 1.0, raw: '850' },
                vehicle_type: { value: 'small', confidence: 1.0 },
                flight_number: { value: null, confidence: 0 },
                passenger_count: { value: null, confidence: 0 },
                luggage_count: { value: null, confidence: 0 },
                special_requirements: { value: [], confidence: 1.0 },
              },
              rewrite_suggestion: null,
              raw_segment: '4/19 22:10 接機 大安區信義路四段 小車 850',
            }],
            rejected_messages: [],
          }) }],
        }),
      } as unknown as Response)

      const result = await parseOrder('4/19 22:10 接機 大安區信義路四段 小車 850')
      expect(result.orders[0].parse_status).toBe('accepted')
    })
  })
})
