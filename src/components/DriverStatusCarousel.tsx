'use client'

import { useState, useEffect } from 'react'
import { Radio } from 'lucide-react'

const driverActivities = [
  { plate: 'REC-2391', route: '林口送機', price: 1200 },
  { plate: 'XYZ-5566', route: '桃機接新竹', price: 800 },
  { plate: 'AAA-1111', route: '北車送機', price: 1500 },
  { plate: 'DEF-8888', route: '竹北接機', price: 1100 },
  { plate: 'GHI-3333', route: '桃機送板橋', price: 900 },
  { plate: 'JKL-6666', route: '內湖送機', price: 1300 },
  { plate: 'MNO-9999', route: '桃機接中壢', price: 1000 },
  { plate: 'PQR-2222', route: '三重送機', price: 1400 },
]

export function DriverStatusCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % driverActivities.length)
        setIsTransitioning(false)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const current = driverActivities[currentIndex]
  const isPickup = current.route.includes('接')

  return (
    <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-[#E8F5E8] border border-[#C6E8C6] flex items-center justify-center">
          <Radio className="w-3.5 h-3.5 text-[#008A05]" />
        </div>
        <span className="text-[11px] text-[#717171]">司機動態</span>
      </div>

      <div className="relative h-10 overflow-hidden mb-3">
        <div
          className={`transition-all duration-300 ${
            isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-sm font-bold text-[#222222] border border-[#DDDDDD] bg-[#F4EFE9] rounded px-1.5 py-0.5"
            >
              {current.plate}
            </span>
            <span className="text-[13px] font-medium text-[#222222] truncate">{current.route}</span>
            <span className="text-[13px] font-bold text-[#FF385C] font-mono-nums ml-auto">NT${current.price}</span>
          </div>
        </div>
      </div>

      {/* Carousel indicators */}
      <div className="flex items-center gap-1">
        {driverActivities.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-4 bg-[#FF385C]' : 'w-1 bg-[#DDDDDD]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
