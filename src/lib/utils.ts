import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

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

// ============ 日期工具 ============

export interface DateOption {
  value: string
  label: string
}

/**
 * 產生派單日期選項（今天起算 N 天）
 * @param daysAhead 預設 14 天（今天 + 未來 14 天）
 */
export function getDateOptions(daysAhead: number = 14): DateOption[] {
  const options: DateOption[] = [
    { value: '', label: '選擇日期...' },
  ]
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayLabel = i === 0 ? '今天' : i === 1 ? '明天' : format(d, 'M/d (EEE)', { locale: zhTW })
    options.push({ value: dateStr, label: dayLabel })
  }
  return options
}
