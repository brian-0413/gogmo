'use client'

import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { User, Package, FileText, Clock, Plane } from 'lucide-react'
import { useState, useEffect } from 'react'
import { formatOrderNo } from '@/lib/utils'
import type { OrderType, VehicleType, Order } from '@/types'

export type { Order } from '@/types'

// Airbnb warm cream color system
const TYPE_COLORS: Record<OrderType, { bg: string; text: string }> = {
  pickup: { bg: '#E6F1FB', text: '#0C447C' },
  dropoff: { bg: '#FFF3E0', text: '#92400E' },
  pickup_boat: { bg: '#E0F7FA', text: '#006064' },
  dropoff_boat: { bg: '#E0F7FA', text: '#006064' },
  transfer: { bg: '#F4EFE9', text: '#717171' },
  charter: { bg: '#F3E8FF', text: '#6B21A8' },
  pending: { bg: '#F4EFE9', text: '#717171' },
}


interface OrderCardProps {
  order: Order
  onAccept?: (orderId: string) => void
  onView?: (orderId: string) => void
  showActions?: boolean
  compact?: boolean
  isNew?: boolean
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  small: '小車',
  suv: '休旅',
  van9: '9人座',
  any: '任意車',
  any_r: '任意R',
  pending: '待確認',
}

const TYPE_LABELS: Record<OrderType, string> = {
  pickup: '接機',
  dropoff: '送機',
  pickup_boat: '接船',
  dropoff_boat: '送船',
  transfer: '接駁',
  charter: '包車',
  pending: '待確認',
}

function getTimeUrgency(scheduledTime: string | Date): "urgent" | "soon" | "normal" {
  const now = new Date()
  const time = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : new Date(scheduledTime)
  const diff = differenceInMinutes(time, now)
  if (diff <= 30) return "urgent"
  if (diff <= 60) return "soon"
  return "normal"
}

