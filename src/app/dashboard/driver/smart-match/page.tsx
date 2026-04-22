'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ArrowLeft, CheckCircle, Sparkles, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { VEHICLE_LABELS } from '@/lib/vehicle'
import { TYPE_LABELS } from '@/lib/constants'
import type { VehicleType } from '@/lib/vehicle'

interface RecommendationItem {
  order: {
    id: string
    type: string
    scheduledTime: string
    pickupLocation: string
    dropoffLocation: string
    price: number
    status: string
    vehicleType?: string | null
  }
  intervalMinutes: number
  travelFromAnchor: number
  reason: string
  sortKey: number
}

interface AnchorOrder {
  id: string
  type: string
  scheduledTime: string
  pickupLocation: string
  dropoffLocation: string
  price: number
}

function SmartMatchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const anchorId = searchParams.get('anchorId')
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [anchor, setAnchor] = useState<AnchorOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async () => {
    if (!token || !anchorId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/driver/smart-match?anchorId=${anchorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setRecommendations(data.data.recommendations || [])
        setAnchor(data.data.anchor || null)
      } else {
        setError(data.error || '取得推薦失敗')
      }
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }, [token, anchorId])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  const handleAccept = async (orderId: string) => {
    if (!token) return
    setAcceptingId(orderId)
    setAcceptError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        alert('已接單')
        await fetchRecommendations()
      } else if (data.error?.includes('已被接走') || data.error?.includes('已被別人')) {
        setAcceptError('此單已被接走，重新整理推薦')
        await fetchRecommendations()
      } else {
        setAcceptError(data.error || '接單失敗')
      }
    } catch {
      setAcceptError('網路錯誤，請稍後再試')
    } finally {
      setAcceptingId(null)
    }
  }

  const intervalLabel = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0) return `${h}小時${m > 0 ? `${m}分` : ''}`
    return `${m}分鐘`
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* 錨點資訊 */}
      {anchor && (
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <div className="text-[12px] font-bold text-[#717171] uppercase tracking-wider mb-2">錨點行程</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-bold font-mono-nums">
                  {format(parseISO(anchor.scheduledTime), 'M/dd HH:mm', { locale: zhTW })}
                </span>
                <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${
                  anchor.type === 'pickup' || anchor.type === 'pickup_boat'
                    ? 'bg-[#E6F1FB] text-[#0C447C]'
                    : 'bg-[#FFF3E0] text-[#92400E]'
                }`}>
                  {TYPE_LABELS[anchor.type as keyof typeof TYPE_LABELS] ?? anchor.type}
                </span>
              </div>
              <div className="text-[13px] text-[#717171]">
                {anchor.pickupLocation} → {anchor.dropoffLocation}
              </div>
            </div>
            <span className="text-[18px] font-bold font-mono-nums text-[#FF385C]">
              NT${anchor.price}
            </span>
          </div>
        </div>
      )}

      {/* 說明 */}
      <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3">
        <p className="text-[13px] text-[#B45309]">
          <Sparkles className="w-4 h-4 inline mr-1" />
          根據時間間隔 1.5/2.5 小時與機場匹配規則篩選
        </p>
      </div>

      {/* 重新整理按鈕 */}
      <div className="flex justify-end">
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="flex items-center gap-1 text-[13px] text-[#717171] hover:text-[#222222] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重新整理
        </button>
      </div>

      {/* 錯誤提示 */}
      {acceptError && (
        <div className="bg-[#FCEBEB] border border-[#FCA5A5] rounded-xl p-3">
          <p className="text-[13px] text-[#E24B4A]">{acceptError}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {/* 空狀態 */}
      {!loading && recommendations.length === 0 && (
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#F4EFE9] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-[#D6D3D1]" />
          </div>
          <p className="text-[14px] text-[#78716C] font-medium mb-1">目前無適合配套單</p>
          <p className="text-[12px] text-[#A8A29E] mb-4">
            可以到接單大廳手動瀏覽其他訂單
          </p>
          <Button
            onClick={() => router.push('/dashboard/driver?tab=hall')}
            className="flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            前往接單大廳
          </Button>
        </div>
      )}

      {/* 推薦列表 */}
      {!loading && recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="text-[13px] text-[#717171] font-medium">
            推薦配套單（共 {recommendations.length} 張）
          </div>
          {recommendations.map((rec) => (
            <div key={rec.order.id} className="bg-white border border-[#DDDDDD] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold font-mono-nums">
                    {format(parseISO(rec.order.scheduledTime), 'M/dd HH:mm', { locale: zhTW })}
                  </span>
                  <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${
                    rec.order.type === 'pickup' || rec.order.type === 'pickup_boat'
                      ? 'bg-[#E6F1FB] text-[#0C447C]'
                      : 'bg-[#FFF3E0] text-[#92400E]'
                  }`}>
                    {TYPE_LABELS[rec.order.type as keyof typeof TYPE_LABELS] ?? rec.order.type}
                  </span>
                  {rec.order.vehicleType && (
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded bg-[#F4EFE9] text-[#717171]">
                      {VEHICLE_LABELS[rec.order.vehicleType as VehicleType] || rec.order.vehicleType}
                    </span>
                  )}
                </div>
                <span className="text-[18px] font-bold font-mono-nums text-[#FF385C]">
                  NT${rec.order.price}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[13px] text-[#717171] mb-2">
                <span className="font-medium text-[#222222]">{rec.order.pickupLocation}</span>
                <span className="text-[#DDDDDD]">→</span>
                <span className="font-medium text-[#222222]">{rec.order.dropoffLocation}</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] text-[#717171]">
                  間隔 <span className="font-bold font-mono-nums text-[#222222]">{intervalLabel(rec.intervalMinutes)}</span>
                </span>
                {rec.travelFromAnchor < 999 && (
                  <span className="text-[12px] text-[#717171]">
                    行車 <span className="font-bold font-mono-nums text-[#222222]">{rec.travelFromAnchor}</span> 分
                  </span>
                )}
              </div>

              {rec.reason && (
                <div className="mb-3 text-[12px] text-[#B45309] bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-3 py-2">
                  💡 {rec.reason}
                </div>
              )}

              <Button
                onClick={() => handleAccept(rec.order.id)}
                loading={acceptingId === rec.order.id}
                disabled={!!acceptingId}
                className="w-full"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                接單
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SmartMatchPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-white border-b border-[#DDDDDD] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-[#717171] hover:text-[#222222]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[20px] font-bold text-[#222222]">智慧排單推薦</h1>
        </div>
      </div>

      <Suspense fallback={
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      }>
        <SmartMatchContent />
      </Suspense>
    </div>
  )
}
