'use client'

import { format, parseISO } from 'date-fns'
import { Pencil, Trash2, User, Car } from 'lucide-react'

type OrderStatus = 'PENDING' | 'PUBLISHED' | 'ASSIGNED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface Order {
  id: string
  status: OrderStatus
  type?: string
  vehicle?: string
  plateType?: string
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
  notes?: string | null
  rawText?: string | null
  driver?: {
    user: { name: string }
    licensePlate: string
    carType: string
    carColor: string
  } | null
  createdAt: string
}

// 產生格式化的單號：日期-流水號
function formatOrderNo(scheduledTime: string | Date, id: string): string {
  let dateStr = format(new Date(), 'yyyyMMdd')
  try {
    const d = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : scheduledTime
    dateStr = format(d, 'yyyyMMdd')
  } catch { /* use today */ }
  // 取 id 的後 4 碼當流水號
  const seq = id.slice(-4)
  return `${dateStr}-${seq}`
}

// 行程狀態顯示
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: '待接單', bg: 'bg-[#ff8c42]/20', text: 'text-[#ff8c42]' },
  PUBLISHED: { label: '待接單', bg: 'bg-[#ff8c42]/20', text: 'text-[#ff8c42]' },
  ASSIGNED: { label: '已指派', bg: 'bg-[#3b82f6]/20', text: 'text-[#3b82f6]' },
  ACCEPTED: { label: '已接單', bg: 'bg-[#3b82f6]/20', text: 'text-[#3b82f6]' },
  ARRIVED: { label: '已抵達', bg: 'bg-[#a855f7]/20', text: 'text-[#a855f7]' },
  IN_PROGRESS: { label: '進行中', bg: 'bg-[#22c55e]/20', text: 'text-[#22c55e]' },
  COMPLETED: { label: '已完成', bg: 'bg-white/10', text: 'text-[#666]' },
  CANCELLED: { label: '已取消', bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]' },
}

interface DispatcherOrderCardProps {
  order: any
  onEdit: (order: any) => void
  onDelete: (orderId: string) => void
}

export function DispatcherOrderCard({ order, onEdit, onDelete }: DispatcherOrderCardProps) {
  const orderNo = formatOrderNo(order.scheduledTime, order.id)

  const scheduledDate = typeof order.scheduledTime === 'string'
    ? parseISO(order.scheduledTime)
    : order.scheduledTime

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING
  const hasDriver = !!order.driver

  // 司機資訊顯示
  const driverInfo = hasDriver
    ? `${order.driver!.user.name} / ${order.driver!.licensePlate} / ${order.driver!.carColor} / ${order.driver!.carType}`
    : null

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
      {/* 第一列：單號 + 編輯刪除 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-[#666]">{orderNo}</span>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(order)}
            className="p-1.5 rounded text-[#666] hover:text-white hover:bg-white/10 transition-colors"
            title="編輯"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(order.id)}
            className="p-1.5 rounded text-[#666] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
            title="刪除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 第二列：日期時間 + 狀態 badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#e0e0e0]">
            {format(scheduledDate, 'M/dd (E)', { locale: require('date-fns/locale/zh-TW').default })}
          </span>
          <span className="text-base font-mono font-bold text-white">
            {format(scheduledDate, 'HH:mm')}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusConfig.bg} ${statusConfig.text} border-current/20`}>
          {statusConfig.label}
        </span>
      </div>

      {/* 第三列：起迄點 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
            <span className="text-[#e0e0e0] truncate">{order.pickupLocation}</span>
          </div>
          <span className="text-[#666] flex-shrink-0 mx-1">→</span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#ef4444] flex-shrink-0" />
            <span className="text-[#e0e0e0] truncate">{order.dropoffLocation}</span>
          </div>
        </div>
      </div>

      {/* 第四列：接單司機資訊 */}
      <div className={`mb-3 p-2.5 rounded-lg ${hasDriver ? 'bg-white/5' : 'bg-[#ff8c42]/5'}`}>
        <div className="flex items-center gap-2">
          <User className={`w-3.5 h-3.5 flex-shrink-0 ${hasDriver ? 'text-[#a0a0a0]' : 'text-[#ff8c42]'}`} />
          {hasDriver ? (
            <span className="text-xs text-[#e0e0e0] truncate">{driverInfo}</span>
          ) : (
            <span className="text-xs text-[#ff8c42]">等待司機接單</span>
          )}
        </div>
      </div>

      {/* 第五列：金額 */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold" style={{ color: '#ff8c42' }}>
          NT${order.price.toLocaleString()}
        </span>
        <div className="flex gap-1.5">
          {/* 肯驛 badge */}
          {order.kenichiRequired && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30">
              肯驛
            </span>
          )}
          {/* 車型 badge */}
          {order.vehicle && order.vehicle !== 'pending' && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-[#a0a0a0] border border-white/10">
              {order.vehicle === 'small' ? '小車' : order.vehicle === 'suv' ? '休旅' : order.vehicle === 'van9' ? '9人座' : order.vehicle}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
