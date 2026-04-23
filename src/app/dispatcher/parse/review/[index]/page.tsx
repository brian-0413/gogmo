'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Plus, X, Check, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import type { VehicleType } from '@/lib/vehicle'
import { VEHICLE_LABELS } from '@/lib/vehicle'

interface ParsedOrderItem {
  orderId: string
  time: string | null
  type: string | null
  pickup: string | null
  dropoff: string | null
  price: number | null
  rawText: string
  notes: string
  isConfirmed: boolean
  // 完整欄位
  date?: string
  vehicleType?: string
  pickupAddresses?: string[]
  dropoffAddresses?: string[]
  flightNumber?: string
  contactName?: string
  contactPhone?: string
  passengerCount?: number
  luggageCount?: number
  specialRequests?: string[]
  otherSpecialRequest?: string
  dispatcherNote?: string
}

interface ParseResult {
  orders: ParsedOrderItem[]
  date: string
  vehicleType: string
  originalMessage: string
}

export default function OrderEditPage() {
  const router = useRouter()
  const params = useParams()
  const index = parseInt(params.index as string, 10)

  const { token } = useAuth()
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [form, setForm] = useState({
    date: '',
    time: '',
    vehicleType: 'SEDAN_5' as VehicleType,
    vehicleCustom: '',
    type: 'pickup' as string,
    pickupAddresses: [''],
    dropoffAddresses: [''],
    flightNumber: '',
    price: '',
    contactName: '',
    contactPhone: '',
    passengerCount: '1',
    luggageCount: '0',
    specialRequests: [] as string[],
    otherSpecialRequest: '',
    dispatcherNote: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const stored = sessionStorage.getItem('parseResult')
    if (!stored) {
      router.replace('/dispatcher/parse')
      return
    }
    const result: ParseResult = JSON.parse(stored)
    setParseResult(result)

    const order = result.orders[index]
    if (order) {
      setForm({
        date: order.date || result.date || '',
        time: order.time || '',
        vehicleType: (order.vehicleType as VehicleType) || (result.vehicleType as VehicleType) || 'SEDAN_5',
        vehicleCustom: '',
        type: order.type || 'pickup',
        pickupAddresses: order.pickupAddresses?.length ? order.pickupAddresses : [order.pickup || ''],
        dropoffAddresses: order.dropoffAddresses?.length ? order.dropoffAddresses : [order.dropoff || ''],
        flightNumber: order.flightNumber || '',
        price: order.price?.toString() || '',
        contactName: order.contactName || '',
        contactPhone: order.contactPhone || '',
        passengerCount: String(order.passengerCount || 1),
        luggageCount: String(order.luggageCount || 0),
        specialRequests: order.specialRequests || [],
        otherSpecialRequest: order.otherSpecialRequest || '',
        dispatcherNote: order.dispatcherNote || '',
      })
    }
  }, [index, router])

  const updatePickupAddress = (i: number, value: string) => {
    setForm(prev => {
      const arr = [...prev.pickupAddresses]
      arr[i] = value
      return { ...prev, pickupAddresses: arr }
    })
  }

  const addPickupAddress = () => {
    setForm(prev => ({ ...prev, pickupAddresses: [...prev.pickupAddresses, ''] }))
  }

  const removePickupAddress = (i: number) => {
    if (form.pickupAddresses.length <= 1) return
    setForm(prev => ({
      ...prev,
      pickupAddresses: prev.pickupAddresses.filter((_, idx) => idx !== i),
    }))
  }

  const updateDropoffAddress = (i: number, value: string) => {
    setForm(prev => {
      const arr = [...prev.dropoffAddresses]
      arr[i] = value
      return { ...prev, dropoffAddresses: arr }
    })
  }

  const addDropoffAddress = () => {
    setForm(prev => ({ ...prev, dropoffAddresses: [...prev.dropoffAddresses, ''] }))
  }

  const removeDropoffAddress = (i: number) => {
    if (form.dropoffAddresses.length <= 1) return
    setForm(prev => ({
      ...prev,
      dropoffAddresses: prev.dropoffAddresses.filter((_, idx) => idx !== i),
    }))
  }

  const toggleSpecialRequest = (req: string) => {
    setForm(prev => ({
      ...prev,
      specialRequests: prev.specialRequests.includes(req)
        ? prev.specialRequests.filter(r => r !== req)
        : [...prev.specialRequests, req],
    }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.date) errs.date = '請選擇日期'
    if (!form.time) errs.time = '請選擇時間'
    if (!form.pickupAddresses[0]) errs.pickup = '請填寫上車地址'
    if (!form.dropoffAddresses[0]) errs.dropoff = '請填寫下车地址'
    if (!form.price) errs.price = '請填寫金額'
    if (form.vehicleType === 'CUSTOM' && !form.vehicleCustom.trim()) errs.vehicleType = '請填寫車型名稱'
    if (form.contactPhone && !/^[\d\-]{10,}$/.test(form.contactPhone.replace(/\s/g, ''))) {
      errs.contactPhone = '電話格式不正確'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    if (!parseResult) return

    const updatedOrders = [...parseResult.orders]
    updatedOrders[index] = {
      ...updatedOrders[index],
      date: form.date,
      time: form.time,
      vehicleType: form.vehicleType,
      type: form.type,
      pickupAddresses: form.pickupAddresses.filter(a => a.trim()),
      dropoffAddresses: form.dropoffAddresses.filter(a => a.trim()),
      pickup: form.pickupAddresses[0] || '',
      dropoff: form.dropoffAddresses[0] || '',
      price: form.price ? parseInt(form.price, 10) : null,
      flightNumber: form.flightNumber,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      passengerCount: parseInt(form.passengerCount, 10),
      luggageCount: parseInt(form.luggageCount, 10),
      specialRequests: form.specialRequests,
      otherSpecialRequest: form.otherSpecialRequest,
      dispatcherNote: form.dispatcherNote,
      isConfirmed: parseResult.orders[index]?.isConfirmed ?? false,
    }

    const updated: ParseResult = {
      ...parseResult,
      orders: updatedOrders,
    }

    sessionStorage.setItem('parseResult', JSON.stringify(updated))
    router.push('/dispatcher/parse/review')
  }

  const handleCancel = () => {
    router.push('/dispatcher/parse/review')
  }

  const orderId = parseResult?.orders[index]?.orderId || '—'

  // 日期選項（今天起 15 天）
  const dateOptions = Array.from({ length: 15 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const label = i === 0 ? '（今天）' : i === 1 ? '（明天）' : format(d, '（EEE）', { locale: zhTW })
    return {
      value: format(d, 'yyyy-MM-dd'),
      label: `${format(d, 'yyyy/MM/dd')}${label}`,
    }
  })

  // 時分選項
  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minuteOptions = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

  const vehicleOptions = [
    { value: 'SEDAN_5', label: '5 人座轎車' },
    { value: 'SUV_5', label: '5 人座休旅' },
    { value: 'MPV_7', label: '7 人座 MPV' },
    { value: 'VAN_9', label: '9 人座' },
    { value: 'CUSTOM', label: '自訂' },
  ]

  const typeOptions = [
    { value: 'airport_pickup', label: '接機' },
    { value: 'airport_dropoff', label: '送機' },
    { value: 'port_pickup', label: '接船' },
    { value: 'port_dropoff', label: '送船' },
    { value: 'charter', label: '包機' },
    { value: 'transfer', label: '交通趟' },
  ]

  const specialRequestOptions = ['安全座椅', '舉牌', '行李上樓', '其他']

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-white border-b border-[#DDDDDD] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={handleCancel} className="text-[#717171] hover:text-[#222222]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[20px] font-bold text-[#222222]">編輯訂單 {orderId}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* 基本資訊 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">日期</label>
              <select
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              >
                <option value="">選擇日期</option>
                {dateOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.date && <p className="text-[11px] text-[#E24B4A] mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">時間</label>
              <div className="flex gap-1">
                <select
                  value={form.time ? form.time.split(':')[0] : ''}
                  onChange={e => setForm(f => ({ ...f, time: `${e.target.value}:${form.time.split(':')[1] || '00'}` }))}
                  className="flex-1 px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
                >
                  <option value="">時</option>
                  {hourOptions.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="self-center text-[#717171]">:</span>
                <select
                  value={form.time ? form.time.split(':')[1] : ''}
                  onChange={e => setForm(f => ({ ...f, time: `${form.time.split(':')[0] || '00'}:${e.target.value}` }))}
                  className="flex-1 px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
                >
                  <option value="">分</option>
                  {minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {errors.time && <p className="text-[11px] text-[#E24B4A] mt-1">{errors.time}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">車型</label>
              <select
                value={form.vehicleType}
                onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value as VehicleType }))}
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              >
                {vehicleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.vehicleType && <p className="text-[11px] text-[#E24B4A] mt-1">{errors.vehicleType}</p>}
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">種類</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 自訂車型文字框 */}
          {form.vehicleType === 'CUSTOM' && (
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">車型名稱</label>
              <input
                type="text"
                value={form.vehicleCustom}
                onChange={e => setForm(f => ({ ...f, vehicleCustom: e.target.value }))}
                placeholder="例：Toyota Alphard"
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              />
            </div>
          )}
        </div>

        {/* 上車地址 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <div className="text-[14px] font-bold text-[#222222] mb-3">上車地址</div>
          <div className="space-y-2">
            {form.pickupAddresses.map((addr, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[12px] text-[#717171] self-center w-4">{i === 0 ? '①' : '②'}</span>
                <input
                  type="text"
                  value={addr}
                  onChange={e => updatePickupAddress(i, e.target.value)}
                  placeholder="地址或地點"
                  className="flex-1 px-3 py-2 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
                />
                {i > 0 && (
                  <button onClick={() => removePickupAddress(i)} className="text-[#E24B4A] p-2">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addPickupAddress}
            className="mt-2 flex items-center gap-1 text-[13px] text-[#717171] hover:text-[#222222]"
          >
            <Plus className="w-4 h-4" /> 加點
          </button>
          {errors.pickup && <p className="text-[11px] text-[#E24B4A] mt-1">{errors.pickup}</p>}
        </div>

        {/* 下車地址 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <div className="text-[14px] font-bold text-[#222222] mb-3">下车地址</div>
          <div className="space-y-2">
            {form.dropoffAddresses.map((addr, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[12px] text-[#717171] self-center w-4">{i === 0 ? '①' : '②'}</span>
                <input
                  type="text"
                  value={addr}
                  onChange={e => updateDropoffAddress(i, e.target.value)}
                  placeholder="地址或地點"
                  className="flex-1 px-3 py-2 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
                />
                {i > 0 && (
                  <button onClick={() => removeDropoffAddress(i)} className="text-[#E24B4A] p-2">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addDropoffAddress}
            className="mt-2 flex items-center gap-1 text-[13px] text-[#717171] hover:text-[#222222]"
          >
            <Plus className="w-4 h-4" /> 加點
          </button>
          {errors.dropoff && <p className="text-[11px] text-[#E24B4A] mt-1">{errors.dropoff}</p>}
        </div>

        {/* 航班與金額 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">航班（選填）</label>
              <input
                type="text"
                value={form.flightNumber}
                onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value }))}
                placeholder="CI-100"
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">金額</label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="1200"
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              />
              {errors.price && <p className="text-[11px] text-[#E24B4A] mt-1">{errors.price}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">人數</label>
              <select
                value={form.passengerCount}
                onChange={e => setForm(f => ({ ...f, passengerCount: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#717171] mb-1">行李</label>
              <select
                value={form.luggageCount}
                onChange={e => setForm(f => ({ ...f, luggageCount: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 客戶資訊 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <div className="text-[14px] font-bold text-[#222222] mb-3">客戶資訊</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-[#717171] mb-1">聯絡人</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  placeholder="王先生"
                  className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#717171] mb-1">電話（選填）</label>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                  placeholder="0912345678"
                  className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
                />
                {errors.contactPhone && <p className="text-[11px] text-[#E24B4A] mt-1">{errors.contactPhone}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* 特殊需求 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <div className="text-[14px] font-bold text-[#222222] mb-3">特殊需求</div>
          <div className="flex flex-wrap gap-2">
            {specialRequestOptions.map(opt => (
              <button
                key={opt}
                onClick={() => toggleSpecialRequest(opt)}
                className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${
                  form.specialRequests.includes(opt)
                    ? 'bg-[#222222] text-white'
                    : 'bg-[#F7F7F7] text-[#717171] border border-[#DDDDDD]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {form.specialRequests.includes('其他') && (
            <div className="mt-3">
              <input
                type="text"
                value={form.otherSpecialRequest}
                onChange={e => setForm(f => ({ ...f, otherSpecialRequest: e.target.value }))}
                placeholder="請說明特殊需求"
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
              />
            </div>
          )}
        </div>

        {/* 備註 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <div className="text-[14px] font-bold text-[#222222] mb-3">備註</div>
          {/* 原始派單訊息（唯讀） */}
          <div className="mb-3">
            <div className="text-[11px] text-[#717171] mb-1">原始派單訊息（自動帶入，不可編輯）</div>
            <textarea
              value={parseResult?.orders[index]?.rawText || ''}
              disabled
              className="w-full h-20 bg-[#F4EFE9] border border-[#DDDDDD] rounded-lg px-3 py-2 text-[13px] text-[#717171] font-mono resize-none"
            />
          </div>
          <div>
            <div className="text-[11px] text-[#717171] mb-1">派單方備註（給司機看）</div>
            <textarea
              value={form.dispatcherNote}
              onChange={e => setForm(f => ({ ...f, dispatcherNote: e.target.value }))}
              placeholder="額外提醒事項..."
              className="w-full h-20 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222] resize-none"
            />
          </div>
        </div>
      </div>

      {/* 底部操作列 */}
      <div className="bg-white border-t border-[#DDDDDD] sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-4 flex gap-3">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            取消
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <Check className="w-4 h-4 mr-1" />
            儲存
          </Button>
        </div>
      </div>
    </div>
  )
}
