'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, X } from 'lucide-react'

export interface TransferPendingData {
  transferId: string
  orderId: string
  fromDriverId: string
  toDriverId?: string
  status: string
  note?: string
  // Full order info embedded
  order?: {
    scheduledTime: string
    price: number
    pickupLocation: string
    dropoffLocation: string
    type: string
    vehicle: string
    orderDate?: string
    orderSeq?: number
  }
  fromDriver?: {
    licensePlate: string
    carType: string
    user?: { name: string }
  }
  toDriver?: {
    licensePlate: string
    carType: string
    user?: { name: string }
  }
}

interface TransferConfirmBannerProps {
  transfer: TransferPendingData
  token: string | null
  onApprove: (transferId: string, orderId: string) => void
  onReject: (transferId: string, orderId: string, note: string) => void
  onDismiss: () => void
}

function formatOrderId(orderId: string): string {
  return `#${orderId.slice(2, 10)}`
}

function getVehicleLabel(vehicle: string): string {
  const map: Record<string, string> = {
    small: '小車', suv: '休旅車', van9: '9人座',
    any: '任意車', any_r: '任意R牌', pending: '待確認',
  }
  return map[vehicle] || vehicle || '—'
}

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    pickup: '接機', dropoff: '送機', pickup_boat: '接船',
    dropoff_boat: '送船', transfer: '交通接駁', charter: '包車', pending: '待確認',
  }
  return map[type] || type || '—'
}

function formatShortTime(scheduledTime: string | Date, orderDate?: string): string {
  try {
    const d = new Date(scheduledTime)
    return format(d, 'M/d HH:mm')
  } catch {
    return String(scheduledTime || '—')
  }
}

function TransferRejectDialog({
  orderId,
  onConfirm,
  onCancel,
}: {
  orderId: string
  onConfirm: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white border border-[#DDDDDD] rounded-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDDDDD]">
          <h3 className="text-[18px] font-medium text-[#222222]">拒絕轉單</h3>
          <button onClick={onCancel} className="text-[#717171] hover:text-[#222222] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#717171] mb-3">
            請填寫拒絕原因（選填），原司機將收到此通知。
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例如：已另有司機接手、不建議轉單..."
            className="w-full h-24 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg px-4 py-3 text-sm text-[#222222] placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] resize-none"
          />
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <Button variant="outline" onClick={onCancel} className="flex-1 text-[14px]">
            取消
          </Button>
          <Button onClick={() => onConfirm(note)} className="flex-1 text-[14px]">
            確認拒絕
          </Button>
        </div>
      </div>
    </div>
  )
}

export function TransferConfirmBanner({ transfer, token, onApprove, onReject, onDismiss }: TransferConfirmBannerProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  const order = transfer.order
  const fromDriver = transfer.fromDriver
  const toDriver = transfer.toDriver

  // Build order display string
  const orderDate = order?.orderDate
    ? format(new Date(order.orderDate), 'M/d')
    : order?.scheduledTime
    ? formatShortTime(order.scheduledTime).split(' ')[0]
    : '—'
  const orderTime = order?.scheduledTime ? formatShortTime(order.scheduledTime).split(' ')[1] || formatShortTime(order.scheduledTime) : '—'
  const typeLabel = order?.type ? getTypeLabel(order.type) : '—'
  const priceStr = order?.price ? `$${order.price.toLocaleString()}` : '—'

  // Locations: use pickup/dropoff from transfer order
  const pickupLoc = order?.pickupLocation || '—'
  const dropoffLoc = order?.dropoffLocation || '—'

  const handleApprove = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${transfer.orderId}/transfer-approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId: transfer.transferId }),
      })
      const data = await res.json()
      if (data.success) {
        onApprove(transfer.transferId, transfer.orderId)
      } else {
        alert(data.error || '批准失敗')
      }
    } catch {
      alert('網路錯誤，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (note: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${transfer.orderId}/transfer-reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId: transfer.transferId, note }),
      })
      const data = await res.json()
      if (data.success) {
        onReject(transfer.transferId, transfer.orderId, note)
      } else {
        alert(data.error || '拒絕失敗')
      }
    } catch {
      alert('網路錯誤，請重試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-[#FFF8E6] border border-[#D4A017] rounded-xl p-4 mb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#D4A017] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-medium text-[#222222]">轉單請求</span>
          </div>
          <button
            onClick={onDismiss}
            className="text-[#717171] hover:text-[#222222] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order info */}
        {order && (
          <div className="bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 mb-3">
            <div className="text-[14px] text-[#222222] font-mono-nums">
              <span className="text-[18px] font-bold mr-2">{formatOrderId(transfer.orderId)}</span>
              <span className="text-[#717171]">
                {orderDate} {orderTime} {typeLabel}
              </span>
            </div>
            <div className="text-[13px] text-[#717171] mt-1">
              <span>{pickupLoc}</span>
              <span className="mx-2">→</span>
              <span>{dropoffLoc}</span>
              <span className="ml-2 font-medium text-[#222222] font-mono-nums">{priceStr}</span>
            </div>
          </div>
        )}

        {/* Drivers info */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white border border-[#DDDDDD] rounded-lg px-3 py-2">
            <p className="text-[11px] text-[#717171] mb-0.5">原司機</p>
            <p className="text-[13px] font-medium text-[#222222]">
              {fromDriver?.user?.name || '—'}
            </p>
            <p className="text-[12px] text-[#717171] font-mono-nums">
              {fromDriver?.licensePlate || '—'} {getVehicleLabel(fromDriver?.carType || '')}
            </p>
          </div>
          <div className="bg-white border border-[#DDDDDD] rounded-lg px-3 py-2">
            <p className="text-[11px] text-[#717171] mb-0.5">接手司機</p>
            <p className="text-[13px] font-medium text-[#222222]">
              {toDriver?.user?.name || '等待中'}
            </p>
            <p className="text-[12px] text-[#717171] font-mono-nums">
              {toDriver ? `${toDriver.licensePlate || '—'} ${getVehicleLabel(toDriver.carType || '')}` : '—'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleApprove}
            loading={loading}
            className="flex-1 text-[14px] py-2.5 bg-[#008A05] hover:bg-[#007004] border-[#008A05]"
          >
            同意轉單
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowRejectDialog(true)}
            loading={loading}
            className="flex-1 text-[14px] py-2.5 text-[#B45309] border-[#DDDDDD] hover:bg-[#FFF3E0]"
          >
            拒絕
          </Button>
        </div>
      </div>

      {showRejectDialog && (
        <TransferRejectDialog
          orderId={transfer.orderId}
          onConfirm={(note) => {
            setShowRejectDialog(false)
            handleReject(note)
          }}
          onCancel={() => setShowRejectDialog(false)}
        />
      )}
    </>
  )
}
