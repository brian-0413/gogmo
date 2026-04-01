'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Car, Users, Clock } from 'lucide-react'
import { format, parseISO, differenceInMinutes, differenceInSeconds } from 'date-fns'

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

interface CardInnerProps {
  order: Order
  animationKey: string
}

function CardInner({ order, animationKey }: CardInnerProps) {
  const orderType = getOrderType(order.pickupLocation, order.dropoffLocation)
  const isPickup = orderType === "pickup"
  const urgency = getTimeUrgency(order.scheduledTime)
  const badgeColor = isPickup ? '#3b82f6' : '#22c55e'
  const [countdown, setCountdown] = useState<string>('')

  useEffect(() => {
    if (urgency === "urgent" || urgency === "soon") {
      const updateCountdown = () => {
        const now = new Date()
        const time = typeof order.scheduledTime === 'string' ? parseISO(order.scheduledTime) : new Date(order.scheduledTime)
        const seconds = differenceInSeconds(time, now)
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

  return (
    <div
      key={animationKey}
      className="absolute inset-0 bg-[#0c0c10] rounded-lg p-3 animate-content-slide"
    >
      {/* Urgent Badge with countdown */}
      {urgency === "urgent" && (
        <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-bold text-white flex items-center gap-1 z-20 animate-badge-pulse" style={{ backgroundColor: '#ef4444' }}>
          <Zap className="w-2.5 h-2.5" />
          <span>{countdown || '00:00'}</span>
        </div>
      )}
      {urgency === "soon" && (
        <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-bold text-[#060608] flex items-center gap-1 z-20" style={{ backgroundColor: '#ff6b2b' }}>
          <Clock className="w-2.5 h-2.5" />
          <span>{countdown || '00:00'}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
        >
          {isPickup ? "接機" : "送機"}
        </span>
        <span className="text-[9px] text-[#6b6560] font-mono">
          {formatTime(order.scheduledTime)}
        </span>
      </div>

      {/* Price */}
      <div className="mb-2">
        <span className="text-2xl font-bold" style={{ color: '#ff6b2b' }}>
          NT${order.price}
        </span>
      </div>

      {/* Route */}
      <div className="space-y-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: badgeColor }} />
          <span className="text-[11px] text-[#f0ebe3] truncate font-medium">
            {isPickup ? "桃園機場" : order.pickupLocation.replace("桃園機場", "").replace("國際機場", "").substring(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#4a4a52]" />
          <span className="text-[11px] text-[#f0ebe3] truncate font-medium">
            {isPickup ? order.dropoffLocation.replace("桃園機場", "").replace("國際機場", "").substring(0, 8) : "桃園機場"}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 text-[9px] text-[#6b6560] pt-1.5 border-t border-[#1e1e26]">
        <div className="flex items-center gap-1">
          <Car className="w-3 h-3" />
          <span>{order.note?.includes("休旅") ? "休旅" : "一般"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{order.passengerCount || 1}人</span>
        </div>
      </div>
    </div>
  )
}

interface FlipboardGridProps {
  orders: Order[]
  gridSize?: number
}

export function FlipboardGrid({ orders, gridSize = 20 }: FlipboardGridProps) {
  const [displayedOrders, setDisplayedOrders] = useState<(Order | null)[]>([])
  const [currentUpdate, setCurrentUpdate] = useState<{
    slotIndex: number
    newOrder: Order
    phase: 'exiting' | 'entering'
  } | null>(null)
  const [animationKeys, setAnimationKeys] = useState<Record<number, string>>({})
  const [newOrdersPool, setNewOrdersPool] = useState<Order[]>([])
  const isUpdating = useRef(false)
  const updateQueueRef = useRef<number[]>([])
  const updateInterval = 300

  useEffect(() => {
    if (orders.length > 0) {
      const initial = orders.slice(0, gridSize)
      const initialKeys: Record<number, string> = {}
      initial.forEach((_, i) => { initialKeys[i] = `init-${i}-${Date.now()}` })
      setAnimationKeys(initialKeys)
      setDisplayedOrders([...initial, ...Array(gridSize - initial.length).fill(null)])
      setNewOrdersPool(orders.slice(gridSize))
    }
  }, [orders, gridSize])

  const processNextUpdate = useCallback(() => {
    if (isUpdating.current || updateQueueRef.current.length === 0) return

    isUpdating.current = true
    const slotIndex = updateQueueRef.current.shift()!
    const newOrder = newOrdersPool[Math.floor(Math.random() * newOrdersPool.length)]

    setCurrentUpdate({ slotIndex, newOrder, phase: 'exiting' })

    setTimeout(() => {
      setDisplayedOrders(prev => {
        const updated = [...prev]
        updated[slotIndex] = newOrder
        return updated
      })
      setAnimationKeys(prev => ({ ...prev, [slotIndex]: `update-${slotIndex}-${Date.now()}` }))
      setCurrentUpdate(prev => prev ? { ...prev, phase: 'entering' } : null)

      setTimeout(() => {
        setCurrentUpdate(null)
        isUpdating.current = false
        processNextUpdate()
      }, 400)
    }, 400)
  }, [newOrdersPool])

  useEffect(() => {
    if (newOrdersPool.length === 0) return

    const interval = setInterval(() => {
      const numToAdd = Math.floor(Math.random() * 3) + 1
      const availableSlots = Array.from({ length: gridSize }, (_, i) => i)
        .filter(i => !updateQueueRef.current.includes(i) && currentUpdate?.slotIndex !== i)

      for (let i = 0; i < numToAdd && availableSlots.length > 0; i++) {
        const idx = Math.floor(Math.random() * availableSlots.length)
        updateQueueRef.current.push(availableSlots[idx])
        availableSlots.splice(idx, 1)
      }

      if (!isUpdating.current) {
        processNextUpdate()
      }
    }, updateInterval)

    return () => clearInterval(interval)
  }, [newOrdersPool, updateInterval, gridSize, currentUpdate, processNextUpdate])

  if (orders.length === 0) {
    return (
      <div className="text-center py-24 border border-[#1e1e26] rounded-3xl bg-[#0c0c10]/50 backdrop-blur-sm">
        <p className="text-[#6b6560] mb-2 text-lg">目前沒有可接的行程</p>
        <p className="text-[#4a4a52] text-sm">請稍後再回來查看，或聯繫車頭發布新行程</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {displayedOrders.slice(0, gridSize).map((order, index) => {
        if (!order) {
          return <div key={`empty-${index}`} className="bg-[#0c0c10]/30 rounded-lg min-h-[120px]" />
        }

        return (
          <div
            key={`${order.id}-${index}`}
            className="relative min-h-[120px] overflow-hidden rounded-lg"
          >
            <div className="absolute inset-0 bg-[#0c0c10] rounded-lg" />
            <CardInner
              order={order}
              animationKey={animationKeys[index] || `init-${index}`}
            />
          </div>
        )
      })}
    </div>
  )
}
