'use client'

import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { User, Package, FileText, Zap, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { formatOrderNo } from '@/lib/utils'
import type { OrderType, VehicleType, Order } from '@/types'

export type { Order } from '@/types'

const TYPE_COLORS: Record<OrderType, { bg: string; text: string }> = {
  pickup: { bg: '#22c55e', text: '#060608' },
  dropoff: { bg: '#3b82f6', text: '#ffffff' },
  transfer: { bg: '#a855f7', text: '#ffffff' },
  charter: { bg: '#f59e0b', text: '#060608' },
  pending: { bg: '#3a3a40', text: '#6b6560' },
}

const VEHICLE_COLORS: Record<VehicleType, { bg: string; text: string }> = {
  van9: { bg: '#ef4444', text: '#ffffff' },
  suv: { bg: '#f59e0b', text: '#060608' },
  small: { bg: '#4a4a52', text: '#f0ebe3' },
  any_r: { bg: '#3b82f6', text: '#ffffff' },
  any: { bg: '#3a3a40', text: '#6b6560' },
  pending: { bg: '#3a3a40', text: '#6b6560' },
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
  const orderNo = formatOrderNo(scheduledDate, order.id)
  const typeBadgeColor = TYPE_COLORS[orderType]
  const vehicleBadgeColor = VEHICLE_COLORS[vehicle]

  const isPickup = orderType === 'pickup'
  const pickupLabel = isPickup ? '桃園機場' : '上車'
  const dropoffLabel = isPickup ? '目的地' : '桃園機場'

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
      <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-3 hover:border-[#3b82f6]/20 transition-all duration-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono-nums text-[#4a4a52]">{orderNo}</span>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#f0ebe3]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-sm font-bold font-mono-nums text-[#f0ebe3]">
            {format(scheduledDate, 'HH:mm')}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold font-mono-nums" style={{ color: '#ff6b2b' }}>
            NT${order.price}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}>
            {TYPE_LABELS[orderType]}
          </span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-[#6b6560] mb-2">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: typeBadgeColor.bg }} />
          <span className="truncate">{order.pickupLocation}</span>
          <span className="text-[#3a3a40] flex-shrink-0">→</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#4a4a52] mt-1.5 flex-shrink-0" />
          <span className="truncate">{order.dropoffLocation}</span>
        </div>
        {notes && (
          <div className="text-xs text-[#6b6560] italic bg-[#141418] p-1.5 rounded truncate">
            {notes}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-[#0c0c10] border border-[#1e1e26] rounded-xl overflow-hidden transition-all duration-200 hover:border-[#ff6b2b]/20 ${isNew ? 'animate-cardEntry' : ''}`}>
      {/* Top accent for new orders */}
      {isNew && (
        <div className="h-0.5 bg-gradient-to-r from-[#3b82f6] via-[#ff6b2b] to-[#3b82f6]" />
      )}

      <div className="p-4">
        {/* Order no + status */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono-nums text-[#4a4a52]">{orderNo}</span>
          <div className="flex items-center gap-1.5">
            {urgency !== "normal" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 font-mono-nums" style={{
                backgroundColor: urgency === "urgent" ? '#ef4444' : '#ff6b2b',
                color: urgency === "urgent" ? '#ffffff' : '#060608'
              }}>
                {urgency === "urgent" ? <Zap className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                {countdown || '00:00'}
              </span>
            )}
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {/* Price + type */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl font-bold font-mono-nums" style={{ color: '#ff6b2b' }}>
            NT${order.price.toLocaleString()}
          </span>
          <span
            className="text-[10px] font-bold px-2 py-1 rounded"
            style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}
          >
            {TYPE_LABELS[orderType]}
          </span>
        </div>

        {/* Date + time + flight */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#f0ebe3]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-sm font-bold font-mono-nums text-[#f0ebe3]">
            {format(scheduledDate, 'HH:mm')}
          </span>
          {order.flightNumber && (
            <span className="bg-[#141418] px-2 py-0.5 rounded font-mono-nums text-xs text-[#6b6560] border border-[#1e1e26]">
              {order.flightNumber}
            </span>
          )}
        </div>

        {/* Pickup / Dropoff */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: typeBadgeColor.bg }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#6b6560] uppercase tracking-wider mb-0.5">{pickupLabel}</p>
              <p className="text-sm font-medium text-[#f0ebe3] truncate">{order.pickupLocation}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4a4a52] mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#6b6560] uppercase tracking-wider mb-0.5">{dropoffLabel}</p>
              <p className="text-sm font-medium text-[#f0ebe3] truncate">{order.dropoffLocation}</p>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-3">
          {order.kenichiRequired && (
            <span className="px-2 py-1 rounded text-[10px] font-bold bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">
              肯驛
            </span>
          )}
          <span
            className="text-[10px] font-bold px-2 py-1 rounded"
            style={{ backgroundColor: vehicleBadgeColor.bg, color: vehicleBadgeColor.text }}
          >
            {VEHICLE_LABELS[vehicle]}
            {order.plateType && order.plateType !== 'any' ? ` (${order.plateType}牌)` : ''}
          </span>
        </div>

        {/* Passenger info */}
        <div className="flex items-center gap-3 text-xs text-[#6b6560] mb-3 pt-2 border-t border-[#1e1e26]">
          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.passengerName}</span>
          <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {order.passengerCount}人 / {order.luggageCount}行李</span>
        </div>

        {/* Notes */}
        {notes && (
          <div className="text-xs text-[#6b6560] bg-[#ff6b2b]/5 border border-[#ff6b2b]/15 p-2.5 rounded-lg mb-3 flex items-start gap-1.5">
            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#ff6b2b]" />
            <span className="leading-relaxed">{notes}</span>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t border-[#1e1e26]">
            {onView && (
              <Button variant="outline" size="sm" onClick={() => onView(order.id)}
                className="flex-1 border-[#1e1e26] text-[#6b6560] hover:border-[#3b82f6]/30 hover:text-[#3b82f6] hover:bg-[#3b82f6]/5">
                查看詳情
              </Button>
            )}
            {onAccept && order.status === 'PENDING' && (
              <Button variant="primary" size="sm" onClick={() => onAccept(order.id)}
                className="flex-1 bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold shadow-[0_0_12px_rgba(255,107,43,0.3)]">
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
