'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/driver/ProgressBar'
import { OrderDetailActions } from '@/components/driver/OrderDetailActions'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ArrowLeft, Phone, Clock, MapPin, User, Package } from 'lucide-react'
import { formatOrderNo } from '@/lib/utils'
import { TYPE_LABELS, TYPE_COLORS, VEHICLE_LABELS } from '@/lib/constants'
import type { Order, OrderType, VehicleType } from '@/types'

export default function OrderDetailPage() {
  const { user, token, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCompleteHint, setShowCompleteHint] = useState(false)

  const fetchOrder = useCallback(async () => {
    if (!token || !orderId) return
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setOrder(data.data)
      } else {
        alert(data.error || '載入失敗')
        router.back()
      }
    } catch {
      alert('網路錯誤')
      router.back()
    } finally {
      setLoading(false)
    }
  }, [token, orderId, router])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'DRIVER')) {
      router.push('/login')
    }
    if (token && orderId) fetchOrder()
  }, [isLoading, user, token, orderId, fetchOrder, router])

  const handleAction = async (action: 'start' | 'arrive' | 'pickup' | 'complete') => {
    if (!token || !order) return

    if (action === 'complete') {
      const confirmed = window.confirm('確認已抵達目的地？行程將標記為完成並計入帳務。')
      if (!confirmed) return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        setOrder(prev => prev ? { ...prev, ...data.data } : null)

        if (action === 'complete') {
          setShowCompleteHint(true)
          setTimeout(() => {
            setShowCompleteHint(false)
            router.push('/dashboard/driver?tab=myorders')
          }, 2000)
        }
      } else {
        alert(data.error || '操作失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!token || !order) return
    const cancelFee = Math.floor(order.price * 0.1)
    const confirmed = window.confirm(
      `確定要退單嗎？退單將扣除 NT$${order.price} 的 10%，共 ${cancelFee} 點`
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        alert(`退單成功`)
        router.push('/dashboard/driver?tab=myorders')
      } else {
        alert(data.error || '退單失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !order) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const scheduledDate = new Date(order.scheduledTime)
  const orderNo = formatOrderNo(scheduledDate, order.orderSeq)
  const typeColor = TYPE_COLORS[order.type as OrderType] ?? { bg: '#F4EFE9', text: '#717171' }
  const orderTypeLabel = TYPE_LABELS[order.type as OrderType] ?? order.type
  const isBoat = order.type === 'pickup_boat' || order.type === 'dropoff_boat'
  const isPickup = order.type === 'pickup'
  const pickupLabel = isBoat ? '出發港' : isPickup ? '桃園機場' : '上車'
  const dropoffLabel = isBoat ? '目的地港' : isPickup ? '目的地' : '桃園機場'

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#FAF7F2]/95 backdrop-blur-xl border-b border-[#E7E5E4]">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#717171] hover:text-[#222222] transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回</span>
          </button>
        </div>
      </div>

      {/* 完成提示 */}
      {showCompleteHint && (
        <div className="fixed top-0 left-0 right-0 bg-[#008A05] text-white text-center py-3 text-sm font-bold z-50">
          行程已完成，2 秒後返回列表
        </div>
      )}

      <main className="px-4 py-6 space-y-5">
        {/* 單號橫幅 */}
        <div className="w-full bg-[#1C1917] rounded-xl px-4 py-3">
          <span className="text-white text-[18px] font-bold font-mono-nums">
            #{orderNo}
          </span>
        </div>

        {/* 進度條 */}
        <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
          <ProgressBar status={order.status} size="md" showLabel={true} animateNext={true} />
        </div>

        {/* 行程資訊卡片 */}
        <div className="bg-white rounded-xl p-5 border border-[#DDDDDD] space-y-4">
          {/* 類型 + 狀態 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded"
              style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
            >
              {orderTypeLabel}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
              {VEHICLE_LABELS[order.vehicle as VehicleType] ?? '待確認'}
            </span>
            {order.kenichiRequired && (
              <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">
                肯驛
              </span>
            )}
          </div>

          {/* 時間 */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#717171]" />
            <span className="text-[15px] font-bold font-mono-nums text-[#222222]">
              {format(scheduledDate, 'M/dd (E)', { locale: zhTW })} {format(scheduledDate, 'HH:mm')}
            </span>
          </div>

          {/* 起訖點 */}
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: typeColor.bg === '#F4EFE9' ? '#FF385C' : typeColor.bg }} />
              <div>
                <p className="text-[11px] text-[#717171] uppercase tracking-wider">{pickupLabel}</p>
                <p className="text-[16px] font-bold text-[#222222]">{order.pickupLocation}</p>
              </div>
            </div>
            <span className="text-[20px] font-bold text-[#DDDDDD] mt-1 flex-shrink-0">→</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#DDDDDD] flex-shrink-0 mt-1" />
              <div>
                <p className="text-[11px] text-[#717171] uppercase tracking-wider">{dropoffLabel}</p>
                <p className="text-[16px] font-bold text-[#222222]">{order.dropoffLocation}</p>
              </div>
            </div>
          </div>

          {/* 金額 */}
          <div>
            <span className="text-[32px] font-bold font-mono-nums text-[#FF385C]">
              NT${order.price.toLocaleString()}
            </span>
          </div>

          {/* 乘客資訊 */}
          <div className="flex items-center gap-4 text-[13px] text-[#717171]">
            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {order.passengerName}</span>
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {order.passengerCount}人 / {order.luggageCount}行李</span>
          </div>

          {/* 電話 + 航班 */}
          <div className="flex items-center gap-4 text-[13px] text-[#717171]">
            <a
              href={`tel:${order.passengerPhone}`}
              className="flex items-center gap-1 text-[#0C447C] font-bold hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              {order.passengerPhone}
            </a>
            {order.flightNumber && (
              <span className="bg-[#F4EFE9] px-2 py-1 rounded font-mono-nums text-[13px] text-[#717171] font-bold">
                {order.flightNumber}
              </span>
            )}
          </div>

          {/* 備註 */}
          {order.note && (
            <div className="text-[13px] text-[#717171] bg-[#FFF3E0] border border-[#FFE0B2] p-2.5 rounded-lg">
              {order.note}
            </div>
          )}

          {/* 派單方 */}
          {order.dispatcher?.user?.name && (
            <div className="text-[12px] text-[#AAAAAA]">
              派單方：{order.dispatcher.user.name}
            </div>
          )}
        </div>

        {/* 按鈕列 */}
        <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
          <OrderDetailActions
            status={order.status}
            scheduledTime={order.scheduledTime}
            onAction={handleAction}
            onCancel={handleCancel}
            loading={actionLoading}
          />
        </div>
      </main>
    </div>
  )
}
