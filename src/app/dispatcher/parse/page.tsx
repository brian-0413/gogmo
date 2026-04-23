'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import type { VehicleType } from '@/lib/vehicle'

interface ParseResult {
  orders: ParsedOrderItem[]
  date: string
  vehicleType: string
  originalMessage: string
}

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

function generateOrderId(date: string, index: number): string {
  const datePart = date.replace(/-/g, '')
  const seq = String(index + 1).padStart(3, '0')
  return `GO-${datePart}-${seq}`
}

export default function DispatcherParsePage() {
  const router = useRouter()
  const { token } = useAuth()
  const [rawText, setRawText] = useState('')
  const [defaults, setDefaults] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    vehicle: 'SEDAN_5' as VehicleType,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lineCount = rawText.split('\n').filter(l => l.trim()).length
  const isOverLimit = lineCount > 20

  const handleParse = useCallback(async () => {
    if (!token || !rawText.trim()) return
    if (isOverLimit) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/orders/parse', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: rawText,
          defaults: {
            date: defaults.date,
            vehicle: defaults.vehicle,
            type: 'pickup',
          },
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || '解析失敗')
        return
      }

      const parsed = data.data

      const items: ParsedOrderItem[] = []

      let idx = 0
      for (const item of parsed.accepted || []) {
        const order = item.order
        items.push({
          orderId: generateOrderId(defaults.date, idx),
          time: order.time,
          type: order.type,
          pickup: order.pickupLocation,
          dropoff: order.dropoffLocation,
          price: order.price,
          rawText: order.rawText || order.notes || '',
          notes: order.notes || '',
          isConfirmed: false,
        })
        idx++
      }

      for (const item of parsed.needsReview || []) {
        const order = item.order
        items.push({
          orderId: generateOrderId(defaults.date, idx),
          time: order.time,
          type: order.type,
          pickup: order.pickupLocation,
          dropoff: order.dropoffLocation,
          price: order.price,
          rawText: order.rawText || order.notes || '',
          notes: order.notes || '',
          isConfirmed: false,
        })
        idx++
      }

      for (const item of parsed.rejected || []) {
        items.push({
          orderId: generateOrderId(defaults.date, idx),
          time: null,
          type: null,
          pickup: null,
          dropoff: null,
          price: null,
          rawText: item.rawText,
          notes: item.reason || '解析失敗',
          isConfirmed: false,
        })
        idx++
      }

      const result: ParseResult = {
        orders: items,
        date: defaults.date,
        vehicleType: defaults.vehicle,
        originalMessage: rawText,
      }

      sessionStorage.setItem('parseResult', JSON.stringify(result))
      router.push('/dispatcher/parse/review')
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }, [token, rawText, defaults, isOverLimit, router])

  const dateOptions = Array.from({ length: 15 }, (_, i) => {
    const d = addDays(new Date(), i)
    const label = i === 0 ? '（今天）' : i === 1 ? '（明天）' : format(d, '（EEE）', { locale: zhTW })
    return {
      value: format(d, 'yyyy-MM-dd'),
      label: `${format(d, 'yyyy/MM/dd')}${label}`,
    }
  })

  const vehicleOptions = [
    { value: 'SEDAN_5', label: '5 人座轎車' },
    { value: 'SUV_5', label: '5 人座休旅' },
    { value: 'MPV_7', label: '7 人座 MPV' },
    { value: 'VAN_9', label: '9 人座' },
    { value: 'CUSTOM', label: '自訂' },
  ]

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-white border-b border-[#DDDDDD] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-[#717171] hover:text-[#222222]">
              返回
            </button>
            <h1 className="text-[20px] font-bold text-[#222222]">智慧解析</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 說明卡 */}
        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4">
          <p className="text-[13px] text-[#B45309]">
            <Sparkles className="w-4 h-4 inline mr-1" />
            <strong>AI 解析提示：</strong>時間（24小時制）/ 種類 + 起迄點 / 金額。
            例如：<span className="font-mono">1600/桃機接板橋/1200元，或 1400/板橋送松機/1000元</span>
          </p>
        </div>

        {/* 日期選擇 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <label className="block text-[14px] font-bold text-[#222222] mb-2">
            日期
          </label>
          <select
            value={defaults.date}
            onChange={e => setDefaults(prev => ({ ...prev, date: e.target.value }))}
            className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
          >
            {dateOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 車型選擇 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4">
          <label className="block text-[14px] font-bold text-[#222222] mb-2">
            車型
          </label>
          <select
            value={defaults.vehicle}
            onChange={e => setDefaults(prev => ({ ...prev, vehicle: e.target.value as VehicleType }))}
            className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] focus:outline-none focus:border-[#222222]"
          >
            {vehicleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 訊息輸入 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DDDDDD] flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-[#222222]">訊息（{lineCount} 行）</h3>
              <p className="text-[12px] text-[#717171]">每行一張訂單，最多 20 單</p>
            </div>
            {isOverLimit && (
              <div className="flex items-center gap-1 text-[#E24B4A] text-[12px]">
                <AlertCircle className="w-4 h-4" />
                超過 20 單
              </div>
            )}
          </div>
          <div className="p-5">
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`為使 AI 能正確解析，請依以下建議格式張貼：

時間（24小時制）/ 種類 + 起迄點 / 金額
範例：1600/桃機接板橋/1200元，或 1400/板橋送松機/1000元

※ 每行為一張訂單，最多 20 單
※ 航班、聯絡人等詳細資料請於解析完成後點選編輯`}
              className="w-full h-48 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg px-4 py-3 text-[14px] font-mono-nums text-[#222222] focus:outline-none focus:border-[#222222] resize-none placeholder-[#B0B0B0]"
            />
          </div>
          <div className="px-5 py-4 border-t border-[#DDDDDD]">
            <Button
              onClick={handleParse}
              loading={loading}
              disabled={!rawText.trim() || isOverLimit}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI 解析
            </Button>
            {isOverLimit && (
              <p className="text-[12px] text-[#E24B4A] text-center mt-2">
                最多 20 單，請分批處理
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-[#FCEBEB] border border-[#FCA5A5] rounded-xl p-4">
            <p className="text-[14px] text-[#E24B4A]">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
