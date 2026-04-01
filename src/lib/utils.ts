import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 產生格式化的單號：日期-流水號
export function formatOrderNo(scheduledTime: string | Date, id: string): string {
  let dateStr = format(new Date(), 'yyyyMMdd')
  try {
    const d = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : scheduledTime
    dateStr = format(d, 'yyyyMMdd')
  } catch { /* use today */ }
  const seq = id.slice(-4)
  return `${dateStr}-${seq}`
}
