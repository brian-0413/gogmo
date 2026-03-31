'use client'

import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { User, Package, FileText, Zap, Clock, Car } from 'lucide-react'
import { useState, useEffect } from 'react'

type OrderType = 'pickup' | 'dropoff' | 'transfer' | 'charter' | 'pending'
type VehicleType = 'small' | 'suv' | 'van9' | 'any' | 'any_r' | 'pending'

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
  type?: OrderType
  vehicle?: VehicleType
  plateType?: string
  notes?: string | null
  note?: string | null
  rawText?: string | null
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

  // 單號
  const orderNo = (() => {
    let dateStr = format(new Date(), 'yyyyMMdd')
    try {
      dateStr = format(scheduledDate, 'yyyyMMdd')
    } catch { /* use today */ }
    return `${dateStr}-${order.id.slice(-4)}`
  })()

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

  // 種類 Badge 顏色
  const typeBadgeColor = orderType === 'pickup' ? { bg: '#22c55e', text: 'white' }
    : orderType === 'dropoff' ? { bg: '#3b82f6', text: 'white' }
    : orderType === 'transfer' ? { bg: '#a855f7', text: 'white' }
    : orderType === 'charter' ? { bg: '#f59e0b', text: 'black' }
    : { bg: '#444', text: '#a0a0a0' }

  // 車型 Badge 顏色
  const vehicleBadgeColor = vehicle === 'van9' ? { bg: '#ef4444', text: 'white' }
    : vehicle === 'suv' ? { bg: '#f59e0b', text: 'black' }
    : vehicle === 'small' ? { bg: '#666', text: 'white' }
    : vehicle === 'any_r' ? { bg: '#3b82f6', text: 'white' }
    : { bg: '#444', text: '#a0a0a0' }

  // 接送地點標題
  const isPickup = orderType === 'pickup'
  const pickupLabel = isPickup ? '桃園機場' : '上車'
  const dropoffLabel = isPickup ? '目的地' : '桃園機場'

  if (compact) {
    return (
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 hover:border-white/20 transition-all">
        {/* 第一列：單號 + 狀態 */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-[#666]">{orderNo}</span>
          <OrderStatusBadge status={order.status} />
        </div>
        {/* 第二列：日期時間 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#e0e0e0]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-sm font-mono font-bold text-white">
            {format(scheduledDate, 'HH:mm')}
          </span>
        </div>
        {/* 第三列：金額 (compact版略小) */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold" style={{ color: '#ff8c42' }}>
            NT${order.price}
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}
          >
            {TYPE_LABELS[orderType]}
          </span>
        </div>
        {/* 起迄點 */}
        <div className="flex items-center gap-1.5 text-xs text-[#a0a0a0] mb-2">
          <span className="truncate">{order.pickupLocation}</span>
          <span className="text-[#666] flex-shrink-0">→</span>
          <span className="truncate">{order.dropoffLocation}</span>
        </div>
        {/* 備註 (compact版淡化) */}
        {notes && (
          <div className="text-xs text-[#666] italic bg-white/5 p-1.5 rounded truncate">
            {notes}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden transition-all hover:border-white/20 ${isNew ? 'animate-cardEntry' : ''}`}>
      <div className="p-4">
        {/* 第一列：單號 + 即時狀態 */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-[#666]">{orderNo}</span>
          <div className="flex items-center gap-1.5">
            {urgency !== "normal" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{
                backgroundColor: urgency === "urgent" ? '#ef4444' : '#ff8c42',
                color: urgency === "urgent" ? 'white' : 'black'
              }}>
                {urgency === "urgent" ? <Zap className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                {countdown || '00:00'}
              </span>
            )}
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {/* 第二列：金額 (特別顯眼) */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl font-bold" style={{ color: '#ff8c42' }}>
            NT${order.price.toLocaleString()}
          </span>
          <span
            className="text-[10px] font-bold px-2 py-1 rounded"
            style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}
          >
            {TYPE_LABELS[orderType]}
          </span>
        </div>

        {/* 第三列：日期時間 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#e0e0e0]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-sm font-mono font-bold text-white">
            {format(scheduledDate, 'HH:mm')}
          </span>
          {order.flightNumber && (
            <span className="bg-white/10 px-2 py-0.5 rounded font-mono text-xs text-[#e0e0e0]">
              {order.flightNumber}
            </span>
          )}
        </div>

        {/* 起迄點 */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: typeBadgeColor.bg }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#a0a0a0] mb-0.5">{pickupLabel}</p>
              <p className="text-sm font-medium text-[#e0e0e0] truncate">
                {order.pickupLocation}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-[#666] mt-1.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#a0a0a0] mb-0.5">{dropoffLabel}</p>
              <p className="text-sm font-medium text-[#e0e0e0] truncate">
                {order.dropoffLocation}
              </p>
            </div>
          </div>
        </div>

        {/* 車型 Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[10px] font-bold px-2 py-1 rounded"
            style={{ backgroundColor: vehicleBadgeColor.bg, color: vehicleBadgeColor.text }}
          >
            {VEHICLE_LABELS[vehicle]}
            {order.plateType && order.plateType !== 'any' ? ` (${order.plateType}牌)` : ''}
          </span>
        </div>

        {/* 乘客資訊 */}
        <div className="flex items-center gap-3 text-xs text-[#666] mb-3 pt-2 border-t border-white/5">
          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.passengerName}</span>
          <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {order.passengerCount}人 / {order.luggageCount}行李</span>
        </div>

        {/* 備註 (原文備註 - 特別顯眼) */}
        {notes && (
          <div className="text-xs text-[#a0a0a0] bg-[#ff8c42]/5 border border-[#ff8c42]/20 p-2.5 rounded-lg mb-3 flex items-start gap-1.5">
            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#ff8c42]" />
            <span className="leading-relaxed">{notes}</span>
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
