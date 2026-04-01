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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PENDING: { label: '待接單', bg: 'bg-[#ff6b2b]/10', text: 'text-[#ff6b2b]', border: 'border-[#ff6b2b]/20' },
  PUBLISHED: { label: '待接單', bg: 'bg-[#ff6b2b]/10', text: 'text-[#ff6b2b]', border: 'border-[#ff6b2b]/20' },
  ASSIGNED: { label: '已指派', bg: 'bg-[#3b82f6]/10', text: 'text-[#3b82f6]', border: 'border-[#3b82f6]/20' },
  ACCEPTED: { label: '已接單', bg: 'bg-[#3b82f6]/10', text: 'text-[#3b82f6]', border: 'border-[#3b82f6]/20' },
  ARRIVED: { label: '已抵達', bg: 'bg-[#a855f7]/10', text: 'text-[#a855f7]', border: 'border-[#a855f7]/20' },
  IN_PROGRESS: { label: '進行中', bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]', border: 'border-[#22c55e]/20' },
  COMPLETED: { label: '已完成', bg: 'bg-[#141418]', text: 'text-[#6b6560]', border: 'border-[#1e1e26]' },
  CANCELLED: { label: '已取消', bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]', border: 'border-[#ef4444]/20' },
}

export function DispatcherOrderCard({ order, onEdit, onDelete }: DispatcherOrderCardProps) {
  const orderNo = formatOrderNo(order.scheduledTime, order.id)
  const scheduledDate = typeof order.scheduledTime === 'string'
    ? parseISO(order.scheduledTime)
    : order.scheduledTime
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING
  const hasDriver = !!order.driver
  const driverInfo = hasDriver
    ? `${order.driver!.user.name} / ${order.driver!.licensePlate} / ${order.driver!.carColor} / ${order.driver!.carType}`
    : null

  return (
    <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-4 hover:border-[#ff6b2b]/20 transition-all duration-200 group relative overflow-hidden">
      {/* Top accent line - visible only for active orders */}
      {(order.status === 'PENDING' || order.status === 'PUBLISHED') && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ff6b2b]/50 to-transparent" />
      )}

      {/* First row: order no + edit/delete */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono-nums text-[#4a4a52]">{orderNo}</span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(order)}
            className="p-1.5 rounded-lg text-[#6b6560] hover:text-[#f0ebe3] hover:bg-[#141418] transition-colors"
            title="編輯"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(order.id)}
            className="p-1.5 rounded-lg text-[#6b6560] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
            title="刪除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Second row: date/time + status badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#f0ebe3]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-base font-bold font-mono-nums text-[#f0ebe3]">
            {format(scheduledDate, 'HH:mm')}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Third row: pickup/dropoff */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
            <span className="text-[#6b6560] truncate">{order.pickupLocation}</span>
          </div>
          <span className="text-[#3a3a40] flex-shrink-0 mx-1">→</span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#ef4444] flex-shrink-0" />
            <span className="text-[#6b6560] truncate">{order.dropoffLocation}</span>
          </div>
        </div>
      </div>

      {/* Fourth row: driver info */}
      <div className={`mb-3 p-2.5 rounded-lg ${hasDriver ? 'bg-[#141418] border border-[#1e1e26]' : 'bg-[#ff6b2b]/5 border border-[#ff6b2b]/10'}`}>
        <div className="flex items-center gap-2">
          <User className={`w-3.5 h-3.5 flex-shrink-0 ${hasDriver ? 'text-[#6b6560]' : 'text-[#ff6b2b]'}`} />
          {hasDriver ? (
            <span className="text-xs text-[#6b6560] truncate font-mono-nums">{driverInfo}</span>
          ) : (
            <span className="text-xs text-[#ff6b2b]">等待司機接單</span>
          )}
        </div>
      </div>

      {/* Fifth row: price + badges */}
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold font-mono-nums" style={{ color: '#ff6b2b' }}>
          NT${order.price.toLocaleString()}
        </span>
        <div className="flex gap-1.5">
          {order.kenichiRequired && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">
              肯驛
            </span>
          )}
          {order.vehicle && order.vehicle !== 'pending' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#141418] text-[#6b6560] border border-[#1e1e26]">
              {order.vehicle === 'small' ? '小車' : order.vehicle === 'suv' ? '休旅' : order.vehicle === 'van9' ? '9人座' : order.vehicle}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
