'use client'

import { MapPin, Users, ArrowRight } from 'lucide-react'
import { format, parseISO, differenceInMinutes } from 'date-fns'

interface Order {
  id: string
  pickupLocation: string
  dropoffLocation: string
  scheduledTime: Date | string
  price: number
  note?: string | null
  passengerCount?: number | null
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

function formatTime(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === "string" ? parseISO(dateTime) : new Date(dateTime)
    return format(date, "HH:mm")
  } catch {
    return "--:--"
  }
}

function formatDate(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === "string" ? parseISO(dateTime) : new Date(dateTime)
    return format(date, "M/d")
  } catch {
    return "--"
  }
}

function OrderCard({ order }: { order: Order }) {
  const orderType = getOrderType(order.pickupLocation, order.dropoffLocation)
  const isPickup = orderType === "pickup"
  const urgency = getTimeUrgency(order.scheduledTime)

  // 接機: 藍色 / 送機: 琥珀色
  const tagBg = isPickup ? 'bg-[#E6F1FB]' : 'bg-[#FFF3E0]'
  const tagText = isPickup ? 'text-[#0C447C]' : 'text-[#92400E]'

  // 緊急: 紅色 / 儘快: 橙色 / 一般: 暖灰
  const urgencyBg = urgency === 'urgent' ? 'bg-[#FCEBEB]' : urgency === 'soon' ? 'bg-[#FFF3E0]' : 'bg-[#F4EFE9]'
  const urgencyText = urgency === 'urgent' ? 'text-[#A32D2D]' : urgency === 'soon' ? 'text-[#B45309]' : 'text-[#717171]'

  const fromLocation = isPickup
    ? "桃園機場"
    : order.pickupLocation.replace("桃園機場", "").replace("國際機場", "").replace("機場", "").trim() || order.pickupLocation

  const toLocation = isPickup
    ? order.dropoffLocation.replace("桃園機場", "").replace("國際機場", "").replace("機場", "").trim() || order.dropoffLocation
    : "桃園機場"

  const carLabel = order.note?.includes("休旅") ? "休旅" : order.note?.includes("9座") || order.note?.includes("VITO") ? "9人座" : "小車"

  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-normal ${tagBg} ${tagText}`}>
            {isPickup ? "接機" : "送機"}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-normal ${urgencyBg} ${urgencyText}`}>
            {urgency === 'urgent' && <span className="text-[#A32D2D]">!</span>}
            {formatTime(order.scheduledTime)} · {formatDate(order.scheduledTime)}
          </span>
        </div>
        <span className="text-[11px] text-[#B0B0B0] font-mono-nums">#{order.id.slice(0, 6)}</span>
      </div>

      {/* Price */}
      <div className="mb-3">
        <span className="text-[28px] font-bold text-[#FF385C] font-mono-nums">
          NT${order.price.toLocaleString()}
        </span>
      </div>

      {/* Route */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FF385C] flex-shrink-0" />
          <span className="text-[15px] font-semibold text-[#222222] truncate">{fromLocation}</span>
        </div>
        <div className="flex items-center gap-2 pl-0.5">
          <div className="w-0.5 h-3 bg-[#DDDDDD]" />
          <ArrowRight className="w-3 h-3 text-[#B0B0B0]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#DDDDDD] flex-shrink-0" />
          <span className="text-[15px] font-semibold text-[#222222] truncate">{toLocation}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#EBEBEB] mb-3" />

      {/* Meta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[12px] text-[#717171]">
          <span className="px-2 py-0.5 bg-[#F4EFE9] border border-[#DDDDDD] rounded text-[11px]">{carLabel}</span>
          <span className="flex items-center gap-1 text-[11px] text-[#B0B0B0]">
            <Users className="w-3 h-3" />
            {order.passengerCount || 1}人
          </span>
        </div>
        <span className="text-[11px] text-[#B0B0B0]">立即接單</span>
      </div>
    </div>
  )
}

interface FlipboardGridProps {
  orders: Order[]
  gridSize?: number
}

export function FlipboardGrid({ orders, gridSize = 20 }: FlipboardGridProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-24 border border-[#DDDDDD] rounded-xl bg-[#F4EFE9]">
        <MapPin className="w-10 h-10 text-[#B0B0B0] mx-auto mb-3" />
        <p className="text-[#717171] mb-1 text-lg font-medium">目前沒有可接的行程</p>
        <p className="text-[#B0B0B0] text-sm">請稍後再回來查看，或聯繫派單方發布新行程</p>
      </div>
    )
  }

  const displayOrders = orders.slice(0, gridSize)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {displayOrders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  )
}
