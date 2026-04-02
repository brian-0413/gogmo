import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 產生格式化的單號：YYYYMMDD-流水號（0001-9999）
export function formatOrderNo(scheduledTime: string | Date, orderSeq?: number): string {
  let dateStr = format(new Date(), 'yyyyMMdd')
  try {
    const d = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : scheduledTime
    dateStr = format(d, 'yyyyMMdd')
  } catch { /* use today */ }
  if (orderSeq !== undefined) {
    return `${dateStr}-${String(orderSeq).padStart(4, '0')}`
  }
  return dateStr
}
