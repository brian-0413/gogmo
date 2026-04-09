'use client'

import { useState, useRef, useEffect } from 'react'

// ============ Types ============
interface LuggageItem {
  size: string
  quantity: number
}

interface FormData {
  tripMode: 'pickup' | 'dropoff' | null
  pickupPlace: string | null
  orderType: 'pickup' | 'dropoff' | 'pickup_boat' | 'dropoff_boat' | null
  scheduledDate: string
  scheduledTime: string
  flightNumber: string
  vehicleType: 'small' | 'suv' | 'van9' | null
  passengerCount: number | null
  luggageItems: LuggageItem[]
  luggageStep: 'size' | 'quantity' | 'confirm' | 'done'
  currentLuggageSize: string | null
  currentLuggageQty: number
  otherLocation: string
  contactName: string
  contactPhone: string
  feeMode: 'transfer' | 'cash_collection' | null
  driverAmount: number
  cashCollected: number
  commissionReturn: number
  specialNeeds: string[]
  notes: string
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

interface SelfDispatchChatProps {
  token: string
  onSuccess: () => void
  onClose: () => void
}

// ============ Defaults ============
const DEFAULT_FORM: FormData = {
  tripMode: null,
  pickupPlace: null,
  orderType: null,
  scheduledDate: '',
  scheduledTime: '',
  flightNumber: '',
  vehicleType: null,
  passengerCount: null,
  luggageItems: [],
  luggageStep: 'size',
  currentLuggageSize: null,
  currentLuggageQty: 1,
  otherLocation: '',
  contactName: '',
  contactPhone: '',
  feeMode: null,
  driverAmount: 0,
  cashCollected: 0,
  commissionReturn: 0,
  specialNeeds: [],
  notes: '',
}

// ============ Labels ============
const TRIP_MODE_LABELS: Record<string, string> = {
  pickup: '接機/船',
  dropoff: '送機/船',
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  pickup: '接機',
  dropoff: '送機',
  pickup_boat: '接船',
  dropoff_boat: '送船',
}

const VEHICLE_LABELS: Record<string, string> = {
  small: '小車(5人)',
  suv: '休旅(7人)',
  van9: '9人座',
}

const FEE_MODE_LABELS: Record<string, string> = {
  transfer: '客下轉帳',
  cash_collection: '代收現金',
}

const SPECIAL_NEED_LABELS: Record<string, string> = {
  sign: '舉牌',
  car_seat: '安全座椅',
  other_need: '其他',
}

// ============ Helpers ============
function computeOrderType(tripMode: string | null, pickupPlace: string | null): FormData['orderType'] {
  if (!tripMode || !pickupPlace) return null
  const isBoat = pickupPlace.includes('港')
  if (isBoat) return tripMode === 'pickup' ? 'pickup_boat' : 'dropoff_boat'
  return tripMode === 'pickup' ? 'pickup' : 'dropoff'
}

function formatLuggageSummary(items: LuggageItem[]): string {
  if (items.length === 0) return '無'
  return items.map(i => `${i.size} x ${i.quantity}`).join(', ')
}

function formatTime24(date: string, time: string): string {
  if (!date || !time) return ''
  const [h, m] = time.split(':')
  return `${date.replace(/-/g, '/')} ${h}:${m}`
}

function isPickupOrder(orderType: string | null): boolean {
  return orderType === 'pickup' || orderType === 'pickup_boat'
}

// 台灣手機號碼驗證（09開頭 10碼，或 +886/886 格式）
function isValidTaiwanPhone(phone: string): boolean {
  return /^(?:(?:\+886|886)?0?9\d{8})$/.test(phone.replace(/-/g, ''))
}

// ============ Sub-components ============
function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full bg-[#FF385C] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
        G
      </div>
      <div className="bg-[#F9F7F4] border border-[#EBEBEB] rounded-tr-xl rounded-br-xl rounded-tl-xl px-4 py-2.5 max-w-full text-[13px]">
        {children}
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-[#FF385C] text-white rounded-tl-xl rounded-bl-xl rounded-tr-xl px-4 py-2 max-w-[75%] text-[13px] font-semibold">
        {text}
      </div>
    </div>
  )
}

function OptButton({
  label,
  onClick,
  selected = false,
  className = '',
}: {
  label: string
  onClick: () => void
  selected?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2 px-2 rounded-xl border-2 text-[12px] font-semibold cursor-pointer transition-all text-center leading-tight ${selected
        ? 'bg-[#FFF3F5] border-[#FF385C] text-[#FF385C]'
        : 'bg-white text-[#222222] border-[#DDDDDD] hover:border-[#FF385C] hover:text-[#FF385C]'
        } ${className}`}
    >
      {label}
    </button>
  )
}

function OptGrid({ cols, children }: { cols: 2 | 3 | 4; children: React.ReactNode }) {
  const gridClass = cols === 4 ? 'grid grid-cols-4' : cols === 3 ? 'grid grid-cols-3' : 'grid grid-cols-2'
  return <div className={`${gridClass} gap-1.5 mt-2`}>{children}</div>
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
      className={`px-3 py-2 border-2 border-[#DDDDDD] rounded-xl text-[13px] outline-none focus:border-[#FF385C] bg-white w-full max-w-full ${className}`}
    />
  )
}

function MoneyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#FFF3F5] border border-[#FFE0E9] rounded-xl p-3 mt-2">
      {children}
    </div>
  )
}

function MoneyRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const displayValue = value === 0 ? '' : String(value)
  return (
    <div className="flex items-center gap-1.5 mb-2 last:mb-0">
      <span className="text-[12px] font-semibold text-[#717171] whitespace-nowrap min-w-[64px]">{label}</span>
      <div className="flex-1 flex items-center gap-1">
        <span className="text-[13px] text-[#717171]">NT$</span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={e => {
            const digits = e.target.value.replace(/[^\d]/g, '')
            onChange(digits === '' ? 0 : parseInt(digits, 10))
          }}
          placeholder="0"
          className="flex-1 px-2 py-1.5 border-2 border-[#DDDDDD] rounded-lg text-[13px] outline-none focus:border-[#FF385C] bg-white w-full"
        />
      </div>
    </div>
  )
}

function MoneyResult({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between items-center px-3 py-2 bg-[#FF385C] text-white rounded-lg mt-2">
      <span className="text-[12px] font-bold">{label}</span>
      <span className="text-[18px] font-extrabold">NT${amount.toLocaleString()}</span>
    </div>
  )
}

function LuggageChip({ item, onRemove }: { item: LuggageItem; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#F4EFE9] border border-[#DDDDDD] rounded-full text-[11px]">
      <span>{item.size} x {item.quantity}</span>
      <button onClick={onRemove} className="text-[#A8A29E] hover:text-[#FF385C] font-bold ml-0.5">x</button>
    </div>
  )
}

function Summary({ form, finalAmount }: { form: FormData; finalAmount: number }) {
  const typeLabel = form.orderType ? ORDER_TYPE_LABELS[form.orderType] : '-'
  const vehicleLabel = form.vehicleType ? VEHICLE_LABELS[form.vehicleType] : '-'

  const rows: { key: string; val: string; accent?: boolean }[] = [
    { key: '類型', val: typeLabel },
    { key: '航班', val: form.flightNumber || '無' },
    { key: '時間', val: form.scheduledDate && form.scheduledTime ? formatTime24(form.scheduledDate, form.scheduledTime) : '-' },
    { key: '上車', val: isPickupOrder(form.orderType) ? (form.pickupPlace || '-') : (form.otherLocation || '-') },
    { key: '目的地', val: isPickupOrder(form.orderType) ? (form.otherLocation || '-') : (form.pickupPlace || '-') },
    { key: '車型', val: vehicleLabel },
    { key: '乘客/行李', val: `${form.passengerCount ?? '-'}人 / ${formatLuggageSummary(form.luggageItems)}` },
    { key: '費用模式', val: form.feeMode ? FEE_MODE_LABELS[form.feeMode] : '-' },
  ]

  if (form.feeMode === 'cash_collection') {
    rows.push({ key: '代收', val: `NT$${form.cashCollected.toLocaleString()}` })
    rows.push({ key: '回金', val: `NT$${form.commissionReturn.toLocaleString()}` })
  }

  rows.push({ key: '司機實拿', val: `NT$${finalAmount.toLocaleString()}`, accent: true })

  if (form.specialNeeds.length > 0) {
    rows.push({ key: '特殊需求', val: form.specialNeeds.map(s => SPECIAL_NEED_LABELS[s]).join(', ') })
  }

  if (form.notes) {
    rows.push({ key: '備註', val: form.notes })
  }

  return (
    <div className="bg-[#F9F7F4] border border-[#EBEBEB] rounded-xl p-3 mt-2">
      <div className="text-[11px] font-bold text-[#FF385C] uppercase tracking-wider mb-2">發單摘要</div>
      {rows.map(row => (
        <div key={row.key} className="flex justify-between py-1.5 border-b border-[#EBEBEB] text-[12px] last:border-b-0">
          <span className="text-[#717171]">{row.key}</span>
          <span className={`font-semibold ${row.accent ? 'text-[#FF385C]' : 'text-[#222222]'}`}>{row.val}</span>
        </div>
      ))}
    </div>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const total = 14
  return (
    <div className="px-4 py-3 text-center border-t border-[#F0EDE8]">
      <div className="flex gap-0.5 mb-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-[3px] rounded-sm ${i < step ? 'bg-[#FF385C]' : i === step ? 'bg-[#FFB3C1]' : 'bg-[#EBEBEB]'}`}
          />
        ))}
      </div>
      <div className="text-[10px] text-[#A8A29E] font-medium">步驟 {step} / {total}</div>
    </div>
  )
}

