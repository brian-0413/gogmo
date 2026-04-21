'use client'

import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { VEHICLE_LABELS, isVehicleCompatible } from '@/lib/vehicle'
import { TYPE_LABELS, PLATFORM_FEE_RATE } from '@/lib/constants'
import type { VehicleType, RequirementLevel } from '@/lib/vehicle'

export interface PendingApprovalCardProps {
  order: {
    id: string
    orderSeq: number
    type: string
    scheduledTime: string | Date
    pickupLocation: string
    dropoffLocation: string
    price: number
    vehicleType?: string | null
    vehicleRequirement?: RequirementLevel | null
    passengerName: string
    passengerCount: number
    luggageCount: number
    driver: {
      licensePlate: string
      vehicleType: string
      carColor: string
      user: {
        name: string
        documents: Array<{
          type: string
          status: string
        }>
      }
    } | null
  }
  onApprove: (orderId: string) => void
  onReject: (orderId: string, reason?: string) => void
  loading?: boolean
}

type DriverDoc = { type: string; status: string }

function getDocStatus(docs: DriverDoc[], type: string) {
  const doc = docs.find((d) => d.type === type)
  return doc && doc.status !== 'REJECTED' ? 'approved' : 'missing'
}

export function PendingApprovalCard({ order, onApprove, onReject, loading }: PendingApprovalCardProps) {
  const platformFee = Math.round(order.price * PLATFORM_FEE_RATE)

  // 司機姓名：只顯示名 + 師傅
  const driverName = order.driver
    ? order.driver.user.name.slice(0, 1) + '師傅'
    : '-'

  // 車型比對
  const vehicleOk = order.driver && order.vehicleType
    ? isVehicleCompatible(
        order.driver.vehicleType as VehicleType,
        order.vehicleType as VehicleType,
        order.vehicleRequirement || 'MIN'
      )
    : false

  // 三證狀態
  const docs = order.driver?.user.documents ?? []
  const docLicense = getDocStatus(docs, 'DRIVER_LICENSE')
  const docVehicle = getDocStatus(docs, 'VEHICLE_REGISTRATION')
  const docInsurance = getDocStatus(docs, 'INSURANCE')
  const allDocsApproved = docLicense === 'approved' && docVehicle === 'approved' && docInsurance === 'approved'

  // 時間格式化
  const timeDisplay = order.scheduledTime instanceof Date
    ? order.scheduledTime.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : order.scheduledTime

  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow">
      {/* 上半部：訂單基本資訊 */}
      <div className="p-5">
        {/* 第一行：單號 + 種類 + 上下車地點 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[20px] font-bold font-mono-nums text-[#222222]">
            #{String(order.orderSeq).padStart(4, '0')}
          </span>
          <span className={`inline-flex items-center px-3 py-1.5 text-[15px] font-bold rounded ${
            order.type === 'pickup' ? 'bg-[#E6F1FB] text-[#0C447C]'
            : order.type === 'dropoff' ? 'bg-[#FFF3E0] text-[#92400E]'
            : order.type === 'transfer' ? 'bg-[#F4EFE9] text-[#717171]'
            : order.type === 'charter' ? 'bg-[#F3E8FF] text-[#6B21A8]'
            : 'bg-[#F4EFE9] text-[#717171]'
          }`}>
            {TYPE_LABELS[order.type as keyof typeof TYPE_LABELS] || '待確認'}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] sm:text-[16px] font-bold text-[#222222] truncate max-w-[100px] sm:max-w-none">
              {order.pickupLocation}
            </span>
            <ArrowRight className="w-4 h-4 text-[#717171] flex-shrink-0" />
            <span className="text-[14px] sm:text-[16px] font-bold text-[#222222] truncate max-w-[100px] sm:max-w-none">
              {order.dropoffLocation}
            </span>
          </div>
        </div>

        {/* 第二行：時間 + 乘客 */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <span className="text-[15px] font-bold font-mono-nums text-[#717171]">
            {timeDisplay}
          </span>
          <span className="text-[14px] text-[#717171]">
            {order.passengerName} · {order.passengerCount}人 · {order.luggageCount}件行李
          </span>
        </div>

        {/* 第三行：價格 + 平台費 */}
        <div className="flex items-center gap-3">
          <span className="text-[22px] font-bold font-mono-nums text-[#FF385C]">
            NT${order.price.toLocaleString()}
          </span>
          <span className="text-[13px] text-[#717171]">
            平台費 -{platformFee} 點
          </span>
        </div>
      </div>

      {/* 下半部：司機資料（灰色背景） */}
      <div className="bg-[#F9F9F9] border-t border-[#EBEBEB] px-5 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 司機姓名 */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[#717171]">司機</span>
            <span className="text-[15px] font-bold text-[#222222]">{driverName}</span>
          </div>

          {/* 車號 */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[#717171]">車號</span>
            <span className="text-[15px] font-bold font-mono-nums text-[#222222]">
              {order.driver ? `${order.driver.carColor} ${order.driver.licensePlate}` : '-'}
            </span>
          </div>

          {/* 車型 */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[#717171]">車型</span>
            <span className="text-[15px] font-bold text-[#222222]">
              {order.driver ? VEHICLE_LABELS[order.driver.vehicleType as VehicleType] || order.driver.vehicleType : '-'}
            </span>
          </div>

          {/* 車型是否符合 */}
          <div className="flex items-center gap-1.5 min-w-0">
            {vehicleOk ? (
              <CheckCircle2 className="w-4 h-4 text-[#008A05]" />
            ) : (
              <XCircle className="w-4 h-4 text-[#EF4444]" />
            )}
            <span className="text-[13px] font-medium text-[#717171]">車型</span>
          </div>

          {/* 三證是否齊全 */}
          <div className="flex items-center gap-1.5 min-w-0">
            {allDocsApproved ? (
              <CheckCircle2 className="w-4 h-4 text-[#008A05]" />
            ) : (
              <XCircle className="w-4 h-4 text-[#EF4444]" />
            )}
            <span className="text-[13px] font-medium text-[#717171]">三證</span>
          </div>
        </div>
      </div>

      {/* 底部按鈕 */}
      <div className="flex gap-3 px-5 py-4 border-t border-[#EBEBEB]">
        <Button
          onClick={() => onApprove(order.id)}
          disabled={loading}
          className="bg-[#008A05] hover:bg-[#006B04] text-white text-[15px] font-bold px-6 py-2.5 rounded-lg"
        >
          同意
        </Button>
        <Button
          variant="outline"
          onClick={() => onReject(order.id)}
          disabled={loading}
          className="border border-[#DDDDDD] text-[#EF4444] hover:bg-[#FCEBEB] text-[15px] font-bold px-6 py-2.5 rounded-lg"
        >
          拒絕
        </Button>
      </div>
    </div>
  )
}