'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { OrderCard, Order } from '@/components/driver/OrderCard'
import { format, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ClipboardList, FileText, Wallet, LogOut, Plane, Zap, TrendingUp, Radio, Inbox } from 'lucide-react'
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
        fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
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
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) { await fetchOrders(); await fetchBalance() }
      else alert(data.error || '接單失敗')
    } catch { alert('網路錯誤，請稍後再試') }
    finally { setActionLoading(null) }
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
      <div className="min-h-screen bg-[#060608] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#ff6b2b] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[#6b6560] text-sm">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060608] text-[#f0ebe3]">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 scan-lines" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-[#060608]/90 backdrop-blur-xl border-b border-[#1e1e26] sticky top-0">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-[#3b82f6] flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                <Plane className="w-4 h-4 text-[#060608]" />
              </div>
              <div>
                <span className="text-[#f0ebe3] font-bold tracking-tight text-lg">司機專區</span>
                <div className="flex items-center gap-3 text-[10px] text-[#6b6560]">
                  <span className="font-mono-nums">{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                  <span className="font-mono-nums">{new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-6">
              {/* Balance */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-[#0c0c10] border border-[#1e1e26] rounded-lg">
                <div className="text-right">
                  <p className="text-[10px] text-[#6b6560] uppercase tracking-wider">帳戶餘額</p>
                  <p className="text-lg font-bold text-[#ff6b2b] font-mono-nums">{user.driver?.balance ?? 0}</p>
                </div>
                <div className="w-px h-8 bg-[#1e1e26]" />
                <div className="text-right">
                  <p className="text-[10px] text-[#6b6560] uppercase tracking-wider">今日成交</p>
                  <p className="text-lg font-bold text-[#22c55e] font-mono-nums">{balanceStats.todayOrders}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-[#6b6560]">{driverProfile?.licensePlate || '未設定車牌'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] hover:bg-[#ff6b2b]/5">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Live indicator bar */}
      <div className="relative z-10 bg-[#060608]/80 backdrop-blur-xl border-b border-[#1e1e26]">
        <div className="max-w-7xl mx-auto px-6 py-2.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#22c55e]/5 border border-[#22c55e]/15">
              <Radio className="w-3 h-3 text-[#22c55e] animate-pulse" />
              <span className="text-xs text-[#22c55e] font-medium font-mono-nums">即時接收新訂單</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-[#1e1e26] to-transparent" />
            <div className="flex items-center gap-4 text-xs text-[#6b6560] font-mono-nums">
              <span>今日 <strong className="text-[#22c55e]">{balanceStats.todayOrders}</strong> 單</span>
              <span className="w-px h-3 bg-[#1e1e26]" />
              <span>本週 <strong className="text-[#3b82f6]">{balanceStats.weekOrders}</strong> 單</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 bg-[#060608]/80 backdrop-blur-xl border-b border-[#1e1e26] sticky top-[108px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            <button
              onClick={() => { setActiveTab('available'); setNewOrderCount(0) }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                activeTab === 'available'
                  ? 'border-[#3b82f6] text-[#3b82f6]'
                  : 'border-transparent text-[#6b6560] hover:text-[#f0ebe3] hover:bg-[#141418]/50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              可接訂單
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/20">
                {availableOrders.length}
              </span>
              {newOrderCount > 0 && activeTab !== 'available' && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#ef4444] rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse text-white">
                  {newOrderCount}
                </span>
              )}
              {activeTab === 'available' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6]" style={{ boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('myorders')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                activeTab === 'myorders'
                  ? 'border-[#3b82f6] text-[#3b82f6]'
                  : 'border-transparent text-[#6b6560] hover:text-[#f0ebe3] hover:bg-[#141418]/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              我的行程
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums bg-[#141418] text-[#6b6560] border border-[#1e1e26]">
                {myOrders.length}
              </span>
              {activeTab === 'myorders' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6]" style={{ boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('balance')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                activeTab === 'balance'
                  ? 'border-[#3b82f6] text-[#3b82f6]'
                  : 'border-transparent text-[#6b6560] hover:text-[#f0ebe3] hover:bg-[#141418]/50'
              }`}
            >
              <Wallet className="w-4 h-4" />
              帳務中心
              {activeTab === 'balance' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6]" style={{ boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
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
                <div className="w-10 h-10 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="text-center py-32 border border-[#1e1e26] rounded-2xl bg-[#0c0c10]/50 relative overflow-hidden">
                <div className="absolute inset-0 dot-matrix opacity-30" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#141418] border border-[#1e1e26] flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-8 h-8 text-[#3a3a40]" />
                  </div>
                  <p className="text-[#6b6560] mb-1 text-lg font-medium">目前沒有可接的訂單</p>
                  <p className="text-[#3a3a40] text-sm">系統會自動推送新訂單通知</p>
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
            {myOrders.length === 0 ? (
              <div className="text-center py-32 border border-[#1e1e26] rounded-2xl bg-[#0c0c10]/50 relative overflow-hidden">
                <div className="absolute inset-0 dot-matrix opacity-30" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#141418] border border-[#1e1e26] flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#3a3a40]" />
                  </div>
                  <p className="text-[#6b6560] mb-1 text-lg font-medium">還沒有行程</p>
                  <p className="text-[#3a3a40] text-sm">快去接單吧！</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {myOrders.map(order => (
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
              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#22c55e]/50 to-transparent" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  <span className="text-[10px] text-[#22c55e] uppercase tracking-widest font-medium">今日收益</span>
                </div>
                <p className="text-3xl font-bold text-[#f0ebe3] font-mono-nums">{balanceStats.today.toLocaleString()}</p>
                <p className="text-xs text-[#6b6560] mt-1 font-mono-nums">{balanceStats.todayOrders} 單</p>
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
                        <div className={`w-full rounded-sm transition-all ${isToday ? 'bg-[#22c55e]' : 'bg-[#22c55e]/25'}`} style={{ height: `${barH}px` }} />
                        <span className="text-[8px] text-[#3a3a40] font-mono-nums">{'日一二三四五六'[dayStart.getDay()]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* This Week */}
              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3b82f6]/50 to-transparent" />
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span className="text-[10px] text-[#3b82f6] uppercase tracking-widest font-medium">本週收益</span>
                </div>
                <p className="text-3xl font-bold text-[#f0ebe3] font-mono-nums">{balanceStats.thisWeek.toLocaleString()}</p>
                <p className="text-xs text-[#6b6560] mt-1 font-mono-nums">{balanceStats.weekOrders} 單</p>
                {/* Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-[#6b6560] mb-1">
                    <span>本週進度</span>
                    <span className="font-mono-nums">{balanceStats.thisWeek >= 5000 ? '已達標' : `${balanceStats.thisWeek}/5000`}</span>
                  </div>
                  <div className="h-1.5 bg-[#141418] rounded-full overflow-hidden">
                    <div className="h-full bg-[#3b82f6] rounded-full transition-all" style={{ width: `${Math.min((balanceStats.thisWeek / 5000) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* All Time */}
              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#a855f7]/50 to-transparent" />
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-[#a855f7]" />
                  <span className="text-[10px] text-[#a855f7] uppercase tracking-widest font-medium">累積收益</span>
                </div>
                <p className="text-3xl font-bold text-[#f0ebe3] font-mono-nums">{balanceStats.allTime.toLocaleString()}</p>
                <p className="text-xs text-[#6b6560] mt-1 font-mono-nums">{balanceStats.allOrders} 單</p>
                {/* Fee breakdown */}
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#6b6560]">平台費 (5%)</span>
                    <span className="text-[#ef4444] font-mono-nums">-{balance.totalPlatformFees?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#6b6560]">總收入</span>
                    <span className="text-[#f0ebe3] font-mono-nums">{(balanceStats.allTime + (balance.totalPlatformFees || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-3.5 h-3.5 text-[#ff6b2b]" />
                  <span className="text-[10px] text-[#ff6b2b] uppercase tracking-widest">帳戶餘額</span>
                </div>
                <p className="text-2xl font-bold text-[#f0ebe3] font-mono-nums">{balance.balance.toLocaleString()}</p>
                <p className="text-xs text-[#6b6560] mt-0.5">點</p>
              </div>
              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-[10px] text-[#f59e0b] uppercase tracking-widest">待結算</span>
                </div>
                <p className="text-2xl font-bold text-[#f0ebe3] font-mono-nums">
                  {(balance.transactions as Array<{ status: string }>).filter(t => t.status === 'PENDING').length}
                </p>
                <p className="text-xs text-[#6b6560] mt-0.5">筆</p>
              </div>
              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span className="text-[10px] text-[#3b82f6] uppercase tracking-widest">總行程</span>
                </div>
                <p className="text-2xl font-bold text-[#f0ebe3] font-mono-nums">
                  {(balance.transactions as Array<{ type: string }>).filter(t => t.type === 'RIDE_FARE').length}
                </p>
                <p className="text-xs text-[#6b6560] mt-0.5">單</p>
              </div>
              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-[#a855f7]" />
                  <span className="text-[10px] text-[#a855f7] uppercase tracking-widest">平台費率</span>
                </div>
                <p className="text-2xl font-bold text-[#f0ebe3] font-mono-nums">5%</p>
                <p className="text-xs text-[#6b6560] mt-0.5">每單</p>
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e1e26]">
                <h3 className="text-sm font-semibold text-[#f0ebe3]">最近交易</h3>
              </div>
              <div className="p-5">
                {!balance.transactions || balance.transactions.length === 0 ? (
                  <p className="text-[#6b6560] text-center py-8 text-sm">暫無交易記錄</p>
                ) : (
                  <div className="space-y-3">
                    {(balance.transactions as unknown[]).slice(0, 10).map((tx: unknown) => {
                      const transaction = tx as { id: string; amount: number; type: string; status: string; description?: string; createdAt: string | Date }
                      const displayAmount = transaction.type === 'RIDE_FARE' ? Math.floor(transaction.amount * 0.95) : transaction.amount
                      return (
                        <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-[#1e1e26]/50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-[#f0ebe3]">{transaction.description || transaction.type}</p>
                            <p className="text-xs text-[#6b6560] font-mono-nums">
                              {format(typeof transaction.createdAt === 'string' ? parseISO(transaction.createdAt) : transaction.createdAt, 'yyyy/MM/dd HH:mm')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold font-mono-nums ${displayAmount >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
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
