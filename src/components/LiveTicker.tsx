'use client'

import { useState, useEffect } from 'react'

interface LiveTickerProps {
  todayCompleted: number
}

export function LiveTicker({ todayCompleted: initialCount }: LiveTickerProps) {
  const [count, setCount] = useState(initialCount)
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null)

  useEffect(() => {
    // Simulate increasing today completed orders
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setCount(prev => prev + 1)
        setNewOrderAlert('新增一筆成交')
        setTimeout(() => setNewOrderAlert(null), 2000)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ff8c42]/10 border border-[#ff8c42]/20">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8c42] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff8c42]"></span>
        </span>
        <span className="text-xs text-[#ff8c42] font-medium">
          {newOrderAlert || '即時訂單動態'}
        </span>
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-[#ff8c42]/20 to-transparent" />
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20">
        <span className="text-xs text-[#22c55e] font-medium">
          今日成交 <span className="font-bold">{count}</span> 單
        </span>
      </div>
    </div>
  )
}