function OrderCard({ order, onAccept, onView, showActions = true, compact = false, isNew = false }: OrderCardProps) {
  const scheduledDate = typeof order.scheduledTime === 'string' ? parseISO(order.scheduledTime) : order.scheduledTime
  const orderType: OrderType = order.type || 'pending'
  const vehicle: VehicleType = order.vehicle || 'any'
  const urgency = getTimeUrgency(order.scheduledTime)
  const [countdown, setCountdown] = useState<string>('')
  const notes = order.notes || order.note || order.rawText
  const orderNo = formatOrderNo(scheduledDate, order.orderSeq)
  const typeBadgeColor = TYPE_COLORS[orderType]

  const isPickup = orderType === 'pickup'
  const isBoat = orderType === 'pickup_boat' || orderType === 'dropoff_boat'
  const pickupLabel = isBoat ? '出發港' : isPickup ? '桃園機場' : '上車'
  const dropoffLabel = isBoat ? '目的地港' : isPickup ? '目的地' : '桃園機場'

  useEffect(() => {
    if (urgency === "urgent" || urgency === "soon") {
      const updateCountdown = () => {
        const now = new Date()
        const time = typeof order.scheduledTime === 'string' ? parseISO(order.scheduledTime) : new Date(order.scheduledTime)
        const seconds = differenceInMinutes(time, now) * 60 - now.getSeconds()
        if (seconds > 0) {
          const mins = Math.floor(seconds / 60)
          const secs = seconds % 60
          setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
        }
      }
      updateCountdown()
      const interval = setInterval(updateCountdown, 1000)
      return () => clearInterval(interval)
    }
  }, [order.scheduledTime, urgency])

  if (compact) {
    return (
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-3 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-all duration-200">
        {/* 顯眼單號標籤 */}
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center px-2 py-1 bg-[#FF385C] text-white text-[13px] font-bold font-mono-nums rounded tracking-wider select-all">
            #{orderNo}
          </span>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#222222]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-sm font-bold font-mono-nums text-[#222222]">
            {format(scheduledDate, 'HH:mm')}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold font-mono-nums text-[#FF385C]">
            NT${order.price}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}>
            {TYPE_LABELS[orderType]}
          </span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-[#717171] mb-2">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: typeBadgeColor.bg === '#F4EFE9' ? '#DDDDDD' : typeBadgeColor.bg }} />
          <span className="truncate">{order.pickupLocation}</span>
          <span className="text-[#B0B0B0] flex-shrink-0">→</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#DDDDDD] mt-1.5 flex-shrink-0" />
          <span className="truncate">{order.dropoffLocation}</span>
        </div>
        {notes && (
          <div className="text-xs text-[#717171] italic bg-[#F4EFE9] p-1.5 rounded truncate">
            {notes}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white border border-[#DDDDDD] rounded-xl overflow-hidden transition-all duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${isNew ? 'animate-cardEntry' : ''}`}>
      {/* Top accent stripe for new orders */}
      {isNew && (
        <div className="h-0.5 bg-gradient-to-r from-[#FF385C] via-[#FF385C]/50 to-[#FF385C]" />
      )}

      <div className="p-4">
        {/* 單號 + 類型 + 車型 + urgency/status */}
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          {/* 左側：單號 + 類型 + 車型 */}
          <div className="flex items-center gap-1.5 flex-wrap gap-x-1.5 gap-y-1">
            <span className="inline-flex items-center px-3 py-1.5 bg-[#FF385C] text-white text-[15px] font-bold font-mono-nums rounded tracking-wider select-all">
              #{orderNo}
            </span>
            <span
              className="inline-flex items-center px-2.5 py-1 text-[13px] font-bold rounded"
              style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}
            >
              {TYPE_LABELS[orderType]}
            </span>
            <span
              className="inline-flex items-center px-2.5 py-1 text-[13px] font-bold rounded"
              style={{ backgroundColor: '#F4EFE9', color: '#717171' }}
            >
              {VEHICLE_LABELS[vehicle]}
              {order.plateType && order.plateType !== 'any' ? ` (${order.plateType}牌)` : ''}
            </span>
            {order.kenichiRequired && (
              <span className="inline-flex items-center px-2.5 py-1 text-[13px] font-bold rounded bg-[#F3E8FF] text-[#6B21A8]">
                肯驛
              </span>
            )}
          </div>
          {/* 右側：倒數 + 狀態 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {urgency !== "normal" && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 font-mono-nums" style={{
                backgroundColor: urgency === "urgent" ? '#FCEBEB' : '#FFF3E0',
                color: urgency === "urgent" ? '#A32D2D' : '#B45309'
              }}>
                <Clock className="w-3 h-3" />
                {countdown || '00:00'}
              </span>
            )}
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {/* Price */}
        <div className="mb-2">
          <span className="text-2xl font-bold font-mono-nums text-[#FF385C]">
            NT${order.price.toLocaleString()}
          </span>
        </div>

        {/* Date + time + flight */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#222222]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-sm font-bold font-mono-nums text-[#222222]">
            {format(scheduledDate, 'HH:mm')}
          </span>
          {order.flightNumber && (
            <span className="bg-[#F4EFE9] px-2 py-0.5 rounded font-mono-nums text-xs text-[#717171] border border-[#DDDDDD]">
              {order.flightNumber}
            </span>
          )}
        </div>

        {/* Pickup / Dropoff */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: typeBadgeColor.bg === '#F4EFE9' ? '#FF385C' : typeBadgeColor.bg === '#E6F1FB' ? '#0C447C' : typeBadgeColor.bg === '#FFF3E0' ? '#92400E' : typeBadgeColor.bg === '#F3E8FF' ? '#6B21A8' : '#717171' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#717171] uppercase tracking-wider mb-0.5">{pickupLabel}</p>
              <p className="text-sm font-medium text-[#222222] truncate">{order.pickupLocation}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-[#DDDDDD] mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#717171] uppercase tracking-wider mb-0.5">{dropoffLabel}</p>
              <p className="text-sm font-medium text-[#222222] truncate">{order.dropoffLocation}</p>
            </div>
          </div>
        </div>

        {/* Passenger info */}
        <div className="flex items-center gap-3 text-xs text-[#717171] mb-3 pt-2 border-t border-[#EBEBEB]">
          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.passengerName}</span>
          <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {order.passengerCount}人 / {order.luggageCount}行李</span>
        </div>

        {/* Notes */}
        {notes && (
          <div className="text-xs text-[#717171] bg-[#FFF3E0] border border-[#FFE0B2] p-2.5 rounded-lg mb-3 flex items-start gap-1.5">
            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#B45309]" />
            <span className="leading-relaxed">{notes}</span>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t border-[#EBEBEB]">
            {onView && (
              <Button variant="outline" size="sm" onClick={() => onView(order.id)}
                className="flex-1 border-[#DDDDDD] text-[#717171] hover:border-[#222222] hover:text-[#222222] hover:bg-[#F4EFE9]">
                查看詳情
              </Button>
            )}
            {onAccept && order.status === 'PUBLISHED' && (
              <Button variant="primary" size="sm" onClick={() => onAccept(order.id)}
                className="flex-1">
                立即接單
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export { OrderCard }
