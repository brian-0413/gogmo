'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { CheckCircle, AlertTriangle, XCircle, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { VEHICLE_LABELS } from '@/lib/vehicle'
import type { VehicleType } from '@/lib/vehicle'

interface ParsedOrderItem {
  orderId: string
  time: string | null
  type: string | null
  pickup: string | null
  dropoff: string | null
  price: number | null
  rawText: string
  notes: string
  isConfirmed: boolean
}

interface ParseResult {
  orders: ParsedOrderItem[]
  date: string
  vehicleType: string
  originalMessage: string
}

const TYPE_LABELS: Record<string, string> = {
  pickup: '接機',
  dropoff: '送機',
  airport_pickup: '接機',
  airport_dropoff: '送機',
  port_pickup: '接船',
  port_dropoff: '送船',
  charter: '包機',
  transfer: '交通趟',
  pending: '待確認',
}

export default function ParseReviewPage() {
  const router = useRouter()
  const { token } = useAuth()
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('parseResult')
    if (!stored) {
      router.replace('/dispatcher/parse')
      return
    }
    setParseResult(JSON.parse(stored))
  }, [router])

  const saveToStorage = useCallback((result: ParseResult) => {
    sessionStorage.setItem('parseResult', JSON.stringify(result))
  }, [])

  const toggleConfirm = useCallback((index: number) => {
    setParseResult(prev => {
      if (!prev) return prev
      const orders = [...prev.orders]
      orders[index] = { ...orders[index], isConfirmed: !orders[index].isConfirmed }
      const updated = { ...prev, orders }
      saveToStorage(updated)
      return updated
    })
  }, [saveToStorage])

  const confirmedCount = parseResult?.orders.filter(o => o.isConfirmed).length ?? 0
  const totalCount = parseResult?.orders.length ?? 0
  const allConfirmed = confirmedCount === totalCount && totalCount > 0

  const handlePublishAll = async () => {
    if (!token || !parseResult) return
    setPublishing(true)

    try {
      const ordersToPublish = parseResult.orders
        .filter(o => o.isConfirmed)
        .map(o => ({
          passengerName: '待確認',
          passengerPhone: '待確認',
          scheduledTime: `${parseResult.date}T${o.time || '12:00'}:00+08:00`,
          price: o.price || 0,
          type: o.type || 'pending',
          vehicleType: parseResult.vehicleType,
          pickupLocation: (o as any).pickupAddresses?.[0] || o.pickup || '待確認',
          pickupAddress: (o as any).pickupAddresses?.[0] || o.pickup || '待確認',
          dropoffLocation: (o as any).dropoffAddresses?.[0] || o.dropoff || '待確認',
          dropoffAddress: (o as any).dropoffAddresses?.[0] || o.dropoff || '待確認',
          note: o.notes,
          originalMessage: parseResult.originalMessage,
          parsedByAI: true,
          flightNumber: (o as any).flightNumber || '',
          passengerCount: (o as any).passengerCount || 1,
          luggageCount: (o as any).luggageCount || 0,
        }))

      const res = await fetch('/api/orders/publish-batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders: ordersToPublish }),
      })

      const data = await res.json()

      if (data.success) {
        sessionStorage.removeItem('parseResult')
        alert(`已發布 ${data.data.count} 張訂單到接單大廳`)
        router.push('/dashboard/dispatcher')
      } else {
        alert(data.error || '發布失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setPublishing(false)
    }
  }

  const handleReParse = () => {
    router.replace('/dispatcher/parse')
  }

  const handleCancel = () => {
    if (window.confirm('確定要捨棄所有解析結果？')) {
      sessionStorage.removeItem('parseResult')
      router.push('/dashboard/dispatcher')
    }
  }

  if (!parseResult) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-white border-b border-[#DDDDDD] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-[#222222]">解析結果</h1>
            <p className="text-[13px] text-[#717171]">共 {totalCount} 單｜已確認 {confirmedCount}</p>
          </div>
          <button
            onClick={handleReParse}
            className="text-[14px] text-[#717171] hover:text-[#222222]"
          >
            重新解析
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {parseResult.orders.map((order, index) => {
          const hasRequired = order.time && order.pickup && order.dropoff && order.price !== null
          const status = order.isConfirmed
            ? 'confirmed'
            : hasRequired
              ? 'needs-edit'
              : 'pending'

          return (
            <div
              key={index}
              className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                order.isConfirmed
                  ? 'border-[#22C55E]'
                  : status === 'needs-edit'
                    ? 'border-[#F59E0B]'
                    : 'border-[#DDDDDD]'
              }`}
            >
              {/* 狀態 bar */}
              <div className={`px-4 py-2 flex items-center gap-2 text-[12px] font-bold ${
                status === 'confirmed'
                  ? 'bg-[#E8F5E8] text-[#008A05]'
                  : status === 'needs-edit'
                    ? 'bg-[#FFF7ED] text-[#B45309]'
                    : 'bg-[#F4EFE9] text-[#717171]'
              }`}>
                {status === 'confirmed' && <CheckCircle className="w-3.5 h-3.5" />}
                {status === 'needs-edit' && <AlertTriangle className="w-3.5 h-3.5" />}
                {status === 'pending' && <XCircle className="w-3.5 h-3.5" />}
                <span className="mr-auto">#{index + 1}</span>
                <span>
                  {status === 'confirmed' && '已確認'}
                  {status === 'needs-edit' && '需編輯'}
                  {status === 'pending' && '未確認'}
                </span>
              </div>

              {/* 內容 */}
              <div className="p-4">
                {/* 第一行：種類標籤 + 車型 + 單號 + 金額 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] font-bold px-2 py-1 rounded ${
                      order.type === 'pickup' || order.type === 'airport_pickup'
                        ? 'bg-[#E6F1FB] text-[#0C447C]'
                        : order.type === 'dropoff' || order.type === 'airport_dropoff'
                          ? 'bg-[#FFF3E0] text-[#92400E]'
                          : 'bg-[#F4EFE9] text-[#717171]'
                    }`}>
                      {TYPE_LABELS[order.type || ''] || order.type || '—'}
                    </span>
                    <span className="text-[12px] font-bold px-2 py-1 rounded bg-[#F4EFE9] text-[#717171]">
                      {VEHICLE_LABELS[(parseResult.vehicleType || 'SEDAN_5') as VehicleType]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#717171] font-mono-nums">
                      {order.orderId}
                    </span>
                    <span className="text-[18px] font-bold font-mono-nums text-[#FF385C]">
                      NT${order.price ?? '—'}
                    </span>
                  </div>
                </div>

                {/* 第二行：時間 + 起訖 */}
                <div className="grid grid-cols-2 gap-3 text-[13px] mb-3">
                  <div>
                    <span className="text-[#717171]">時間：</span>
                    <span className="font-bold text-[#222222] font-mono-nums">{order.time || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#717171]">起點：</span>
                    <span className="text-[#222222]">{order.pickup || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#717171]">終點：</span>
                    <span className="text-[#222222]">{order.dropoff || '—'}</span>
                  </div>
                </div>

                {/* 原始訊息（只顯示一處） */}
                {order.rawText && (
                  <div className="mb-3">
                    <span className="text-[11px] text-[#717171]">原始訊息：</span>
                    <div className="text-[12px] text-[#717171] mt-0.5">{order.rawText}</div>
                  </div>
                )}

                {/* 按鈕列：編輯 + 確認 */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dispatcher/parse/review/${index}`)}
                    className="flex-1"
                  >
                    編輯
                  </Button>
                  {!order.isConfirmed ? (
                    <Button
                      size="sm"
                      onClick={() => toggleConfirm(index)}
                      disabled={!hasRequired}
                      className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      確認
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleConfirm(index)}
                      className="flex-1 border-[#22C55E] text-[#22C55E]"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      已確認
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 底部操作列 */}
      <div className="bg-white border-t border-[#DDDDDD] sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
          >
            取消
          </Button>
          <Button
            onClick={handlePublishAll}
            loading={publishing}
            disabled={!allConfirmed}
            className={`flex-1 ${allConfirmed ? 'bg-[#FF385C] hover:bg-[#E83355]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            {allConfirmed
              ? `發布 ${totalCount} 筆訂單`
              : `發布（${confirmedCount}/${totalCount} 已確認）`
            }
          </Button>
        </div>
        {!allConfirmed && (
          <p className="text-[12px] text-center text-[#717171] pb-3">
            必須全部確認才能發布
          </p>
        )}
      </div>
    </div>
  )
}
