'use client'

import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { User, Package, FileText, Zap, Clock, Car, MapPin } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Order {
  id: string
  status: string
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  dropoffLocation: string
  dropoffAddress: string
  passengerCount: number
  luggageCount: number
  scheduledTime: string | Date
  price: number
  note?: string | null
  dispatcher?: {
    companyName: string
  }
}

interface OrderCardProps {
  order: Order
  onAccept?: (orderId: string) => void
  onView?: (orderId: string) => void
  showActions?: boolean
  compact?: boolean
  isNew?: boolean
}

function getOrderType(pickupLocation: string, dropoffLocation: string): "pickup" | "dropoff" {
  if (pickupLocation.includes("桃園機場") || pickupLocation.includes("機場")) return "pickup"
  if (dropoffLocation.includes("桃園機場") || dropoffLocation.includes("機場")) return "dropoff"
  return "dropoff"
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
  const orderType = getOrderType(order.pickupLocation, order.dropoffLocation)
  const isPickup = orderType === "pickup"
  const urgency = getTimeUrgency(order.scheduledTime)
  const [countdown, setCountdown] = useState<string>('')

  useEffect(() => {
    if (urgency === "urgent" || urgency === "soon") {
      const updateCountdown = () => {
        const now = new Date()
        const time = typeof order.scheduledTime === 'string' ? parseISO(order.scheduledTime) : new Date(order.scheduledTime)
        const seconds = differenceInMinutes(time, now) * 60 - (now.getSeconds())
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

  const badgeColor = isPickup ? '#3b82f6' : '#22c55e'

  return (
    <div className={`bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden transition-all hover:border-white/20 ${isNew ? 'animate-cardEntry' : ''}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold" style={{ color: '#ff8c42' }}>
              NT${order.price}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-2">
            {urgency !== "normal" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{
                backgroundColor: urgency === "urgent" ? '#ef4444' : '#ff8c42',
                color: urgency === "urgent" ? 'white' : 'black'
              }}>
                {urgency === "urgent" ? <Zap className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                {countdown || '00:00'}
              </span>
            )}
            <span className="text-[10px] text-[#666] font-mono">
              #{order.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Flight Info */}
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-white/10 px-2 py-1 rounded font-mono text-xs text-[#e0e0e0]">
            {order.flightNumber}
          </span>
          <span className="text-xs text-[#a0a0a0]">
            {format(scheduledDate, 'MM/dd (E)', { locale: zhTW })} • {format(scheduledDate, 'HH:mm')}
          </span>
        </div>

        {/* Locations */}
        <div className="space-y-2 mb-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: badgeColor }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#a0a0a0] mb-0.5">{isPickup ? '桃園機場' : '上車地點'}</p>
              <p className="text-sm font-medium text-[#e0e0e0] truncate">
                {order.pickupLocation}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-[#666] mt-1.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#a0a0a0] mb-0.5">{isPickup ? '目的地' : '桃園機場'}</p>
              <p className="text-sm font-medium text-[#e0e0e0] truncate">
                {order.dropoffLocation}
              </p>
            </div>
          </div>
        </div>

        {/* Passenger Info */}
        <div className="flex items-center gap-3 text-xs text-[#666] mb-3 pt-2 border-t border-white/5">
          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.passengerName}</span>
          <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {order.passengerCount}人 / {order.luggageCount}行李</span>
        </div>

        {/* Note */}
        {order.note && (
          <div className="text-xs text-[#888] italic mb-3 bg-white/5 p-2 rounded flex items-start gap-1">
            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" /> {order.note}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t border-white/5">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(order.id)}
                className="flex-1 border-white/20 text-[#a0a0a0] hover:bg-white/10 hover:text-white"
              >
                查看詳情
              </Button>
            )}
            {onAccept && order.status === 'PENDING' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onAccept(order.id)}
                className="flex-1 bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-semibold"
              >
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
export type { Order }
