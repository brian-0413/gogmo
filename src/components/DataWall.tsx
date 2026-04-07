'use client'

import { useState, useEffect } from 'react'

interface LiveStats {
  onlineDrivers: number
  totalOrders: number
  dispatchedOrders: number
  registeredDrivers: number
  recentOrders: Array<{ time: string; route: string; price: string }>
}

export function DataWall() {
  const [stats, setStats] = useState<LiveStats>({
    onlineDrivers: 12,
    totalOrders: 47,
    dispatchedOrders: 31,
    registeredDrivers: 156,
    recentOrders: [
      { time: '14:32', route: '桃園機場 → 新北市', price: 'NT$800' },
      { time: '14:28', route: '松山機場 → 台北市', price: 'NT$600' },
      { time: '14:15', route: '桃園機場 → 台中市', price: 'NT$1,500' },
    ],
  })

  // 實作時替換為真實 SSE 串接
  useEffect(() => {
    // TODO: fetch('/api/drivers/events') SSE 串接
    // 目前顯示 mock data
  }, [])

  return (
    <div className="h-full flex flex-col justify-center px-8 py-12">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-[#FF385C] animate-pulse" />
        <span className="text-[11px] font-semibold text-[#A8A29E] uppercase tracking-widest">即時動態</span>
      </div>

      {/* 2x2 Data Grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        {/* 司機接單動態 */}
        <div className="bg-[#FFF3E0] border border-[#FFE0B2] rounded-4xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#717171] font-medium">司機接單動態</span>
            <div className="w-7 h-7 rounded-xl bg-[#FFF8EE] flex items-center justify-center text-[12px]">
              <span className="text-lg">🚗</span>
            </div>
          </div>
          <p className="text-[28px] font-extrabold text-[#FF385C] leading-none font-mono-nums">
            {stats.onlineDrivers}<span className="text-[12px] font-normal text-[#717171] ml-1">人在線</span>
          </p>
          <p className="text-[10px] text-[#F59E0B] mt-1">▲ 3 位剛上線</p>
        </div>

        {/* 所有訂單 */}
        <div className="bg-[#EEF4FF] border border-[#C2DBF5] rounded-4xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#717171] font-medium">所有訂單</span>
            <div className="w-7 h-7 rounded-xl bg-[#EEF4FF] border border-[#C2DBF5] flex items-center justify-center text-[12px]">
              📋
            </div>
          </div>
          <p className="text-[28px] font-extrabold text-[#222222] leading-none font-mono-nums">
            {stats.totalOrders}<span className="text-[12px] font-normal text-[#717171] ml-1">筆</span>
          </p>
          <p className="text-[10px] text-[#3B82F6] mt-1">+6 今日新上架</p>
        </div>

        {/* 已派出 */}
        <div className="bg-[#F0FFF4] border border-[#BBF7D0] rounded-4xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#717171] font-medium">已派出</span>
            <div className="w-7 h-7 rounded-xl bg-[#F0FFF4] border border-[#BBF7D0] flex items-center justify-center text-[12px]">
              ✓
            </div>
          </div>
          <p className="text-[28px] font-extrabold text-[#222222] leading-none font-mono-nums">
            {stats.dispatchedOrders}<span className="text-[12px] font-normal text-[#717171] ml-1">筆</span>
          </p>
          <p className="text-[10px] text-[#008A05] mt-1">完成率 66%</p>
        </div>

        {/* 註冊司機 */}
        <div className="bg-[#FAF0FF] border border-[#E9D5FF] rounded-4xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#717171] font-medium">註冊司機</span>
            <div className="w-7 h-7 rounded-xl bg-[#FAF0FF] border border-[#E9D5FF] flex items-center justify-center text-[12px]">
              👤
            </div>
          </div>
          <p className="text-[28px] font-extrabold text-[#222222] leading-none font-mono-nums">
            {stats.registeredDrivers}<span className="text-[12px] font-normal text-[#717171] ml-1">位</span>
          </p>
          <p className="text-[10px] text-[#A855F7] mt-1">+2 本週新加入</p>
        </div>
      </div>

      {/* Recent Feed */}
      <div className="mt-1">
        <p className="text-[10px] text-[#A8A29E] uppercase tracking-wider font-semibold mb-2">最新派出</p>
        <div className="divide-y divide-[#EBEBEB]">
          {stats.recentOrders.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-2">
              <span className="text-[10px] text-[#A8A29E] font-mono-nums min-w-[28px]">{item.time}</span>
              <span className="text-[12px] text-[#717171] font-medium flex-1 truncate">{item.route}</span>
              <span className="text-[12px] text-[#FF385C] font-bold font-mono-nums">{item.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
