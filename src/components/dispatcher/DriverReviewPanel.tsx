'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { VEHICLE_LABELS } from '@/lib/vehicle'
import type { Order } from '@/types'

export interface DriverReviewPanelProps {
  order: Order
  driver: {
    name: string
    phone: string
    licensePlate: string
    vehicleType: string
    carColor: string
  }
  onApprove: (detailedInfo: DetailedOrderInfo) => Promise<void>
  onReject: () => Promise<void>
  loading: boolean
}

export interface DetailedOrderInfo {
  contactName: string
  contactPhone: string
  flightNumber: string
  pickupAddress: string
  dropoffAddress: string
  passengerCount: number
  luggageCount: number
  specialRequests: string[]
  note: string
}

const SPECIAL_REQUEST_OPTIONS = [
  '安全座椅',
  '舉牌服務',
  '需要輪椅',
  '大型行李',
  '寵物同行',
  '行程變更',
]

const PASSENGER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const LUGGAGE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

interface FormErrors {
  contactName?: string
  contactPhone?: string
  flightNumber?: string
  pickupAddress?: string
  dropoffAddress?: string
  passengerCount?: string
  luggageCount?: string
}

export function DriverReviewPanel({ order, driver, onApprove, onReject, loading }: DriverReviewPanelProps) {
  const isPickup = order.type === 'pickup' || order.type === 'pickup_boat'
  const isDropoff = order.type === 'dropoff' || order.type === 'dropoff_boat'

  // 初始化表單資料
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [flightNumber, setFlightNumber] = useState(order.flightNumber || '')
  const [pickupAddress, setPickupAddress] = useState(order.pickupAddress || order.pickupLocation || '')
  const [dropoffAddress, setDropoffAddress] = useState(order.dropoffAddress || order.dropoffLocation || '')
  const [passengerCount, setPassengerCount] = useState(order.passengerCount || 1)
  const [luggageCount, setLuggageCount] = useState(order.luggageCount || 0)
  const [specialRequests, setSpecialRequests] = useState<string[]>([])
  const [note, setNote] = useState(order.note || order.notes || '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [showErrors, setShowErrors] = useState(false)

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!contactName.trim()) {
      newErrors.contactName = '必填'
    }
    if (!contactPhone.trim()) {
      newErrors.contactPhone = '必填'
    }
    if (isPickup && !flightNumber.trim()) {
      newErrors.flightNumber = '接機必填'
    }
    if (isDropoff && !pickupAddress.trim()) {
      newErrors.pickupAddress = '送機必填'
    }
    if (isPickup && !dropoffAddress.trim()) {
      newErrors.dropoffAddress = '接機必填'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleApprove = async () => {
    setShowErrors(true)
    if (!validate()) return

    await onApprove({
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      flightNumber: flightNumber.trim(),
      pickupAddress: pickupAddress.trim(),
      dropoffAddress: dropoffAddress.trim(),
      passengerCount,
      luggageCount,
      specialRequests,
      note: note.trim(),
    })
  }

  const toggleSpecialRequest = (req: string) => {
    setSpecialRequests(prev =>
      prev.includes(req) ? prev.filter(r => r !== req) : [...prev, req]
    )
  }

  const vehicleTypeLabel = VEHICLE_LABELS[driver.vehicleType as keyof typeof VEHICLE_LABELS] || driver.vehicleType

  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
      {/* 司機資訊抬頭 */}
      <div className="bg-[#F9F9F9] border-b border-[#EBEBEB] px-5 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[#717171]">司機</span>
            <span className="text-[15px] font-bold text-[#222222]">{driver.name}</span>
          </div>
          <div className="h-4 w-px bg-[#DDDDDD]" />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[#717171]">電話</span>
            <span className="text-[15px] font-bold text-[#222222] font-mono-nums">{driver.phone}</span>
          </div>
          <div className="h-4 w-px bg-[#DDDDDD]" />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[#717171]">車牌</span>
            <span className="text-[15px] font-bold font-mono-nums text-[#222222]">
              {driver.carColor} {driver.licensePlate}
            </span>
          </div>
          <div className="h-4 w-px bg-[#DDDDDD]" />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[#717171]">車型</span>
            <span className="text-[15px] font-bold text-[#222222]">{vehicleTypeLabel}</span>
          </div>
        </div>
      </div>

      {/* 詳細資訊表單 */}
      <div className="p-5 space-y-4">
        {/* 第一列：聯絡人 + 電話 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[12px] text-[#717171] font-medium">
              聯絡人 <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="請輸入聯絡人姓名"
              className={`w-full bg-white border rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222] ${
                showErrors && errors.contactName ? 'border-[#EF4444]' : 'border-[#DDDDDD]'
              }`}
            />
            {showErrors && errors.contactName && (
              <span className="text-[11px] text-[#EF4444]">{errors.contactName}</span>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-[#717171] font-medium">
              電話 <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="請輸入聯絡電話"
              className={`w-full bg-white border rounded-lg px-3 py-2 text-[14px] text-[#222222] font-mono-nums focus:outline-none focus:border-[#222222] ${
                showErrors && errors.contactPhone ? 'border-[#EF4444]' : 'border-[#DDDDDD]'
              }`}
            />
            {showErrors && errors.contactPhone && (
              <span className="text-[11px] text-[#EF4444]">{errors.contactPhone}</span>
            )}
          </div>
        </div>

        {/* 航班號碼（接機必填） */}
        <div className="space-y-1">
          <label className="text-[12px] text-[#717171] font-medium">
            航班 {isPickup && <span className="text-[#EF4444]">*</span>}
          </label>
          <input
            type="text"
            value={flightNumber}
            onChange={e => setFlightNumber(e.target.value)}
            placeholder="例如：BR123"
            className={`w-full bg-white border rounded-lg px-3 py-2 text-[14px] text-[#222222] font-mono-nums focus:outline-none focus:border-[#222222] ${
              showErrors && errors.flightNumber ? 'border-[#EF4444]' : 'border-[#DDDDDD]'
            }`}
          />
          {showErrors && errors.flightNumber && (
            <span className="text-[11px] text-[#EF4444]">{errors.flightNumber}</span>
          )}
        </div>

        {/* 上車 / 下車地址 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[12px] text-[#717171] font-medium">
              上車地址 {isDropoff && <span className="text-[#EF4444]">*</span>}
            </label>
            <input
              type="text"
              value={pickupAddress}
              onChange={e => setPickupAddress(e.target.value)}
              placeholder={isDropoff ? '請輸入上車地址' : '請輸入地址'}
              className={`w-full bg-white border rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222] ${
                showErrors && errors.pickupAddress ? 'border-[#EF4444]' : 'border-[#DDDDDD]'
              }`}
            />
            {showErrors && errors.pickupAddress && (
              <span className="text-[11px] text-[#EF4444]">{errors.pickupAddress}</span>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-[#717171] font-medium">
              下車地址 {isPickup && <span className="text-[#EF4444]">*</span>}
            </label>
            <input
              type="text"
              value={dropoffAddress}
              onChange={e => setDropoffAddress(e.target.value)}
              placeholder={isPickup ? '請輸入目的地' : '請輸入地址'}
              className={`w-full bg-white border rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222] ${
                showErrors && errors.dropoffAddress ? 'border-[#EF4444]' : 'border-[#DDDDDD]'
              }`}
            />
            {showErrors && errors.dropoffAddress && (
              <span className="text-[11px] text-[#EF4444]">{errors.dropoffAddress}</span>
            )}
          </div>
        </div>

        {/* 人數 + 行李 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[12px] text-[#717171] font-medium">
              人數 <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={passengerCount}
              onChange={e => setPassengerCount(Number(e.target.value))}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
            >
              {PASSENGER_OPTIONS.map(n => (
                <option key={n} value={n}>{n} 人</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-[#717171] font-medium">
              行李 <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={luggageCount}
              onChange={e => setLuggageCount(Number(e.target.value))}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
            >
              {LUGGAGE_OPTIONS.map(n => (
                <option key={n} value={n}>{n} 件</option>
              ))}
            </select>
          </div>
        </div>

        {/* 特殊需求 */}
        <div className="space-y-1">
          <label className="text-[12px] text-[#717171] font-medium">特殊需求</label>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_REQUEST_OPTIONS.map(req => (
              <button
                key={req}
                type="button"
                onClick={() => toggleSpecialRequest(req)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  specialRequests.includes(req)
                    ? 'bg-[#0C447C] text-white'
                    : 'bg-[#F4EFE9] text-[#717171] hover:bg-[#E8E0D5]'
                }`}
              >
                {req}
              </button>
            ))}
          </div>
        </div>

        {/* 備註 */}
        <div className="space-y-1">
          <label className="text-[12px] text-[#717171] font-medium">備註</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="其他備註事項"
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
          />
        </div>
      </div>

      {/* 按鈕區 */}
      <div className="flex gap-3 px-5 py-4 border-t border-[#EBEBEB] bg-[#FAFAFA]">
        <Button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[15px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {loading ? '處理中...' : '批准'}
        </Button>
        <Button
          variant="outline"
          onClick={onReject}
          disabled={loading}
          className="flex-1 border border-[#DDDDDD] text-[#EF4444] hover:bg-[#FCEBEB] text-[15px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
          拒絕
        </Button>
      </div>
    </div>
  )
}