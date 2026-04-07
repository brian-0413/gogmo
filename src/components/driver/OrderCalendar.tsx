'use client'

import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek,
  endOfWeek, eachDayOfInterval, isSameMonth, isSameDay,
  isToday, addMonths, subMonths, startOfDay,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Order } from '@/types'

interface OrderCalendarProps {
  orders: Order[]
  selectedDate: Date | null
  onSelectDate: (date: Date | null) => void
}

const STATUS_DOT: Record<string, string> = {
  ACCEPTED: '#F59E0B',    // amber - orange
  ARRIVED: '#3B82F6',     // blue
  IN_PROGRESS: '#0C447C', // dark blue
  COMPLETED: '#008A05',    // green
  PUBLISHED: '#EF4444',   // red
}

export function OrderCalendar({ orders, selectedDate, onSelectDate }: OrderCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Build a map: date string -> orders for that day
  const ordersByDay = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const order of orders) {
      const d = typeof order.scheduledTime === 'string'
        ? new Date(order.scheduledTime)
        : order.scheduledTime
      const key = startOfDay(d).toISOString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(order)
    }
    return map
  }, [orders])

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { locale: zhTW })
    const calEnd = endOfWeek(monthEnd, { locale: zhTW })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  const prevMonth = () => setCurrentMonth(m => subMonths(m, 1))
  const nextMonth = () => setCurrentMonth(m => addMonths(m, 1))
  const goToday = () => {
    setCurrentMonth(new Date())
    onSelectDate(startOfDay(new Date()))
  }

  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#DDDDDD]">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[#1C1917]">
            {format(currentMonth, 'yyyy 年 M 月', { locale: zhTW })}
          </h2>
          <button
            onClick={goToday}
            className="text-[11px] px-2.5 py-1 rounded-full bg-[#F4EFE9] text-[#717171] hover:bg-[#E8E2D9] hover:text-[#222222] transition-colors font-medium"
          >
            今天
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#717171] hover:bg-[#F4EFE9] hover:text-[#222222] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#717171] hover:bg-[#F4EFE9] hover:text-[#222222] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week day labels */}
      <div className="grid grid-cols-7 border-b border-[#DDDDDD]">
        {weekDays.map(day => (
          <div key={day} className="py-2 text-center text-[11px] font-medium text-[#A8A29E]">
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dayKey = startOfDay(day).toISOString()
          const dayOrders = ordersByDay.get(dayKey) || []
          const hasOrders = dayOrders.length > 0
          const inMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const today = isToday(day)

          // Show order status dots (max 3)
          const dots = dayOrders.slice(0, 3).map(o => STATUS_DOT[o.status] || '#F59E0B')

          return (
            <button
              key={dayKey}
              onClick={() => {
                if (isSelected) {
                  onSelectDate(null)
                } else {
                  onSelectDate(startOfDay(day))
                }
              }}
              className={`
                relative flex flex-col items-center justify-start pt-2 pb-2 min-h-[48px] sm:min-h-[56px] transition-all duration-100
                ${inMonth ? 'text-[#222222]' : 'text-[#D6D3D1]'}
                ${isSelected ? 'bg-[#F59E0B]/10' : 'hover:bg-[#F4EFE9]/60'}
                ${today && !isSelected ? 'bg-[#F59E0B]/5' : ''}
              `}
            >
              {/* Today indicator */}
              {today && (
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border border-[#F59E0B]" />
              )}

              {/* Day number */}
              <span className={`
                relative z-10 text-[13px] font-medium leading-none
                ${today ? 'font-bold text-[#F59E0B]' : ''}
                ${isSelected ? 'font-bold text-[#1C1917]' : ''}
              `}>
                {format(day, 'd')}
              </span>

              {/* Order dots */}
              {hasOrders && (
                <div className="flex items-center gap-0.5 mt-1.5">
                  {dots.map((color, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {dayOrders.length > 3 && (
                    <span className="text-[9px] text-[#A8A29E] leading-none">+{dayOrders.length - 3}</span>
                  )}
                </div>
              )}

              {/* Order count badge */}
              {hasOrders && (
                <span className={`
                  mt-1 text-[9px] font-bold px-1 py-0.5 rounded-full leading-none
                  ${isSelected
                    ? 'bg-[#F59E0B] text-white'
                    : 'bg-[#F59E0B]/15 text-[#B45309]'
                  }
                `}>
                  {dayOrders.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-[#DDDDDD] bg-[#FAFAF8]">
        <span className="text-[10px] text-[#A8A29E]">狀態：</span>
        {[
          { color: '#F59E0B', label: '已接單' },
          { color: '#3B82F6', label: '已抵達' },
          { color: '#0C447C', label: '進行中' },
          { color: '#008A05', label: '已完成' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-[#78716C]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
