'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { QROrderChat } from '@/components/book/QROrderChat'
import { Plane, HelpCircle, AlertCircle } from 'lucide-react'

interface PricingOption {
  vehicleType: string
  price: number
  enabled: boolean
}

interface DriverInfo {
  id: string
  licensePlate: string
  carType: string
  isPremium: boolean
  pricing: PricingOption[]
}

export default function DriverBookPage({ params }: { params: Promise<{ driverId: string }> }) {
  const [driverId, setDriverId] = useState<string>('')
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    params.then(p => setDriverId(p.driverId))
  }, [params])

  useEffect(() => {
    if (!driverId) return

    const fetchDriver = async () => {
      try {
        const res = await fetch(`/api/book/${driverId}`)
        const data = await res.json()
        if (data.success) {
          setDriverInfo(data.data)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchDriver()
  }, [driverId])

  const handleSubmit = async (formData: {
    orderType: string | null
    airport: string | null
    scheduledDate: string
    scheduledTime: string
    flightNumber: string
    vehicleType: string | null
    passengerCount: number | null
    luggageItems: Array<{ size: string; quantity: number }>
    pickupLocation: string
    dropoffLocation: string
    contactName: string
    contactPhone: string
    notes: string
  }) => {
    if (!driverId) return { success: false, error: '找不到司機' }

    const payload = {
      orderType: formData.orderType,
      airport: formData.airport || '',
      scheduledTime: `${formData.scheduledDate}T${formData.scheduledTime}:00.000Z`,
      flightNumber: formData.flightNumber,
      vehicleType: formData.vehicleType,
      passengerCount: formData.passengerCount || 1,
      luggage: formData.luggageItems,
      pickupLocation: formData.pickupLocation,
      dropoffLocation: formData.dropoffLocation,
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      notes: formData.notes,
    }

    const res = await fetch(`/api/book/${driverId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return data as { success: boolean; error?: string }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#E8A855] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[14px] text-[#717171]">載入中...</p>
        </div>
      </div>
    )
  }

  if (notFound || !driverInfo) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <main className="w-full max-w-sm mx-4 bg-white border border-[#DDDDDD] rounded-2xl p-8 text-center animate-reveal-up">
          <div className="w-16 h-16 rounded-2xl bg-[#F4EFE9] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-[#B0B0B0]" />
          </div>
          <h2 className="text-lg font-bold text-[#222222] mb-2">找不到司機</h2>
          <p className="text-[14px] text-[#717171]">
            這個連結已失效或司機不存在
          </p>
          <Link href="/" className="mt-6 inline-block text-[#FF385C] text-sm font-medium hover:text-[#D70466] transition-colors">
            返回首頁
          </Link>
        </main>
      </div>
    )
  }

  const hasPricing = driverInfo.pricing.some(p => p.enabled)

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Skip to content */}
      <a
        href="#booking-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#FF385C] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
      >
        跳到預訂表單
      </a>

      {/* Header */}
      <header className="bg-[#1C1917] px-5 py-6 text-center animate-reveal-up">
        <div className="text-[40px] font-black font-mono-nums text-[#E8A855] tracking-[4px] leading-none">
          {driverInfo.licensePlate}
        </div>
        <div className="text-[13px] text-[#888] mt-2 tracking-wider">
          專屬貴賓預訂頁面
        </div>
      </header>

      {/* Content */}
      <main id="booking-form" className="w-full mx-auto px-4 py-6 pb-12 md:max-w-[480px]">
        {!hasPricing ? (
          <div className="bg-white border border-[#DDDDDD] rounded-2xl p-8 text-center animate-reveal-up">
            <div className="w-16 h-16 rounded-2xl bg-[#F4EFE9] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-[#B0B0B0]" />
            </div>
            <h2 className="text-lg font-bold text-[#222222] mb-2">尚未開放預訂</h2>
            <p className="text-[14px] text-[#717171]">
              司機尚未設定服務項目，請稍後再試
            </p>
            <Link href="/" className="mt-6 inline-block text-[#FF385C] text-sm font-medium hover:text-[#D70466] transition-colors">
              返回首頁
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-[#DDDDDD] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-reveal-up delay-100">
            <QROrderChat
              driverId={driverInfo.id}
              licensePlate={driverInfo.licensePlate}
              pricing={driverInfo.pricing.filter(p => p.enabled)}
              onSubmit={handleSubmit}
            />
          </div>
        )}

        {/* Back link */}
        <div className="mt-4 text-center">
          <Link href="/" className="text-[11px] text-[#717171] hover:text-[#222222] transition-colors flex items-center justify-center gap-1">
            <Plane className="w-3 h-3" />
            返回 goGMO 首頁
          </Link>
        </div>
      </main>
    </div>
  )
}
