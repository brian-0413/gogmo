'use client'

import { useState, useRef, useEffect } from 'react'

// ============ Types ============
interface LuggageItem {
  size: string
  quantity: number
}

interface FormData {
  orderType: 'pickup' | 'dropoff' | null
  airport: string | null
  scheduledDate: string
  scheduledTime: string
  flightNumber: string
  vehicleType: 'small' | 'suv' | 'van9' | null
  passengerCount: number | null
  luggageItems: LuggageItem[]
  luggageStep: 'size' | 'quantity' | 'confirm' | 'done'
  currentLuggageSize: string | null
  currentLuggageQty: number
  pickupLocation: string
  dropoffLocation: string
  contactName: string
  contactPhone: string
  notes: string
}

interface PricingOption {
  vehicleType: string
  price: number
  enabled: boolean
}

interface QRSubmitData {
  orderType: string | null
  airport: string | null
  scheduledDate: string
  scheduledTime: string
  flightNumber: string
  vehicleType: string | null
  passengerCount: number | null
  luggageItems: LuggageItem[]
  pickupLocation: string
  dropoffLocation: string
  contactName: string
  contactPhone: string
  notes: string
}

interface QROrderChatProps {
  driverId: string
  licensePlate: string
  pricing: PricingOption[]
  onSubmit: (data: QRSubmitData) => Promise<{ success: boolean; error?: string }>
}

// ============ Defaults ============
const DEFAULT_FORM: FormData = {
  orderType: null,
  airport: null,
  scheduledDate: '',
  scheduledTime: '',
  flightNumber: '',
  vehicleType: null,
  passengerCount: null,
  luggageItems: [],
  luggageStep: 'size',
  currentLuggageSize: null,
  currentLuggageQty: 1,
  pickupLocation: '',
  dropoffLocation: '',
  contactName: '',
  contactPhone: '',
  notes: '',
}

const AIRPORT_LABELS: Record<string, string> = {
  'TPE': '桃園國際機場',
  'TSA': '松山機場',
  'RMQ': '台中清泉崗',
  'KHH': '高雄小港機場',
  'KELUNG': '基隆港',
  'OTHER': '其他地點',
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  pickup: '接機 / 接船',
  dropoff: '送機 / 送船',
}

const VEHICLE_LABELS: Record<string, string> = {
  small: '小車(5人)',
  suv: '休旅(7人)',
  van9: '9人座',
}

const VEHICLE_ICONS: Record<string, string> = {
  small: '小',
  suv: '休',
  van9: '9',
}

const AIRPORT_KEYS = ['TPE', 'TSA', 'RMQ', 'KHH', 'KELUNG', 'OTHER']

// ============ Helpers ============
function isPickupOrder(orderType: string | null): boolean {
  return orderType === 'pickup'
}

function isValidTaiwanPhone(phone: string): boolean {
  return /^(?:(?:\+886|886)?0?9\d{8})$/.test(phone.replace(/-/g, ''))
}

function formatTime24(date: string, time: string): string {
  if (!date || !time) return ''
  const [y, m, d] = date.split('-')
  const [h, mi] = time.split(':')
  return `${m}/${d} ${h}:${mi}`
}

function formatLuggageSummary(items: LuggageItem[]): string {
  if (items.length === 0) return '無'
  return items.map(i => `${i.size} x ${i.quantity}`).join(', ')
}

function getSelectedPrice(vehicleType: string | null, pricing: PricingOption[]): number | null {
  if (!vehicleType) return null
  const p = pricing.find(p => p.vehicleType === vehicleType && p.enabled)
  return p?.price ?? null
}

function setToday(): string {
  const d = new Date()
  const fmt = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())}`
}

function setTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const fmt = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())}`
}

// ============ Sub-components ============
function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 mb-5">
      <div className="w-7 h-7 rounded-full bg-[#FF385C] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
        G
      </div>
      <div className="flex-1 bg-white border border-[#EBEBEB] rounded-tr-2xl rounded-br-2xl rounded-tl-xl px-4 py-3 text-[14px] text-[#222222] leading-relaxed shadow-sm">
        {children}
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-5">
      <div className="bg-[#E8A855] text-[#1C1917] rounded-tl-2xl rounded-bl-2xl rounded-tr-xl px-4 py-3 max-w-[75%] text-[14px] font-semibold leading-relaxed shadow-sm">
        {text}
      </div>
    </div>
  )
}

