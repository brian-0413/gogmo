'use client'

import { useState, useEffect } from 'react'
import { UserCheck } from 'lucide-react'

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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
        </span>
        <span className="text-xs text-[#22c55e] uppercase tracking-wider">司機動態</span>
      </div>

      <div className="relative h-12 overflow-hidden">
        <div
          className={`transition-all duration-300 ${
            isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`font-mono text-lg font-bold ${
                isPickup ? 'text-[#3b82f6]' : 'text-[#22c55e]'
              }`}
            >
              {current.plate}
            </span>
            <span className="text-[#666]">{current.route}</span>
            <span className="text-[#ff8c42] font-bold">NT${current.price}</span>
          </div>
        </div>
      </div>

      {/* Carousel indicators */}
      <div className="flex items-center justify-center gap-1 mt-4">
        {driverActivities.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-4 bg-[#22c55e]' : 'w-1 bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
