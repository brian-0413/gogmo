'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, TrendingUp, Clock, ClipboardList, ChevronRight, ChevronDown, Zap } from 'lucide-react'
import { format, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Badge } from '@/components/ui/Badge'
import { DRIVER_EARNINGS_RATE, WEEKLY_SETTLEMENT_TARGET } from '@/lib/constants'

interface CompletedOrder {
  id: string
  completedAt: string
  pickupLocation: string
  dropoffLocation: string
  price: number
  dispatcher?: { companyName: string }
  transferStatus: string
}

export interface BalanceData {
  balance: number
  transactions: Array<{
    id: string
    amount: number
    type: string
    status: string
    description?: string
    createdAt: string | Date
  }>
  totalEarnings: number
  totalPlatformFees: number
}

interface SettlementTabProps {
  token: string | null
  balance: BalanceData | null
  balanceStats: {
    today: number; thisWeek: number; allTime: number
    todayOrders: number; weekOrders: number; allOrders: number
  }
}

export function SettlementTab({ token, balance, balanceStats }: SettlementTabProps) {
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([])
  const [completedLoading, setCompletedLoading] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [balanceTab, setBalanceTab] = useState<'points' | 'trips'>('points')

  const fetchCompletedOrders = useCallback(async () => {
    if (!token) return
    setCompletedLoading(true)
    try {
      const res = await fetch('/api/drivers/completed-orders', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setCompletedOrders(data.data.orders || [])
    } finally {
      setCompletedLoading(false)
    }
  }, [token])

  // SSE for TRANSFER_STATUS_CHANGE
  useEffect(() => {
    if (!token) return
    const es = new EventSource('/api/drivers/events')
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'TRANSFER_STATUS_CHANGE') {
          setCompletedOrders(prev => {
            const exists = prev.find(o => o.id === data.orderId)
            if (!exists) fetchCompletedOrders()
            return prev.map(order =>
              order.id === data.orderId
                ? { ...order, transferStatus: data.transferStatus }
                : order
            )
          })
        }
      } catch {}
    }
    es.onerror = () => es.close()
    return () => { es.close() }
  }, [token, fetchCompletedOrders])

  if (!balance) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Earnings cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Today */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#22C55E]/50 to-transparent" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-[10px] text-[#22C55E] uppercase tracking-widest font-medium">今日收益</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-mono-nums">{balanceStats.today.toLocaleString()}</p>
          <p className="text-xs text-[#78716C] mt-1 font-mono-nums">{balanceStats.todayOrders} 單</p>
          {/* Mini sparkline */}
          <div className="mt-4 flex items-end gap-0.5 h-8">
            {Array.from({ length: 7 }).map((_, i) => {
              const dayStart = new Date(); dayStart.setDate(dayStart.getDate() - (6 - i))
              const dayStartStr = startOfDay(dayStart)
              let dayTotal = 0
              for (const tx of balance.transactions) {
                if (tx.type !== 'RIDE_FARE') continue
                const createdAt = typeof tx.createdAt === 'string' ? parseISO(tx.createdAt) : tx.createdAt
                if (startOfDay(createdAt).getTime() === dayStartStr.getTime()) { dayTotal += Math.floor(tx.amount * DRIVER_EARNINGS_RATE) }
              }
              const maxH = Math.max(balanceStats.today, 1)
              const barH = balanceStats.todayOrders > 0 ? Math.max((dayTotal / maxH) * 32, 2) : 2
              const isToday = i === 6
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className={`w-full rounded-sm transition-all ${isToday ? 'bg-[#22C55E]' : 'bg-[#22C55E]/25'}`} style={{ height: `${barH}px` }} />
                  <span className="text-[8px] text-[#A8A29E] font-mono-nums">{'日一二三四五六'[dayStart.getDay()]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3B82F6]/50 to-transparent" />
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="text-[10px] text-[#3B82F6] uppercase tracking-widest font-medium">本週收益</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-mono-nums">{balanceStats.thisWeek.toLocaleString()}</p>
          <p className="text-xs text-[#78716C] mt-1 font-mono-nums">{balanceStats.weekOrders} 單</p>
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-[#78716C] mb-1">
              <span>本週進度</span>
              <span className="font-mono-nums">{balanceStats.thisWeek >= WEEKLY_SETTLEMENT_TARGET ? '已達標' : `${balanceStats.thisWeek}/WEEKLY_SETTLEMENT_TARGET`}</span>
            </div>
            <div className="h-1.5 bg-[#F5F4F0] rounded-full overflow-hidden">
              <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${Math.min((balanceStats.thisWeek / WEEKLY_SETTLEMENT_TARGET) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* All Time */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#A855F7]/50 to-transparent" />
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-[#A855F7]" />
            <span className="text-[10px] text-[#A855F7] uppercase tracking-widest font-medium">累積收益</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-mono-nums">{balanceStats.allTime.toLocaleString()}</p>
          <p className="text-xs text-[#78716C] mt-1 font-mono-nums">{balanceStats.allOrders} 單</p>
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-[#78716C]">平台費 (5%)</span>
              <span className="text-[#EF4444] font-mono-nums">-{balance.totalPlatformFees?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-[#78716C]">總收入</span>
              <span className="text-[#1C1917] font-mono-nums">{(balanceStats.allTime + (balance.totalPlatformFees || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 帳戶餘額 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#FFF3E0] border border-[#FFE0B2] flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-[#B45309]" />
            </div>
            <span className="text-[10px] text-[#717171] font-normal">帳戶餘額</span>
          </div>
          <p className="text-2xl font-bold text-[#222222] font-mono-nums">{balance.balance.toLocaleString()}</p>
          <p className="text-[11px] text-[#B0B0B0] mt-0.5">點</p>
        </div>
        {/* 待結算 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#FFF3E0] border border-[#FFE0B2] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-[#B45309]" />
            </div>
            <span className="text-[10px] text-[#717171] font-normal">待結算</span>
          </div>
          <p className="text-2xl font-bold text-[#222222] font-mono-nums">
            {balance.transactions.filter(t => t.status === 'PENDING').length}
          </p>
          <p className="text-[11px] text-[#B0B0B0] mt-0.5">筆</p>
        </div>
        {/* 總行程 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#E6F1FB] border border-[#C2DBF5] flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-[#0C447C]" />
            </div>
            <span className="text-[10px] text-[#717171] font-normal">總行程</span>
          </div>
          <p className="text-2xl font-bold text-[#222222] font-mono-nums">
            {balance.transactions.filter(t => t.type === 'RIDE_FARE').length}
          </p>
          <p className="text-[11px] text-[#B0B0B0] mt-0.5">單</p>
        </div>
        {/* 平台費率 */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#F3E8FF] border border-[#E9D5FF] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-[#6B21A8]" />
            </div>
            <span className="text-[10px] text-[#717171] font-normal">平台費率</span>
          </div>
          <p className="text-2xl font-bold text-[#222222] font-mono-nums">5%</p>
          <p className="text-[11px] text-[#B0B0B0] mt-0.5">每單</p>
        </div>
      </div>

      {/* 帳務記錄 Tab */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden shadow-sm">
        <div className="flex gap-1 p-1 bg-[#F4EFE9] border-b border-[#DDDDDD]">
          <button
            onClick={() => setBalanceTab('points')}
            className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg transition-all ${
              balanceTab === 'points'
                ? 'bg-white text-[#FF385C] shadow-sm border border-[#DDDDDD]'
                : 'text-[#717171] hover:text-[#222222]'
            }`}
          >
            點數記錄
          </button>
          <button
            onClick={() => setBalanceTab('trips')}
            className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg transition-all ${
              balanceTab === 'trips'
                ? 'bg-white text-[#FF385C] shadow-sm border border-[#DDDDDD]'
                : 'text-[#717171] hover:text-[#222222]'
            }`}
          >
            行程記錄
          </button>
        </div>

        {balanceTab === 'points' && (
          <div className="p-5">
            {!balance.transactions || balance.transactions.length === 0 ? (
              <p className="text-[#78716C] text-center py-8 text-sm">暫無交易記錄</p>
            ) : (
              <div className="space-y-3">
                {balance.transactions.slice(0, 20).map((tx) => {
                  const displayAmount = tx.type === 'RIDE_FARE' ? Math.floor(tx.amount * DRIVER_EARNINGS_RATE) : tx.amount
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-3 border-b border-[#DDDDDD]/50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-[#1C1917]">{tx.description || tx.type}</p>
                        <p className="text-xs text-[#78716C] font-mono-nums">
                          {format(typeof tx.createdAt === 'string' ? parseISO(tx.createdAt) : tx.createdAt, 'yyyy/MM/dd HH:mm')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold font-mono-nums ${displayAmount >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {displayAmount >= 0 ? '+' : ''}{displayAmount.toLocaleString()}
                        </p>
                        <Badge variant={tx.status === 'PENDING' ? 'warning' : 'success'} className="text-[10px] mt-0.5">
                          {tx.status === 'PENDING' ? '待結算' : '已結算'}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {balanceTab === 'trips' && (
          completedOrders.length === 0 ? (
            <div className="text-center py-8">
              {completedLoading ? (
                <p className="text-[#717171] text-sm">載入中...</p>
              ) : (
                <p className="text-[#717171] text-sm">尚無已完成行程</p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-t border-[#DDDDDD]">
                  <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">日期</th>
                  <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">起訖點</th>
                  <th className="text-right text-[11px] text-[#717171] py-3 px-4 font-normal">金額</th>
                  <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">派單人</th>
                  <th className="text-center text-[11px] text-[#717171] py-3 px-4 font-normal">轉帳情形</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.map(order => {
                  const completedAtStr = order.completedAt
                    ? format(typeof order.completedAt === 'string' ? parseISO(order.completedAt) : new Date(order.completedAt), 'MM/dd HH:mm')
                    : '-'
                  return (
                    <tr key={order.id} className="border-t border-[#DDDDDD]">
                      <td className="py-3 px-4 text-[12px] text-[#717171] font-mono-nums">{completedAtStr}</td>
                      <td className="py-3 px-4 text-[12px] text-[#1C1917]">
                        <div className="max-w-[160px]">
                          <p className="truncate">{order.pickupLocation}</p>
                          <p className="text-[10px] text-[#A8A29E]">→ {order.dropoffLocation}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-[12px] font-bold text-[#222222] font-mono-nums">
                        NT${order.price.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-[12px] text-[#717171]">
                        {order.dispatcher?.companyName || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {order.transferStatus === 'COMPLETED' ? (
                          <span className="text-[11px] text-[#22C55E] font-medium">已轉帳</span>
                        ) : order.transferStatus === 'PENDING_SQUAD' ? (
                          <span className="text-[11px] text-[#F59E0B] font-medium">處理中</span>
                        ) : (
                          <span className="text-[11px] text-[#A8A29E]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
