'use client'

import { useState, useEffect } from 'react'
import { QROrderChat } from '@/components/book/QROrderChat'

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

    // Transform QROrderChat form data to API request format
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
        <div className="text-center bg-white border border-[#DDDDDD] rounded-2xl p-8 max-w-sm mx-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F4EFE9] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-[#D6D3D1]">?</span>
          </div>
          <h2 className="text-lg font-bold text-[#222222] mb-2">找不到司機</h2>
          <p className="text-[14px] text-[#717171]">
            這個連結已失效或司機不存在
          </p>
        </div>
      </div>
    )
  }

  const hasPricing = driverInfo.pricing.some(p => p.enabled)

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-[#1C1917] px-5 py-6 text-center">
        <div className="text-[40px] font-black font-mono-nums text-[#E8A855] tracking-[4px] leading-none">
          {driverInfo.licensePlate}
        </div>
        <div className="text-[13px] text-[#888] mt-2 tracking-wider">
          專屬貴賓預訂頁面
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[480px] mx-auto px-4 py-6 pb-12">
        {!hasPricing ? (
          <div className="bg-white border border-[#DDDDDD] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F4EFE9] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-[#D6D3D1]">!</span>
            </div>
            <h2 className="text-lg font-bold text-[#222222] mb-2">尚未開放預訂</h2>
            <p className="text-[14px] text-[#717171]">
              司機尚未設定服務項目，請稍後再試
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#DDDDDD] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            <QROrderChat
              driverId={driverInfo.id}
              licensePlate={driverInfo.licensePlate}
              pricing={driverInfo.pricing.filter(p => p.enabled)}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>
    </div>
  )
}