function OptButton({
  label,
  sub,
  icon,
  onClick,
  selected = false,
  className = '',
}: {
  label: string
  sub?: string
  icon?: string
  onClick: () => void
  selected?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 px-2 rounded-xl border-2 text-[13px] font-semibold cursor-pointer transition-all text-center leading-tight ${selected
        ? 'bg-[#FFF8EE] border-[#E8A855] text-[#1C1917]'
        : 'bg-white text-[#222222] border-[#DDDDDD] hover:border-[#E8A855]'
        } ${className}`}
    >
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] flex items-center justify-center mx-auto mb-1 text-[12px] font-bold text-[#333]">
          {icon}
        </div>
      )}
      <div className="font-bold">{label}</div>
      {sub && <div className="text-[10px] font-normal text-[#717171] mt-0.5">{sub}</div>}
    </button>
  )
}

function OptGrid({ cols, children }: { cols: 2 | 3 | 4; children: React.ReactNode }) {
  const gridClass = cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return <div className={`grid ${gridClass} gap-2 mt-3`}>{children}</div>
}

function InputField({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`px-3 py-2.5 border-2 border-[#DDDDDD] rounded-xl text-[14px] outline-none focus:border-[#E8A855] bg-white w-full ${className}`}
    />
  )
}

function LuggageChip({ item, onRemove }: { item: LuggageItem; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EFE9] border border-[#DDDDDD] rounded-full text-[12px]">
      <span className="font-medium">{item.size} x {item.quantity}</span>
      <button onClick={onRemove} className="text-[#A8A29E] hover:text-[#FF385C] font-bold leading-none">x</button>
    </div>
  )
}

// ============ Main Component ============
export function QROrderChat({ driverId, licensePlate, pricing, onSubmit }: QROrderChatProps) {
  // step: 1-10
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const set = (patch: Partial<FormData>) =>
    setForm(prev => ({ ...prev, ...patch }))

  const addUser = (text: string) => {
    // User bubble is shown inline after selection
  }

  const selectedPrice = getSelectedPrice(form.vehicleType, pricing)

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [step, submitting])

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await onSubmit(form)

      if (result.success) {
        setSubmitted(true)
      } else {
        setSubmitError(result.error || '預訂失敗，請稍後再試')
      }
    } catch {
      setSubmitError('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  // User selections shown as bubbles
  const userSelections: { step: number; text: string }[] = []
  if (form.orderType) userSelections.push({ step: 1, text: ORDER_TYPE_LABELS[form.orderType] })
  if (form.airport) userSelections.push({ step: 2, text: AIRPORT_LABELS[form.airport] || form.airport })
  if (form.scheduledDate && form.scheduledTime) userSelections.push({ step: 3, text: formatTime24(form.scheduledDate, form.scheduledTime) })
  if (form.flightNumber) userSelections.push({ step: 4, text: form.flightNumber })
  if (form.vehicleType) userSelections.push({ step: 5, text: VEHICLE_LABELS[form.vehicleType] })
  if (form.passengerCount) userSelections.push({ step: 6, text: `${form.passengerCount}人` })
  if (form.luggageItems.length > 0) userSelections.push({ step: 7, text: formatLuggageSummary(form.luggageItems) })
  if (isPickupOrder(form.orderType) && form.dropoffLocation) userSelections.push({ step: 8, text: form.dropoffLocation })
  if (!isPickupOrder(form.orderType) && form.pickupLocation) userSelections.push({ step: 8, text: form.pickupLocation })
  if (form.contactName && form.contactPhone) userSelections.push({ step: 9, text: `${form.contactName} ${form.contactPhone}` })

  if (submitted) {
    return (
      <div className="space-y-0">
        <BotBubble>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#FF385C] text-white flex items-center justify-center text-[11px] font-bold">G</div>
            <div className="text-[11px] text-[#717171]">goGMO</div>
          </div>
          <div className="bg-[#FFF3E0] border border-[#E8A855] rounded-xl px-4 py-4">
            <p className="text-[14px] font-bold text-[#1C1917] mb-1">感謝您的預訂！</p>
            <p className="text-[13px] text-[#717171]">
              我已將您的需求傳給司機 <span className="font-bold font-mono-nums text-[#E8A855]">{licensePlate}</span>，
              他會盡快與您聯繫。
            </p>
          </div>
        </BotBubble>
        <div className="text-center py-6">
          <p className="text-[13px] text-[#A8A29E]">您可以關閉此頁面</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Greeting */}
      <BotBubble>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#FF385C] text-white flex items-center justify-center text-[11px] font-bold">G</div>
          <div className="text-[11px] text-[#717171]">goGMO</div>
        </div>
        <p className="text-[12px] text-[#717171] mb-2">您好</p>
        <p className="text-[14px] text-[#222222] leading-relaxed">
          親愛的貴賓您好，我是專屬<br />
          <span className="text-[22px] font-black font-mono-nums text-[#E8A855] tracking-widest">{licensePlate}</span><br />
          司機的行程預訂機器人，很高興為您服務
        </p>
        <div className="bg-[#FFF3E0] border-l-3 border-l-[#E8A855] rounded-lg px-3 py-2 mt-3 text-[13px] text-[#B45309]">
          請告訴我您的行程需求，我會為您安排最好的接送服務
        </div>
      </BotBubble>

      {/* User selections shown inline */}
      {userSelections.map((sel, idx) => {
        const prevStepShown = userSelections.slice(0, idx).map(s => s.step)
        if (!prevStepShown.includes(sel.step)) {
          return <UserBubble key={idx} text={sel.text} />
        }
        return null
      })}

      {/* ===== STEP 1: Order Type ===== */}
      {step === 1 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請問您需要什麼服務？
          </p>
          <OptGrid cols={2}>
            <OptButton
              label="接機 / 接船"
              sub="從機場或港口接您"
              icon="接"
              onClick={() => { set({ orderType: 'pickup' }); addUser('接機/接船'); setStep(2) }}
              selected={form.orderType === 'pickup'}
            />
            <OptButton
              label="送機 / 送船"
              sub="載您到機場或港口"
              icon="送"
              onClick={() => { set({ orderType: 'dropoff' }); addUser('送機/送船'); setStep(2) }}
              selected={form.orderType === 'dropoff'}
            />
          </OptGrid>
        </BotBubble>
      )}

      {/* ===== STEP 2: Airport ===== */}
      {step === 2 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請問從哪裡上車？
          </p>
          <OptGrid cols={3}>
            {AIRPORT_KEYS.map(key => (
              <OptButton
                key={key}
                label={AIRPORT_LABELS[key]}
                onClick={() => {
                  const airport = AIRPORT_LABELS[key]
                  set({ airport: key, pickupLocation: key === 'OTHER' ? '' : airport, dropoffLocation: key === 'OTHER' ? '' : airport })
                  addUser(airport)
                  setStep(3)
                }}
                selected={form.airport === key}
              />
            ))}
          </OptGrid>
          <button
            onClick={() => setStep(1)}
            className="w-full py-2 mt-3 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
          >
            回上一步
          </button>
        </BotBubble>
      )}

      {/* ===== STEP 3: Date & Time ===== */}
      {step === 3 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請選擇搭乘日期和時間
          </p>
          <div className="flex gap-2 mt-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">日期</label>
              <InputField
                type="date"
                value={form.scheduledDate}
                onChange={v => set({ scheduledDate: v })}
                placeholder=""
                className="mt-1"
              />
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => set({ scheduledDate: setToday() })} className="py-1 px-3 rounded-full border border-[#DDDDDD] bg-white text-[11px] font-semibold text-[#717171] cursor-pointer hover:border-[#E8A855]">今天</button>
                <button onClick={() => set({ scheduledDate: setTomorrow() })} className="py-1 px-3 rounded-full border border-[#DDDDDD] bg-white text-[11px] font-semibold text-[#717171] cursor-pointer hover:border-[#E8A855]">明天</button>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">時間</label>
              <InputField
                type="time"
                value={form.scheduledTime}
                onChange={v => set({ scheduledTime: v })}
                placeholder=""
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-2 bg-white text-[#717171] border-2 border-[#DDDDDD] rounded-xl text-[13px] font-semibold cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
            >
              回上一步
            </button>
            <button
              onClick={() => {
                if (form.scheduledDate && form.scheduledTime) {
                  addUser(formatTime24(form.scheduledDate, form.scheduledTime))
                  setStep(4)
                }
              }}
              disabled={!form.scheduledDate || !form.scheduledTime}
              className="flex-1 py-2 bg-[#1C1917] text-white border-2 border-[#1C1917] rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#333] disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </BotBubble>
      )}

      {/* ===== STEP 4: Flight Number ===== */}
      {step === 4 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請輸入航班號碼
            <span className="text-[11px] text-[#A8A29E] ml-2">
              （{isPickupOrder(form.orderType) ? '接機必填' : '送機選填'}）
            </span>
          </p>
          <div className="mt-3">
            <InputField
              value={form.flightNumber}
              onChange={v => set({ flightNumber: v.toUpperCase() })}
              placeholder="例如：BR 32"
            />
          </div>
          {isPickupOrder(form.orderType) && (
            <p className="text-[11px] text-[#E24B4A] mt-1.5">接機航班必填</p>
          )}
          {!isPickupOrder(form.orderType) && (
            <button
              onClick={() => { addUser('略過'); setStep(5) }}
              className="mt-2 text-[11px] text-[#717171] hover:text-[#E8A855] underline cursor-pointer bg-transparent border-none p-0"
            >
              略過
            </button>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-2 bg-white text-[#717171] border-2 border-[#DDDDDD] rounded-xl text-[13px] font-semibold cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
            >
              回上一步
            </button>
            <button
              onClick={() => {
                if (isPickupOrder(form.orderType) && !form.flightNumber) return
                if (form.flightNumber) addUser(form.flightNumber)
                else addUser('略過')
                setStep(5)
              }}
              disabled={isPickupOrder(form.orderType) && !form.flightNumber}
              className="flex-1 py-2 bg-[#1C1917] text-white border-2 border-[#1C1917] rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#333] disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </BotBubble>
      )}

      {/* ===== STEP 5: Vehicle Type ===== */}
      {step === 5 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請選擇車型
          </p>
          <OptGrid cols={2}>
            {pricing.filter(p => p.enabled).map(p => (
              <OptButton
                key={p.vehicleType}
                label={VEHICLE_LABELS[p.vehicleType] || p.vehicleType}
                icon={VEHICLE_ICONS[p.vehicleType] || p.vehicleType[0].toUpperCase()}
                onClick={() => { set({ vehicleType: p.vehicleType as 'small' | 'suv' | 'van9' }); addUser(VEHICLE_LABELS[p.vehicleType] || p.vehicleType); setStep(6) }}
                selected={form.vehicleType === p.vehicleType}
              />
            ))}
          </OptGrid>
          <button
            onClick={() => setStep(4)}
            className="w-full py-2 mt-3 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
          >
            回上一步
          </button>
        </BotBubble>
      )}

      {/* ===== STEP 6: Passenger Count ===== */}
      {step === 6 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請問乘客有幾位？
          </p>
          <OptGrid cols={4}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <OptButton
                key={n}
                label={`${n}人`}
                onClick={() => { set({ passengerCount: n }); addUser(`${n}人`); setStep(7) }}
                selected={form.passengerCount === n}
              />
            ))}
          </OptGrid>
          <button
            onClick={() => setStep(5)}
            className="w-full py-2 mt-3 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
          >
            回上一步
          </button>
        </BotBubble>
      )}

      {/* ===== STEP 7: Luggage Size ===== */}
      {step === 7 && form.luggageStep === 'size' && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請問有什麼行李？
          </p>
          <OptGrid cols={3}>
            {['胖胖箱', '28吋', '24吋', '20吋', '其他尺寸', '無行李'].map(size => (
              <OptButton
                key={size}
                label={size}
                onClick={() => {
                  if (size === '無行李') {
                    addUser('無行李')
                    set({ luggageItems: [], luggageStep: 'done' })
                    setStep(8)
                  } else {
                    set({ currentLuggageSize: size, luggageStep: 'quantity' })
                  }
                }}
              />
            ))}
          </OptGrid>
          <button
            onClick={() => setStep(6)}
            className="w-full py-2 mt-3 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
          >
            回上一步
          </button>
        </BotBubble>
      )}

      {/* STEP 7b: Luggage Quantity */}
      {step === 7 && form.luggageStep === 'quantity' && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            選擇了【<strong className="text-[#E8A855]">{form.currentLuggageSize}</strong>】，請問有幾件？
          </p>
          <OptGrid cols={3}>
            {[1, 2, 3, 4].map(qty => (
              <OptButton
                key={qty}
                label={`${qty}件`}
                onClick={() => set({ currentLuggageQty: qty, luggageStep: 'confirm' })}
                selected={form.currentLuggageQty === qty}
              />
            ))}
          </OptGrid>
        </BotBubble>
      )}

      {/* STEP 7c: Luggage Confirm */}
      {step === 7 && form.luggageStep === 'confirm' && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            已加入【<strong className="text-[#E8A855]">{form.currentLuggageSize} x {form.currentLuggageQty}</strong>】
          </p>
          {form.luggageItems.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {form.luggageItems.map((item, idx) => (
                <LuggageChip
                  key={idx}
                  item={item}
                  onRemove={() => setForm(prev => ({ ...prev, luggageItems: prev.luggageItems.filter((_, i) => i !== idx) }))}
                />
              ))}
              <LuggageChip
                item={{ size: form.currentLuggageSize!, quantity: form.currentLuggageQty }}
                onRemove={() => set({ luggageStep: 'quantity' })}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => {
                const newItems = [...form.luggageItems, { size: form.currentLuggageSize!, quantity: form.currentLuggageQty }]
                addUser(`行李 ${formatLuggageSummary(newItems)}`)
                set({ luggageItems: newItems, luggageStep: 'done' })
                setStep(8)
              }}
              className="py-2.5 px-2 rounded-xl bg-[#1C1917] text-white text-[12px] font-semibold border-2 border-[#1C1917] hover:bg-[#333] cursor-pointer"
            >
              確定，沒了
            </button>
            <button
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  luggageItems: [...prev.luggageItems, { size: prev.currentLuggageSize!, quantity: prev.currentLuggageQty }],
                  currentLuggageSize: null,
                  luggageStep: 'size',
                }))
              }}
              className="py-2.5 px-2 rounded-xl bg-white text-[#222222] text-[12px] font-semibold border-2 border-[#DDDDDD] hover:border-[#E8A855] cursor-pointer"
            >
              + 還要再加
            </button>
          </div>
        </BotBubble>
      )}

      {/* ===== STEP 8: Pickup/Dropoff Location ===== */}
      {step === 8 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請填寫另一端的地點：
          </p>
          {isPickupOrder(form.orderType) ? (
            <p className="text-[13px] text-[#717171] mt-1 mb-2">
              上車地點：<strong className="text-[#E8A855]">{AIRPORT_LABELS[form.airport!] || form.airport}</strong>
            </p>
          ) : (
            <p className="text-[13px] text-[#717171] mt-1 mb-2">
              目的地：<strong className="text-[#E8A855]">{AIRPORT_LABELS[form.airport!] || form.airport}</strong>
            </p>
          )}
          <div className="mt-2">
            <InputField
              value={isPickupOrder(form.orderType) ? form.dropoffLocation : form.pickupLocation}
              onChange={v => isPickupOrder(form.orderType) ? set({ dropoffLocation: v }) : set({ pickupLocation: v })}
              placeholder={isPickupOrder(form.orderType) ? '輸入目的地，例如：新竹火車站' : '輸入上車地點，例如：新竹火車站'}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setStep(7)}
              className="flex-1 py-2 bg-white text-[#717171] border-2 border-[#DDDDDD] rounded-xl text-[13px] font-semibold cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
            >
              回上一步
            </button>
            <button
              onClick={() => {
                const loc = isPickupOrder(form.orderType) ? form.dropoffLocation : form.pickupLocation
                if (loc) { addUser(loc); setStep(9) }
              }}
              disabled={!((isPickupOrder(form.orderType) ? form.dropoffLocation : form.pickupLocation))}
              className="flex-1 py-2 bg-[#1C1917] text-white border-2 border-[#1C1917] rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#333] disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </BotBubble>
      )}

      {/* ===== STEP 9: Contact Info ===== */}
      {step === 9 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請輸入聯絡人姓名和電話
          </p>
          <div className="flex gap-2 mt-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">姓名</label>
              <InputField
                value={form.contactName}
                onChange={v => set({ contactName: v })}
                placeholder="王小明"
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">電話</label>
              <InputField
                type="tel"
                value={form.contactPhone}
                onChange={v => set({ contactPhone: v })}
                placeholder="0912345678"
                className="mt-1"
              />
            </div>
          </div>
          {!isValidTaiwanPhone(form.contactPhone) && form.contactPhone.length > 0 && (
            <p className="text-[11px] text-[#E24B4A] mt-1.5">請輸入有效的手機號碼</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setStep(8)}
              className="flex-1 py-2 bg-white text-[#717171] border-2 border-[#DDDDDD] rounded-xl text-[13px] font-semibold cursor-pointer hover:border-[#E8A855] hover:text-[#1C1917]"
            >
              回上一步
            </button>
            <button
              onClick={() => {
                if (form.contactName && form.contactPhone && isValidTaiwanPhone(form.contactPhone)) {
                  addUser(`${form.contactName} ${form.contactPhone}`)
                  setStep(10)
                }
              }}
              disabled={!form.contactName || !form.contactPhone || !isValidTaiwanPhone(form.contactPhone)}
              className="flex-1 py-2 bg-[#1C1917] text-white border-2 border-[#1C1917] rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#333] disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </BotBubble>
      )}

      {/* ===== STEP 10: Summary ===== */}
      {step === 10 && (
        <BotBubble>
          <p className="text-[14px] text-[#222222]">
            請確認您的行程資訊
          </p>

          {/* Summary Table */}
          <div className="bg-[#F9F7F4] border border-[#EBEBEB] rounded-xl p-3 mt-3">
            <div className="divide-y divide-[#EBEBEB]">
              <div className="flex justify-between py-2 text-[12px]">
                <span className="text-[#717171]">行程類型</span>
                <span className="font-semibold text-[#222222]">{ORDER_TYPE_LABELS[form.orderType!]}</span>
              </div>
              <div className="flex justify-between py-2 text-[12px]">
                <span className="text-[#717171]">日期 / 時間</span>
                <span className="font-semibold text-[#222222]">{formatTime24(form.scheduledDate, form.scheduledTime)}</span>
              </div>
              {form.flightNumber && (
                <div className="flex justify-between py-2 text-[12px]">
                  <span className="text-[#717171]">航班</span>
                  <span className="font-semibold text-[#222222]">{form.flightNumber}</span>
                </div>
              )}
              <div className="flex justify-between py-2 text-[12px]">
                <span className="text-[#717171]">上車地點</span>
                <span className="font-semibold text-[#222222]">{isPickupOrder(form.orderType) ? (AIRPORT_LABELS[form.airport!] || form.airport) : form.pickupLocation}</span>
              </div>
              <div className="flex justify-between py-2 text-[12px]">
                <span className="text-[#717171]">目的地</span>
                <span className="font-semibold text-[#222222]">{isPickupOrder(form.orderType) ? form.dropoffLocation : (AIRPORT_LABELS[form.airport!] || form.airport)}</span>
              </div>
              <div className="flex justify-between py-2 text-[12px]">
                <span className="text-[#717171]">車型</span>
                <span className="font-semibold text-[#222222]">{VEHICLE_LABELS[form.vehicleType!]}</span>
              </div>
              <div className="flex justify-between py-2 text-[12px]">
                <span className="text-[#717171]">乘客 / 行李</span>
                <span className="font-semibold text-[#222222]">{form.passengerCount}人 / {formatLuggageSummary(form.luggageItems)}</span>
              </div>
              <div className="flex justify-between py-2 text-[12px]">
                <span className="text-[#717171]">聯絡人</span>
                <span className="font-semibold text-[#222222]">{form.contactName} {form.contactPhone}</span>
              </div>
            </div>

            {/* Price - only shown at Step 10 */}
            {selectedPrice !== null && (
              <div className="mt-3 pt-3 border-t border-[#E8A855] flex justify-between items-center">
                <span className="text-[13px] font-bold text-[#1C1917]">費用</span>
                <span className="text-[24px] font-black font-mono-nums text-[#E8A855] leading-none">NT$ {selectedPrice.toLocaleString()}</span>
              </div>
            )}
          </div>

          {submitError && (
            <div className="mt-3 px-3 py-2 bg-[#FCEBEB] border border-[#E24B4A] rounded-xl text-[12px] text-[#E24B4A]">
              {submitError}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-[#1C1917] text-white rounded-xl text-[14px] font-bold cursor-pointer hover:bg-[#333] disabled:opacity-60"
            >
              {submitting ? '送出中...' : '確認送出'}
            </button>
            <button
              onClick={() => {
                setForm({ ...DEFAULT_FORM, luggageStep: 'size' })
                setStep(1)
              }}
              className="flex-1 py-3 bg-white text-[#1C1917] border-2 border-[#1C1917] rounded-xl text-[14px] font-bold cursor-pointer hover:bg-[#F4EFE9]"
            >
              修改
            </button>
          </div>
        </BotBubble>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