// ============ Main Component ============
export function SelfDispatchChat({ token, onSuccess, onClose }: SelfDispatchChatProps) {
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const set = (patch: Partial<FormData>) =>
    setForm(prev => ({ ...prev, ...patch }))

  const finalAmount =
    form.feeMode === 'transfer'
      ? form.driverAmount
      : form.cashCollected - form.commissionReturn

  const typeLabel = form.orderType
    ? ORDER_TYPE_LABELS[form.orderType]
    : form.tripMode
    ? TRIP_MODE_LABELS[form.tripMode]
    : ''

  const flightRequired = isPickupOrder(form.orderType)

  // 自動滾動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, step])

  const addUser = (text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }])
  }

  const toggleSpecialNeed = (need: string) => {
    setForm(prev => ({
      ...prev,
      specialNeeds: prev.specialNeeds.includes(need)
        ? prev.specialNeeds.filter(n => n !== need)
        : [...prev.specialNeeds, need],
    }))
  }

  // ============ Step Handlers ============
  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const scheduledDateTime = new Date(`${form.scheduledDate}T${form.scheduledTime}:00`)
      const isPickup = isPickupOrder(form.orderType)

      const res = await fetch('/api/orders/self-publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderType: form.orderType,
          scheduledTime: scheduledDateTime.toISOString(),
          flightNumber: form.flightNumber,
          vehicleType: form.vehicleType,
          passengerCount: form.passengerCount,
          luggage: form.luggageItems,
          pickupLocation: isPickup ? (form.pickupPlace || '') : form.otherLocation,
          dropoffLocation: isPickup ? form.otherLocation : (form.pickupPlace || ''),
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          feeMode: form.feeMode,
          driverAmount: form.feeMode === 'transfer' ? form.driverAmount : (form.cashCollected - form.commissionReturn),
          cashCollected: form.cashCollected,
          commissionReturn: form.commissionReturn,
          specialNeeds: form.specialNeeds,
          notes: form.notes,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onSuccess()
      } else {
        setSubmitError(data.error || '發單失敗，請稍後再試')
        setMessages(prev => [...prev, {
          role: 'bot',
          text: `發單失敗：${data.error || '請稍後再試'}`,
        }])
      }
    } catch {
      setSubmitError('網路錯誤')
      setMessages(prev => [...prev, {
        role: 'bot',
        text: '網路錯誤，請稍後再試',
      }])
    } finally {
      setSubmitting(false)
    }
  }

  // ============ Date shortcuts ============
  const setToday = () => {
    const d = new Date()
    const fmt = (n: number) => String(n).padStart(2, '0')
    set({ scheduledDate: `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())}` })
  }
  const setTomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const fmt = (n: number) => String(n).padStart(2, '0')
    set({ scheduledDate: `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())}` })
  }
  const setDayAfter = () => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    const fmt = (n: number) => String(n).padStart(2, '0')
    set({ scheduledDate: `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())}` })
  }

  // ============ Render ============
  return (
    <div className="max-w-[480px] mx-auto">
      <div className="bg-white border border-[#DDDDDD] rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        {/* Header */}
        <div className="bg-[#FF385C] text-white px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">G</div>
          <div>
            <div className="text-[15px] font-bold leading-tight">goGMO 小車頭</div>
            <div className="text-[11px] opacity-80">Premium 司機專屬發單</div>
          </div>
          <button onClick={onClose} className="ml-auto text-white/80 hover:text-white text-xl font-light leading-none px-1">x</button>
        </div>

        {/* Body */}
        <div className="p-4 min-h-[520px] max-h-[600px] overflow-y-auto flex flex-col gap-3">

          {/* ===== STEP 1: Trip Mode ===== */}
          {step === 1 && (
            <BotBubble>
              <p>您好！請問是 <strong className="text-[#FF385C]">接機/船</strong> 還是 <strong className="text-[#FF385C]">送機/船</strong>？</p>
              <OptGrid cols={2}>
                <OptButton label="接 機 / 船" onClick={() => { set({ tripMode: 'pickup' }); addUser('接機/船'); setStep(2) }} />
                <OptButton label="送 機 / 船" onClick={() => { set({ tripMode: 'dropoff' }); addUser('送機/船'); setStep(2) }} />
              </OptGrid>
            </BotBubble>
          )}

          {/* ===== STEP 2: Pickup Place ===== */}
          {step === 2 && (
            <BotBubble>
              <p>好的！請選擇 <strong className="text-[#FF385C]">上車地點</strong>：</p>
              <OptGrid cols={3}>
                {['桃園機場', '松山機場', '清泉崗', '小港', '基隆港', '其他'].map(place => (
                  <OptButton key={place} label={place} onClick={() => {
                    set({ pickupPlace: place, orderType: computeOrderType(form.tripMode, place) })
                    addUser(place)
                    setStep(3)
                  }} />
                ))}
              </OptGrid>
              <button
                onClick={() => setStep(1)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 3: Date only ===== */}
          {step === 3 && (
            <BotBubble>
              <p>已設定為【<strong className="text-[#FF385C]">{typeLabel}</strong>】！請選擇 <strong className="text-[#FF385C]">日期</strong>：</p>
              <div className="mt-2">
                <InputField
                  type="date"
                  value={form.scheduledDate}
                  onChange={v => set({ scheduledDate: v })}
                  placeholder="選擇日期"
                  className="w-full max-w-full"
                />
              </div>
              <div className="flex gap-1.5 mt-2">
                <button onClick={setToday} className="py-1 px-3 rounded-full border border-[#DDDDDD] bg-white text-[#717171] text-[11px] font-semibold hover:border-[#FF385C] hover:text-[#FF385C] cursor-pointer transition-all">今天</button>
                <button onClick={setTomorrow} className="py-1 px-3 rounded-full border border-[#DDDDDD] bg-white text-[#717171] text-[11px] font-semibold hover:border-[#FF385C] hover:text-[#FF385C] cursor-pointer transition-all">明天</button>
                <button onClick={setDayAfter} className="py-1 px-3 rounded-full border border-[#DDDDDD] bg-white text-[#717171] text-[11px] font-semibold hover:border-[#FF385C] hover:text-[#FF385C] cursor-pointer transition-all">後天</button>
              </div>
              <button
                onClick={() => {
                  if (form.scheduledDate) {
                    addUser(form.scheduledDate)
                    setStep(4)
                  }
                }}
                disabled={!form.scheduledDate}
                className="mt-2 w-full py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 4: Time only ===== */}
          {step === 4 && (
            <BotBubble>
              <p>請選擇 <strong className="text-[#FF385C]">時間</strong>：</p>
              <div className="mt-2">
                <InputField
                  type="time"
                  value={form.scheduledTime}
                  onChange={v => set({ scheduledTime: v })}
                  placeholder="選擇時間"
                  className="w-full max-w-full"
                />
              </div>
              <button
                onClick={() => {
                  if (form.scheduledTime) {
                    addUser(form.scheduledTime)
                    setStep(5)
                  }
                }}
                disabled={!form.scheduledTime}
                className="mt-2 w-full py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 5: Flight Number ===== */}
          {step === 5 && (
            <BotBubble>
              <p>請輸入<strong className="text-[#FF385C]">航班號碼</strong>（{flightRequired ? '接機必填' : '送機選填'}）：</p>
              <div className="flex gap-1.5 mt-2 max-w-full">
                <input
                  type="text"
                  value={form.flightNumber}
                  onChange={e => set({ flightNumber: e.target.value })}
                  placeholder="例如：BR 32"
                  className="flex-1 px-3 py-2 border-2 border-[#DDDDDD] rounded-xl text-[13px] outline-none focus:border-[#FF385C] bg-white w-full max-w-full"
                />
                <button
                  onClick={() => {
                    if (flightRequired && !form.flightNumber) return
                    if (form.flightNumber) addUser(form.flightNumber)
                    else addUser('略過')
                    setStep(6)
                  }}
                  disabled={flightRequired && !form.flightNumber}
                  className="px-4 py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  下一步
                </button>
              </div>
              {!flightRequired && (
                <button
                  onClick={() => { addUser('略過'); setStep(6) }}
                  className="mt-2 text-[11px] text-[#717171] hover:text-[#FF385C] underline cursor-pointer bg-transparent border-none"
                >
                  略過
                </button>
              )}
              <button
                onClick={() => setStep(4)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 6: Vehicle Type ===== */}
          {step === 6 && (
            <BotBubble>
              <p>請選擇<strong className="text-[#FF385C]">車型</strong>：</p>
              <OptGrid cols={3}>
                {[['小車(5人)', 'small'], ['休旅(7人)', 'suv'], ['9人座', 'van9']].map(([label, vt]) => (
                  <OptButton key={vt} label={label} onClick={() => { set({ vehicleType: vt as FormData['vehicleType'] }); addUser(label); setStep(7) }} />
                ))}
              </OptGrid>
            </BotBubble>
          )}

          {/* ===== STEP 7: Passenger Count ===== */}
          {step === 7 && (
            <BotBubble>
              <p>請問<strong className="text-[#FF385C]">乘客數</strong>？</p>
              <OptGrid cols={4}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <OptButton key={n} label={`${n}人`} onClick={() => { set({ passengerCount: n }); addUser(`${n}人`); setStep(8) }} />
                ))}
              </OptGrid>
              <button
                onClick={() => setStep(6)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 8: Luggage Size ===== */}
          {step === 8 && form.luggageStep === 'size' && (
            <BotBubble>
              <p>請問有什麼<strong className="text-[#FF385C]">行李尺寸</strong>？</p>
              <OptGrid cols={3}>
                {['胖胖箱', '28吋', '24吋', '20吋', '其他', '無行李'].map(size => (
                  <OptButton key={size} label={size} onClick={() => {
                    if (size === '無行李') {
                      addUser('無行李')
                      set({ luggageItems: [], luggageStep: 'done' })
                      setStep(9)
                    } else {
                      set({ currentLuggageSize: size, luggageStep: 'quantity' })
                    }
                  }} />
                ))}
              </OptGrid>
            </BotBubble>
          )}

          {/* ===== STEP 8b: Luggage Quantity ===== */}
          {step === 8 && form.luggageStep === 'quantity' && (
            <BotBubble>
              <p>選擇了【<strong className="text-[#FF385C]">{form.currentLuggageSize}</strong>】，請問有幾件？</p>
              <OptGrid cols={3}>
                {[1, 2, 3, 4].map(qty => (
                  <OptButton key={qty} label={`${qty}件`} onClick={() => set({ currentLuggageQty: qty, luggageStep: 'confirm' })} />
                ))}
              </OptGrid>
            </BotBubble>
          )}

          {/* ===== STEP 8c: Luggage Confirm ===== */}
          {step === 8 && form.luggageStep === 'confirm' && (
            <BotBubble>
              <p>已加入【<strong className="text-[#FF385C]">{form.currentLuggageSize} x {form.currentLuggageQty}</strong>】</p>
              {form.luggageItems.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.luggageItems.map((item, idx) => (
                    <LuggageChip key={idx} item={item} onRemove={() => {
                      setForm(prev => ({ ...prev, luggageItems: prev.luggageItems.filter((_, i) => i !== idx) }))
                    }} />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <button
                  onClick={() => {
                    addUser(`行李 ${form.currentLuggageSize} x ${form.currentLuggageQty}`)
                    setForm(prev => ({
                      ...prev,
                      luggageItems: [...prev.luggageItems, { size: prev.currentLuggageSize!, quantity: prev.currentLuggageQty }],
                      luggageStep: 'done',
                    }))
                    setStep(9)
                  }}
                  className="py-2 px-2 rounded-xl bg-[#FF385C] text-white text-[12px] font-semibold border-2 border-[#FF385C] hover:bg-[#E83355] cursor-pointer"
                >
                  確定，沒了
                </button>
                <button
                  onClick={() => {
                    addUser(`行李 ${form.currentLuggageSize} x ${form.currentLuggageQty}，還有其他`)
                    setForm(prev => ({
                      ...prev,
                      luggageItems: [...prev.luggageItems, { size: prev.currentLuggageSize!, quantity: prev.currentLuggageQty }],
                      currentLuggageSize: null,
                      luggageStep: 'size',
                    }))
                  }}
                  className="py-2 px-2 rounded-xl bg-white text-[#222222] text-[12px] font-semibold border-2 border-[#DDDDDD] hover:border-[#FF385C] hover:text-[#FF385C] cursor-pointer"
                >
                  + 還有其他尺寸
                </button>
              </div>
            </BotBubble>
          )}

          {/* ===== STEP 9: Other Location ===== */}
          {step === 9 && (
            <BotBubble>
              <p>已設定【<strong className="text-[#FF385C]">{form.pickupPlace}</strong> {isPickupOrder(form.orderType) ? '→' : '←'} <strong className="text-[#FF385C]">{typeLabel}</strong>】</p>
              <p className="mt-2">請填寫<strong className="text-[#FF385C]">{isPickupOrder(form.orderType) ? '目的地' : '上車地點'}</strong>：</p>
              <div className="flex gap-1.5 mt-2 max-w-full">
                <input
                  type="text"
                  value={form.otherLocation}
                  onChange={e => set({ otherLocation: e.target.value })}
                  placeholder="輸入地址或地點"
                  className="flex-1 px-3 py-2 border-2 border-[#DDDDDD] rounded-xl text-[13px] outline-none focus:border-[#FF385C] bg-white w-full max-w-full"
                />
                <button
                  onClick={() => {
                    if (form.otherLocation) { addUser(form.otherLocation); setStep(10) }
                  }}
                  disabled={!form.otherLocation}
                  className="px-4 py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  下一步
                </button>
              </div>
              <button
                onClick={() => setStep(8)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 10: Contact ===== */}
          {step === 10 && (
            <BotBubble>
              <p>請輸入<strong className="text-[#FF385C]">聯絡人</strong>和<strong className="text-[#FF385C]">電話</strong>：</p>
              <div className="flex gap-1.5 mt-2 max-w-full">
                <input
                  type="text"
                  value={form.contactName}
                  onChange={e => set({ contactName: e.target.value })}
                  placeholder="姓名"
                  maxLength={50}
                  className="flex-1 px-3 py-2 border-2 border-[#DDDDDD] rounded-xl text-[13px] outline-none focus:border-[#FF385C] bg-white w-full max-w-full"
                />
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={e => set({ contactPhone: e.target.value })}
                  placeholder="電話"
                  maxLength={15}
                  className="flex-1 px-3 py-2 border-2 border-[#DDDDDD] rounded-xl text-[13px] outline-none focus:border-[#FF385C] bg-white w-full max-w-full"
                />
              </div>
              {!isValidTaiwanPhone(form.contactPhone) && form.contactPhone.length > 0 && (
                <p className="text-[11px] text-[#E24B4A] mt-1">請輸入有效的手機號碼（例：0912345678）</p>
              )}
              <button
                onClick={() => {
                  if (!isValidTaiwanPhone(form.contactPhone)) return
                  if (form.contactName && form.contactPhone) { addUser(`${form.contactName} ${form.contactPhone}`); setStep(11) }
                }}
                disabled={!form.contactName || !form.contactPhone || !isValidTaiwanPhone(form.contactPhone)}
                className="mt-2 w-full py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
              <button
                onClick={() => setStep(9)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 11: Fee Mode ===== */}
          {step === 11 && (
            <BotBubble>
              <p>請選擇<strong className="text-[#FF385C]">費用模式</strong>：</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => { set({ feeMode: 'transfer' }); addUser('客下轉帳'); setStep(12) }}
                  className={`border-2 rounded-xl p-3 text-center cursor-pointer transition-all ${form.feeMode === 'transfer' ? 'border-[#FF385C] bg-[#FFF3F5]' : 'border-[#DDDDDD] bg-white hover:border-[#FF385C]'}`}
                >
                  <div className="text-[18px] font-extrabold text-[#FF385C]">轉</div>
                  <div className="text-[12px] font-bold mt-0.5">客下轉帳</div>
                  <div className="text-[10px] text-[#717171] mt-0.5">派單人已收錢，直接匯給司機</div>
                </button>
                <button
                  onClick={() => { set({ feeMode: 'cash_collection' }); addUser('代收現金'); setStep(12) }}
                  className={`border-2 rounded-xl p-3 text-center cursor-pointer transition-all ${form.feeMode === 'cash_collection' ? 'border-[#FF385C] bg-[#FFF3F5]' : 'border-[#DDDDDD] bg-white hover:border-[#FF385C]'}`}
                >
                  <div className="text-[18px] font-extrabold text-[#FF385C]">現</div>
                  <div className="text-[12px] font-bold mt-0.5">代收現金</div>
                  <div className="text-[10px] text-[#717171] mt-0.5">司機收現後，回金傭金給派單人</div>
                </button>
              </div>
              <button
                onClick={() => setStep(10)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 12: Amount ===== */}
          {step === 12 && form.feeMode === 'transfer' && (
            <BotBubble>
              <p>選擇了 <strong className="text-[#FF385C]">客下轉帳</strong>，請輸入司機實拿金額：</p>
              <MoneyBox>
                <MoneyRow label="司機實拿" value={form.driverAmount} onChange={v => set({ driverAmount: v })} />
              </MoneyBox>
              <button
                onClick={() => {
                  if (form.driverAmount > 0) { addUser(`NT$ ${form.driverAmount.toLocaleString()}`); setStep(13) }
                }}
                disabled={!form.driverAmount}
                className="mt-2 w-full py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
              <button
                onClick={() => setStep(11)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {step === 12 && form.feeMode === 'cash_collection' && (
            <BotBubble>
              <p>選擇了 <strong className="text-[#FF385C]">代收現金</strong>模式，請填寫：</p>
              <MoneyBox>
                <MoneyRow label="代收金額" value={form.cashCollected} onChange={v => set({ cashCollected: v })} />
                <MoneyRow label="回金給派單" value={form.commissionReturn} onChange={v => set({ commissionReturn: v })} />
                {form.cashCollected > 0 && (
                  <>
                    <MoneyResult label="司機實拿" amount={Math.max(0, form.cashCollected - form.commissionReturn)} />
                    {form.commissionReturn > form.cashCollected && (
                      <div className="mt-1.5 px-2 py-1.5 bg-[#FCEBEB] border border-[#E24B4A] rounded-lg text-[11px] text-[#E24B4A]">回金不能超過代收金額</div>
                    )}
                  </>
                )}
              </MoneyBox>
              <button
                onClick={() => {
                  if (form.cashCollected > 0) { addUser(`代收 NT$ ${form.cashCollected.toLocaleString()} 回金 NT$ ${form.commissionReturn.toLocaleString()}`); setStep(13) }
                }}
                disabled={!form.cashCollected}
                className="mt-2 w-full py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
              <button
                onClick={() => setStep(11)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 13: Special Needs + Notes ===== */}
          {step === 13 && (
            <BotBubble>
              <p>請選擇<strong className="text-[#FF385C]">特殊需求</strong>（可複選）：</p>
              <OptGrid cols={3}>
                <OptButton label="舉牌" selected={form.specialNeeds.includes('sign')} onClick={() => toggleSpecialNeed('sign')} />
                <OptButton label="安全座椅" selected={form.specialNeeds.includes('car_seat')} onClick={() => toggleSpecialNeed('car_seat')} />
                <OptButton label="其他" selected={form.specialNeeds.includes('other_need')} onClick={() => toggleSpecialNeed('other_need')} />
              </OptGrid>
              <div className="mt-3">
                <textarea
                  value={form.notes}
                  onChange={e => set({ notes: e.target.value })}
                  placeholder="備註（選填）"
                  rows={2}
                  className="w-full px-3 py-2 border border-[#DDDDDD] rounded-xl text-[13px] text-[#222222] resize-none focus:outline-none focus:border-[#FF385C] max-w-full"
                />
              </div>
              <button
                onClick={() => {
                  const needs = form.specialNeeds.map(s => SPECIAL_NEED_LABELS[s]).join('、')
                  addUser(needs ? `需求：${needs}` : '無特殊需求')
                  if (form.notes) addUser(`備註：${form.notes}`)
                  setStep(14)
                }}
                className="mt-3 w-full py-2 bg-[#FF385C] text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#E83355]"
              >
                下一步
              </button>
              <button
                onClick={() => setStep(12)}
                className="w-full py-2 bg-white text-[#717171] border border-[#DDDDDD] rounded-xl text-[12px] font-medium cursor-pointer hover:border-[#FF385C] hover:text-[#FF385C]"
              >
                回上一步
              </button>
            </BotBubble>
          )}

          {/* ===== STEP 14: Summary ===== */}
          {step === 14 && (
            <BotBubble>
              <p>即將發單上架，請確認：</p>
              <Summary form={form} finalAmount={finalAmount} />
              {submitError && (
                <div className="mt-2 px-3 py-2 bg-[#FCEBEB] border border-[#E24B4A] rounded-xl text-[12px] text-[#E24B4A]">{submitError}</div>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-[#FF385C] text-white border-none rounded-xl text-[14px] font-bold cursor-pointer hover:bg-[#E83355] mt-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? '發單中...' : '確認發單上架'}
              </button>
              <button
                onClick={() => {
                  setForm({ ...DEFAULT_FORM, luggageStep: 'size' })
                  setStep(1)
                  setMessages([])
                }}
                className="w-full py-2.5 bg-white text-[#FF385C] border-2 border-[#FF385C] rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-[#FFF3F5] mt-2"
              >
                重新填寫
              </button>
            </BotBubble>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Step Indicator */}
        <StepIndicator step={step} />
      </div>
    </div>
  )
}
