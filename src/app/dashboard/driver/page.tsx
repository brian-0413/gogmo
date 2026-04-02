'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { OrderCard, Order } from '@/components/driver/OrderCard'
import { OrderCalendar } from '@/components/driver/OrderCalendar'
import { format, parseISO, startOfDay, startOfWeek, isSameDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ClipboardList, FileText, Wallet, LogOut, Plane, Zap, TrendingUp, Radio, Inbox, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type Tab = 'available' | 'myorders' | 'balance'

export default function DriverDashboard() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('available')
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [balance, setBalance] = useState<{
    balance: number
    transactions: unknown[]
    totalEarnings: number
    totalPlatformFees: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [newOrderCount, setNewOrderCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [balanceStats, setBalanceStats] = useState<{
    today: number; thisWeek: number; allTime: number
    todayOrders: number; weekOrders: number; allOrders: number
  }>({ today: 0, thisWeek: 0, allTime: 0, todayOrders: 0, weekOrders: 0, allOrders: 0 })
  const [driverProfile, setDriverProfile] = useState<{
    licensePlate: string; carType: string; carColor: string
  } | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const calculateStats = useCallback((transactions: unknown[]) => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = startOfWeek(now, { locale: zhTW })
    let today = 0, thisWeek = 0, allTime = 0, todayOrders = 0, weekOrders = 0, allOrders = 0
    for (const tx of transactions as Array<{ type: string; amount: number; createdAt: string | Date }>) {
      if (tx.type !== 'RIDE_FARE') continue
      const createdAt = typeof tx.createdAt === 'string' ? parseISO(tx.createdAt) : tx.createdAt
      const netAmount = Math.floor(tx.amount * 0.95)
      allTime += netAmount; allOrders++
      if (createdAt >= todayStart) { today += netAmount; todayOrders++ }
      if (createdAt >= weekStart) { thisWeek += netAmount; weekOrders++ }
    }
    setBalanceStats({ today, thisWeek, allTime, todayOrders, weekOrders, allOrders })
  }, [])

  const filteredOrders = useMemo(() => {
    if (!selectedDate) return myOrders
    return myOrders.filter(order => {
      const d = typeof order.scheduledTime === 'string'
        ? new Date(order.scheduledTime)
        : order.scheduledTime
      return isSameDay(d, selectedDate)
    })
  }, [myOrders, selectedDate])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'DRIVER')) router.push('/login')
  }, [user, isLoading, router])

  useEffect(() => {
    if (!token) return
    const es = new EventSource('/api/drivers/events')
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'NEW_ORDER') {
          const order = data.order as Order
          setAvailableOrders((prev) => {
            if (prev.some((o) => o.id === order.id)) return prev
            return [order, ...prev]
          })
          setNewOrderCount((c) => c + 1)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('新訂單通知', { body: `新訂單：NT$${order.price} - ${order.pickupLocation} → ${order.dropoffLocation}`, tag: order.id })
          } else if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
            Notification.requestPermission()
          }
          if (activeTab === 'available') setTimeout(() => setNewOrderCount(0), 3000)
        } else if (data.type === 'ORDER_CANCELLED') {
          setAvailableOrders((prev) => prev.filter((o) => o.id !== data.orderId))
        }
      } catch {}
    }
    es.onerror = () => es.close()
    eventSourceRef.current = es
    return () => { es.close(); eventSourceRef.current = null }
  }, [token, activeTab])

  const fetchOrders = useCallback(async () => {
    if (!token) return
    try {
      const [availableRes, myRes] = await Promise.all([
        fetch('/api/orders?status=PUBLISHED', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/orders?myOrders=true', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const availableData = await availableRes.json()
      const myData = await myRes.json()
      if (availableData.success) setAvailableOrders(availableData.data.orders || [])
      if (myData.success) setMyOrders(myData.data.orders || [])
    } catch (error) { console.error('Failed to fetch orders:', error) }
    finally { setLoading(false) }
  }, [token])

  const fetchBalance = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/drivers/balance', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setBalance(data.data)
        if (data.data.transactions) calculateStats(data.data.transactions)
      }
    } catch (error) { console.error('Failed to fetch balance:', error) }
  }, [token, calculateStats])

  const fetchDriverProfile = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/drivers/me', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setDriverProfile(data.data)
    } catch (error) { console.error('Failed to fetch driver profile:', error) }
  }, [token])

  useEffect(() => {
    if (token) { fetchOrders(); fetchBalance(); fetchDriverProfile() }
  }, [token, fetchOrders, fetchBalance, fetchDriverProfile])

  const handleAcceptOrder = async (orderId: string) => {
    if (!token) return
    const order = availableOrders.find(o => o.id === orderId)
    if (!order) return
    setActionLoading(orderId)

    // 樂觀更新：立刻從大廳移除，加入我的行程
    setAvailableOrders(prev => prev.filter(o => o.id !== orderId))
    const acceptedOrder = { ...order, status: 'ACCEPTED' as const }
    setMyOrders(prev => [acceptedOrder, ...prev])

    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        // 接單成功，換到我的行程 tab
        setActiveTab('myorders')
        await fetchBalance()
      } else {
        // API 失敗，回滾樂觀更新
        setAvailableOrders(prev => [order, ...prev])
        setMyOrders(prev => prev.filter(o => o.id !== orderId))
        alert(data.error || '接單失敗')
      }
    } catch {
      // 網路錯誤，回滾樂觀更新
      setAvailableOrders(prev => [order, ...prev])
      setMyOrders(prev => prev.filter(o => o.id !== orderId))
      alert('網路錯誤，請稍後再試')
    } finally { setActionLoading(null) }
  }

  const handleStatusChange = async (orderId: string, status: string) => {
    if (!token) return
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'status', status }),
      })
      const data = await res.json()
      if (data.success) { await fetchOrders(); await fetchBalance() }
      else alert(data.error || '更新失敗')
    } catch { alert('網路錯誤') }
    finally { setActionLoading(null) }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[#78716C] text-sm">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917]">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 scan-lines" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-[#FAF8F5]/90 backdrop-blur-xl border-b border-[#E7E5E4] sticky top-0">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-[#F59E0B] flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-[#1C1917] font-bold tracking-tight text-lg">司機專區</span>
                <div className="flex items-center gap-3 text-[10px] text-[#78716C]">
                  <span className="font-mono-nums">{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                  <span className="font-mono-nums">{new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-6">
              {/* Balance */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white border border-[#DDDDDD] rounded-lg shadow-sm">
                <div className="text-right">
                  <p className="text-[10px] text-[#717171] uppercase tracking-wider">帳戶餘額</p>
                  <p className="text-lg font-bold text-[#FF385C] font-mono-nums">{user.driver?.balance ?? 0}</p>
                </div>
                <div className="w-px h-8 bg-[#DDDDDD]" />
                <div className="text-right">
                  <p className="text-[10px] text-[#717171] uppercase tracking-wider">今日成交</p>
                  <p className="text-lg font-bold text-[#008A05] font-mono-nums">{balanceStats.todayOrders}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-[#1C1917]">{user.name}</p>
                  <p className="text-xs text-[#78716C]">{driverProfile?.licensePlate || '未設定車牌'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="border-[#DDDDDD] text-[#717171] hover:border-[#FF385C]/30 hover:text-[#FF385C] hover:bg-[#FFF3E0]">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Live indicator bar */}
      <div className="relative z-10 bg-[#FAF8F5]/80 backdrop-blur-xl border-b border-[#E7E5E4]">
        <div className="max-w-7xl mx-auto px-6 py-2.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#22C55E]/5 border border-[#22C55E]/20">
              <Radio className="w-3 h-3 text-[#22C55E] animate-pulse" />
              <span className="text-xs text-[#22C55E] font-medium font-mono-nums">即時接收新訂單</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-[#E7E5E4] to-transparent" />
            <div className="flex items-center gap-4 text-xs text-[#78716C] font-mono-nums">
              <span>今日 <strong className="text-[#22C55E]">{balanceStats.todayOrders}</strong> 單</span>
              <span className="w-px h-3 bg-[#E7E5E4]" />
              <span>本週 <strong className="text-[#3B82F6]">{balanceStats.weekOrders}</strong> 單</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 bg-[#FAF8F5]/80 backdrop-blur-xl border-b border-[#E7E5E4] sticky top-[108px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            <button
              onClick={() => { setActiveTab('available'); setNewOrderCount(0) }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                activeTab === 'available'
                  ? 'border-[#F59E0B] text-[#F59E0B]'
                  : 'border-transparent text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F0]/50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              接單大廳
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                {availableOrders.length}
              </span>
              {newOrderCount > 0 && activeTab !== 'available' && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#EF4444] rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse text-white">
                  {newOrderCount}
                </span>
              )}
              {activeTab === 'available' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F59E0B]" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.4)' }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('myorders')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                activeTab === 'myorders'
                  ? 'border-[#F59E0B] text-[#F59E0B]'
                  : 'border-transparent text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F0]/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              我的行程
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums bg-[#F5F4F0] text-[#78716C] border border-[#DDDDDD]">
                {myOrders.length}
              </span>
              {activeTab === 'myorders' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F59E0B]" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.4)' }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('balance')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                activeTab === 'balance'
                  ? 'border-[#F59E0B] text-[#F59E0B]'
                  : 'border-transparent text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F0]/50'
              }`}
            >
              <Wallet className="w-4 h-4" />
              帳務中心
              {activeTab === 'balance' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F59E0B]" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.4)' }} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-6">

        {/* ===== AVAILABLE ORDERS ===== */}
        {activeTab === 'available' && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="text-center py-32 border border-[#DDDDDD] rounded-2xl bg-white/50 relative overflow-hidden shadow-sm">
                <div className="absolute inset-0 dot-matrix opacity-30" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#F5F4F0] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-8 h-8 text-[#D6D3D1]" />
                  </div>
                  <p className="text-[#78716C] mb-1 text-lg font-medium">目前沒有可接的訂單</p>
                  <p className="text-[#A8A29E] text-sm">系統會自動推送新訂單通知</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {availableOrders.map((order, index) => (
                  <div key={order.id} className="animate-cardEntry" style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}>
                    <OrderCard order={order} onAccept={handleAcceptOrder} showActions={true} isNew={true} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== MY ORDERS ===== */}
        {activeTab === 'myorders' && (
          <>
            {/* Calendar */}
            <OrderCalendar
              orders={myOrders}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {/* Filter header */}
            {selectedDate && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[#78716C]">
                    {format(selectedDate, 'M 月 d 日', { locale: zhTW })} 的行程
                  </span>
                  <span className="text-[12px] px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#B45309] font-medium">
                    {filteredOrders.length} 筆
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[12px] text-[#78716C] hover:text-[#222222] underline"
                >
                  清除篩選
                </button>
              </div>
            )}

            {/* Orders grid */}
            {filteredOrders.length === 0 ? (
              <div className="text-center py-20 border border-[#DDDDDD] rounded-2xl bg-white/50 relative overflow-hidden shadow-sm">
                <div className="absolute inset-0 dot-matrix opacity-30" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#F5F4F0] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#D6D3D1]" />
                  </div>
                  <p className="text-[#78716C] mb-1 text-lg font-medium">
                    {selectedDate ? '這天沒有行程' : '還沒有行程'}
                  </p>
                  <p className="text-[#A8A29E] text-sm">
                    {selectedDate ? '選擇其他日期試試' : '快去接單吧！'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredOrders.map(order => (
                  <OrderCard key={order.id} order={order} showActions={true} compact={true} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== BALANCE ===== */}
        {activeTab === 'balance' && balance && (
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
                <p className="text-3xl font-bold text-[#1C1917] font-mono-nums">{balanceStats.today.toLocaleString()}</p>
                <p className="text-xs text-[#78716C] mt-1 font-mono-nums">{balanceStats.todayOrders} 單</p>
                {/* Mini sparkline */}
                <div className="mt-4 flex items-end gap-0.5 h-8">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const dayStart = new Date(); dayStart.setDate(dayStart.getDate() - (6 - i))
                    const dayStartStr = startOfDay(dayStart)
                    let dayTotal = 0, dayCount = 0
                    for (const tx of (balance.transactions as Array<{ type: string; amount: number; createdAt: string | Date }>) || []) {
                      if (tx.type !== 'RIDE_FARE') continue
                      const createdAt = typeof tx.createdAt === 'string' ? parseISO(tx.createdAt) : tx.createdAt
                      if (startOfDay(createdAt).getTime() === dayStartStr.getTime()) { dayTotal += Math.floor(tx.amount * 0.95); dayCount++ }
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
                <p className="text-3xl font-bold text-[#1C1917] font-mono-nums">{balanceStats.thisWeek.toLocaleString()}</p>
                <p className="text-xs text-[#78716C] mt-1 font-mono-nums">{balanceStats.weekOrders} 單</p>
                {/* Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-[#78716C] mb-1">
                    <span>本週進度</span>
                    <span className="font-mono-nums">{balanceStats.thisWeek >= 5000 ? '已達標' : `${balanceStats.thisWeek}/5000`}</span>
                  </div>
                  <div className="h-1.5 bg-[#F5F4F0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${Math.min((balanceStats.thisWeek / 5000) * 100, 100)}%` }} />
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
                <p className="text-3xl font-bold text-[#1C1917] font-mono-nums">{balanceStats.allTime.toLocaleString()}</p>
                <p className="text-xs text-[#78716C] mt-1 font-mono-nums">{balanceStats.allOrders} 單</p>
                {/* Fee breakdown */}
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
                  {(balance.transactions as Array<{ status: string }>).filter(t => t.status === 'PENDING').length}
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
                  {(balance.transactions as Array<{ type: string }>).filter(t => t.type === 'RIDE_FARE').length}
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

            {/* Transactions */}
            <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[#DDDDDD]">
                <h3 className="text-sm font-semibold text-[#1C1917]">最近交易</h3>
              </div>
              <div className="p-5">
                {!balance.transactions || balance.transactions.length === 0 ? (
                  <p className="text-[#78716C] text-center py-8 text-sm">暫無交易記錄</p>
                ) : (
                  <div className="space-y-3">
                    {(balance.transactions as unknown[]).slice(0, 10).map((tx: unknown) => {
                      const transaction = tx as { id: string; amount: number; type: string; status: string; description?: string; createdAt: string | Date }
                      const displayAmount = transaction.type === 'RIDE_FARE' ? Math.floor(transaction.amount * 0.95) : transaction.amount
                      return (
                        <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-[#DDDDDD]/50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-[#1C1917]">{transaction.description || transaction.type}</p>
                            <p className="text-xs text-[#78716C] font-mono-nums">
                              {format(typeof transaction.createdAt === 'string' ? parseISO(transaction.createdAt) : transaction.createdAt, 'yyyy/MM/dd HH:mm')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold font-mono-nums ${displayAmount >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                              {displayAmount >= 0 ? '+' : ''}{displayAmount.toLocaleString()}
                            </p>
                            <Badge variant={transaction.status === 'PENDING' ? 'warning' : 'success'} className="text-[10px] mt-0.5">
                              {transaction.status === 'PENDING' ? '待結算' : '已結算'}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
