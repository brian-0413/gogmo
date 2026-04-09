'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { TRANSFER_FEE_RATE, MIN_BONUS_POINTS } from '@/lib/constants'
import { formatOrderNo } from '@/lib/utils'
import type { Order } from '@/types'

interface TransferRequestFormProps {
  order: Order
  driverBalance: number
  token: string | null
  onSuccess: (message: string) => void
  onCancel: () => void
}

export function TransferRequestForm({
  order,
  driverBalance,
  token,
  onSuccess,
  onCancel,
}: TransferRequestFormProps) {
  const [reason, setReason] = useState('')
  const [bonusPoints, setBonusPoints] = useState(MIN_BONUS_POINTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const scheduledDate = typeof order.scheduledTime === 'string'
    ? parseISO(order.scheduledTime)
    : order.scheduledTime
  const orderNo = formatOrderNo(scheduledDate, order.orderSeq)
  const transferFee = Math.floor(order.price * TRANSFER_FEE_RATE)
  const totalDeduct = transferFee + bonusPoints

  const handleSubmit = async () => {
    if (!token) return
    if (bonusPoints < MIN_BONUS_POINTS) {
      setError(`bonus 點數最低 ${MIN_BONUS_POINTS} 點`)
      return
    }
    if (totalDeduct > driverBalance) {
      setError(`帳戶餘額不足（需 ${totalDeduct.toLocaleString()} 點，目前 ${driverBalance.toLocaleString()} 點）`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${order.id}/transfer-request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, bonusPoints }),
      })
      const data = await res.json()
      if (data.success) {
        onSuccess(`已發出小隊支援請求，將扣除 ${totalDeduct.toLocaleString()} 點（轉單費 ${transferFee.toLocaleString()} + bonus ${bonusPoints.toLocaleString()}）`)
      } else {
        setError(data.error || '請求失敗')
      }
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDDDDD] bg-[#0C447C]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-[16px] font-bold text-white">請求小隊支援</h3>
          </div>
          <button onClick={onCancel} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* 訂單摘要 */}
          <div className="mb-4 p-3 bg-[#F4EFE9] border border-[#DDDDDD] rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 bg-[#FF385C] text-white text-[12px] font-bold font-mono-nums rounded">
                #{orderNo}
              </span>
              <span className="text-[13px] text-[#717171]">
                {format(scheduledDate, 'M/dd (E) HH:mm', { locale: zhTW })}
              </span>
            </div>
            <div className="text-[13px] text-[#717171]">
              {order.pickupLocation} → {order.dropoffLocation}
            </div>
            <div className="text-[15px] font-bold text-[#FF385C] font-mono-nums mt-1">
              NT${order.price.toLocaleString()}
            </div>
          </div>

          {/* 費用說明 */}
          <div className="mb-4">
            <p className="text-[12px] text-[#717171] mb-2 font-medium">費用說明</p>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#717171]">轉單費（3%）</span>
                <span className="font-mono-nums text-[#222222]">NT${transferFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#717171]">bonus 點數</span>
                <span className="font-mono-nums text-[#6B21A8]">+{bonusPoints.toLocaleString()} 點</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#DDDDDD]">
                <span className="text-[#222222] font-bold">合計預扣</span>
                <span className="font-bold font-mono-nums text-[#FF385C]">{totalDeduct.toLocaleString()} 點</span>
              </div>
            </div>
          </div>

          {/* 帳戶餘額警告 */}
          <div className={`mb-4 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[12px] ${totalDeduct > driverBalance ? 'bg-[#FCEBEB] border border-[#E24B4A]/20 text-[#A32D2D]' : 'bg-[#E8F5E8] border border-[#008A05]/20 text-[#008A05]'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              {totalDeduct > driverBalance
                ? `帳戶餘額不足！需 ${totalDeduct.toLocaleString()} 點，目前 ${driverBalance.toLocaleString()} 點`
                : `帳戶餘額足夠（目前 ${driverBalance.toLocaleString()} 點，預扣後剩 ${(driverBalance - totalDeduct).toLocaleString()} 點）`
              }
            </span>
          </div>

          {/* bonus 點數輸入 */}
          <div className="mb-4">
            <label className="block text-[12px] text-[#717171] mb-1.5 font-medium">
              bonus 點數（吸引隊友接手，{MIN_BONUS_POINTS} 點起）
            </label>
            <input
              type="number"
              value={bonusPoints}
              onChange={e => {
                setBonusPoints(Math.max(0, parseInt(e.target.value) || 0))
                setError('')
              }}
              min={MIN_BONUS_POINTS}
              max={999999}
              className="w-full px-3 py-2.5 border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] font-mono-nums focus:outline-none focus:ring-2 focus:ring-[#0C447C]/30 focus:border-[#0C447C]"
            />
          </div>

          {/* 轉單原因 */}
          <div className="mb-4">
            <label className="block text-[12px] text-[#717171] mb-1.5 font-medium">
              轉單原因（選填）
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="例如：臨時有事、無法趕到、路線重疊..."
              rows={3}
              className="w-full px-3 py-2.5 border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#0C447C]/30 focus:border-[#0C447C] resize-none"
            />
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-[#FCEBEB] border border-[#E24B4A]/20 rounded-lg text-[12px] text-[#A32D2D]">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 按鈕 */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-white border border-[#DDDDDD] text-[#717171] text-[14px] font-bold rounded-lg hover:bg-[#F5F4F0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || totalDeduct > driverBalance}
              className="flex-1 py-2.5 px-4 bg-[#0C447C] text-white text-[14px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '發出中...' : '確認發出'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
