'use client'

import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Pencil, Trash2, User } from 'lucide-react'
import { formatOrderNo } from '@/lib/utils'
import type { OrderStatus } from '@/types'

interface DispatcherOrder {
  id: string
  status: OrderStatus
  type?: string
  vehicle?: string
  plateType?: string
  kenichiRequired?: boolean
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  dropoffLocation: string
  dropoffAddress: string
  passengerCount: number
  luggageCount: number
  scheduledTime: Date | string
  price: number
  note?: string | null
  notes?: string | null
  rawText?: string | null
  driver?: {
    user: { name: string }
    licensePlate: string
    carType: string
    carColor: string
  } | null
  createdAt: string
}

interface DispatcherOrderCardProps {
  order: DispatcherOrder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit: (order: any) => void
  onDelete: (orderId: string) => void
}

// Tag colors per design spec (pill, rounded-full, light bg + dark text)
const TYPE_TAG_STYLE: Record<string, string> = {
  pickup: 'bg-[#E6F1FB] text-[#0C447C]',
  dropoff: 'bg-[#FFF3E0] text-[#92400E]',
  transfer: 'bg-[#F4EFE9] text-[#717171]',
  charter: 'bg-[#F3E8FF] text-[#6B21A8]',
}

const STATUS_TAG_STYLE: Record<string, string> = {
  PENDING: 'bg-[#FCEBEB] text-[#A32D2D]',
  PUBLISHED: 'bg-[#FCEBEB] text-[#A32D2D]',
  ASSIGNED: 'bg-[#FFF3E0] text-[#B45309]',
  ACCEPTED: 'bg-[#FFF3E0] text-[#B45309]',
  ARRIVED: 'bg-[#E6F1FB] text-[#0C447C]',
  IN_PROGRESS: 'bg-[#E6F1FB] text-[#0C447C]',
  COMPLETED: 'bg-[#E8F5E8] text-[#008A05]',
  CANCELLED: 'bg-[#FCEBEB] text-[#A32D2D]',
}

export function DispatcherOrderCard({ order, onEdit, onDelete }: DispatcherOrderCardProps) {
  const orderNo = formatOrderNo(order.scheduledTime, order.id)
  const scheduledDate = typeof order.scheduledTime === 'string'
    ? parseISO(order.scheduledTime)
    : order.scheduledTime
  const hasDriver = !!order.driver
  const driverInfo = hasDriver
    ? `${order.driver!.user.name} / ${order.driver!.licensePlate} / ${order.driver!.carColor} / ${order.driver!.carType}`
    : null

  const isPending = order.status === 'PENDING' || order.status === 'PUBLISHED'
  const typeTagStyle = order.type ? (TYPE_TAG_STYLE[order.type] || 'bg-[#F4EFE9] text-[#717171]') : 'bg-[#F4EFE9] text-[#717171]'
  const statusTagStyle = STATUS_TAG_STYLE[order.status] || 'bg-[#F4EFE9] text-[#717171]'
  const vehicleLabel = order.vehicle === 'small' ? '小車' : order.vehicle === 'suv' ? '休旅' : order.vehicle === 'van9' ? '9人座' : order.vehicle === 'any' ? '任意車' : ''

  return (
    <div
      className={`bg-white border rounded-xl p-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200 group ${
        isPending ? 'border-[2px] border-solid border-[#E24B4A]' : 'border-[#DDDDDD]'
      }`}
    >
      {/* Row 1: Status tag + order no */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border ${statusTagStyle} border-[inherit]`}>
          {order.status === 'PENDING' || order.status === 'PUBLISHED' ? '待接單' :
           order.status === 'ASSIGNED' ? '已指派' :
           order.status === 'ACCEPTED' ? '已接單' :
           order.status === 'ARRIVED' ? '已抵達' :
           order.status === 'IN_PROGRESS' ? '進行中' :
           order.status === 'COMPLETED' ? '已完成' :
           order.status === 'CANCELLED' ? '已取消' : order.status}
        </span>
        <span className="text-xs text-[#717171] font-mono-nums">{orderNo}</span>
      </div>

      {/* Row 2: Type tag + vehicle tag + kenichi tag */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal ${typeTagStyle}`}>
          {order.type === 'pickup' ? '接機' : order.type === 'dropoff' ? '送機' : order.type === 'transfer' ? '交通接駁' : order.type === 'charter' ? '套裝' : '待確認'}
        </span>
        {vehicleLabel && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-[#F4EFE9] text-[#717171]">
            {vehicleLabel}
          </span>
        )}
        {order.kenichiRequired && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-[#F3E8FF] text-[#6B21A8]">
            肯驛
          </span>
        )}
      </div>

      {/* Row 3: Route — most prominent, 15px 500 */}
      <div className="mb-2">
        <p className="text-[15px] font-medium text-[#222222] leading-snug">
          {order.pickupLocation} &rarr; {order.dropoffLocation}
        </p>
      </div>

      {/* Row 4: Date/time 13px gray */}
      <div className="mb-3">
        <p className="text-[13px] text-[#717171]">
          {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}&nbsp;
          {format(scheduledDate, 'HH:mm')}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-[#DDDDDD] opacity-50 mb-3" />

      {/* Row 5: Price (18px 500) + driver (12px gray) */}
      <div className="flex items-center justify-between">
        <span className="text-[18px] font-medium text-[#222222] font-mono-nums">
          NT${order.price.toLocaleString()}
        </span>
        {hasDriver ? (
          <span className="text-[12px] text-[#717171] truncate max-w-[200px] font-mono-nums">{driverInfo}</span>
        ) : (
          <span className="text-[12px] text-[#E24B4A]">等待司機接單</span>
        )}
      </div>

      {/* Edit / Delete — hover reveal */}
      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={() => onEdit(order)}
          className="p-1.5 rounded-lg text-[#717171] hover:text-[#222222] hover:bg-[#F7F7F7] transition-colors"
          title="編輯"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(order.id)}
          className="p-1.5 rounded-lg text-[#717171] hover:text-[#E24B4A] hover:bg-[#FCEBEB] transition-colors"
          title="刪除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
