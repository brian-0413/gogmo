'use client'

import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

interface OrderNoProps {
  scheduledTime: string | Date
  id: string
  className?: string
}

/** 產生格式化的單號：YYYYMMDD-流水號 */
export function formatOrderNo(scheduledTime: string | Date, id: string): string {
  let dateStr = format(new Date(), 'yyyyMMdd')
  try {
    const d = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : scheduledTime
    dateStr = format(d, 'yyyyMMdd')
  } catch { /* use today */ }
  const seq = id.slice(-4).toUpperCase()
  return `${dateStr}-${seq}`
}

export function OrderNo({ scheduledTime, id, className }: OrderNoProps) {
  const no = formatOrderNo(scheduledTime, id)
  return (
    <span
      className={cn(
        'font-mono-nums font-bold tracking-wider select-all',
        className
      )}
    >
      #{no}
    </span>
  )
}
