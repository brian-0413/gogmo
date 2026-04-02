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
import { ClipboardList, FileText, Wallet, LogOut, Plane, Zap, TrendingUp, Radio, Inbox, Clock, ArrowUpDown, ArrowUp, ArrowDown, Car, Star, Sparkles } from 'lucide-react'
import Link from 'next/link'

type Tab = 'available' | 'myorders' | 'balance'
type SortKey = 'scheduledTime' | 'price' | 'type'
type SortDir = 'asc' | 'desc'

// 司機能看到哪些車型訂單（車型越大能看的越多）
const VEHICLE_SCOPE: Record<string, string[]> = {
  small:  ['small', 'any'],
  suv:    ['suv', 'small', 'any'],
  van9:   ['van9', 'suv', 'small', 'any', 'any_r'],
  any_r:  ['any_r', 'any'],
  any:    ['any'],
  pending: ['any'],
  // 中文車型 → 英文 enum 對照（供顯示名稱查詢）
  '小車': ['small', 'any'],
  '轎車': ['small', 'any'],
  '休旅': ['suv', 'small', 'any'],
  'SUV':  ['suv', 'small', 'any'],
  '7人座': ['van9', 'suv', 'small', 'any', 'any_r'],
  '9人座': ['van9', 'suv', 'small', 'any', 'any_r'],
  '福祉車': ['suv', 'small', 'any'],
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'scheduledTime', label: '日期/時間' },
  { key: 'price', label: '金額' },
  { key: 'type', label: '種類' },
]

const TYPE_SORT_ORDER: Record<string, number> = {
  pickup: 1, dropoff: 2, pickup_boat: 3, dropoff_boat: 4, transfer: 5, charter: 6, pending: 7,
}

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
  const eventSourceRef = useRef<EventSource | null>(null)
  const [balanceStats, setBalanceStats] = useState<{
    today: number; thisWeek: number; allTime: number
    todayOrders: number; weekOrders: number; allOrders: number
  }>({ today: 0, thisWeek: 0, allTime: 0, todayOrders: 0, weekOrders: 0, allOrders: 0 })
  const [driverProfile, setDriverProfile] = useState<{
    licensePlate: string; carType: string; carColor: string
  } | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('scheduledTime')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [matchResults, setMatchResults] = useState<{
    currentOrders: Array<{ id: string; scheduledTime: string; type: string; status: string; pickupLocation: string; dropoffLocation: string; price: number; freeTime: string }>
    driverFreeTime: string
    recommendations: Array<{ id: string; orderDate: string; orderSeq: number; type: string; vehicle: string; scheduledTime: string; price: number; pickupLocation: string; dropoffLocation: string; passengerName: string; passengerCount: number; luggageCount: number; flightNumber: string; kenichiRequired: boolean; minutesFromFree: number; reason: string }>
    summary: { currentOrdersCount: number; recommendationsCount: number }
  } | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)

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

  // 車型過濾範圍（根據司機註冊車型）
  const driverCarType = driverProfile?.carType || 'pending'
  const vehicleScope = VEHICLE_SCOPE[driverCarType] || ['any']

  const filteredAvailableOrders = useMemo(() => {
    // 車型過濾
    let orders = availableOrders.filter(o => vehicleScope.includes(o.vehicle || 'pending'))
    // 排序
    orders = [...orders].sort((a, b) => {
      if (sortKey === 'price') {
        return sortDir === 'asc' ? a.price - b.price : b.price - a.price
      }
      if (sortKey === 'type') {
        const aVal = TYPE_SORT_ORDER[a.type || 'pending'] ?? 99
        const bVal = TYPE_SORT_ORDER[b.type || 'pending'] ?? 99
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      // scheduledTime (default)
      const aTime = new Date(a.scheduledTime).getTime()
      const bTime = new Date(b.scheduledTime).getTime()
      return sortDir === 'asc' ? aTime - bTime : bTime - aTime
    })
    return orders
  }, [availableOrders, vehicleScope, sortKey, sortDir])

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

  const handleAcceptOrder = async (orderId: string, skipWarning = false) => {
    if (!token) return
    const order = availableOrders.find(o => o.id === orderId)
    if (!order) return
    setActionLoading(orderId)

    // 樂觀更新：立刻從大廳移除，加入我的行程
    setAvailableOrders(prev => prev.filter(o => o.id !== orderId))
    const acceptedOrder = { ...order, status: 'ACCEPTED' as const }
    setMyOrders(prev => [acceptedOrder, ...prev])

    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skipWarning }),
      })
      const data = await res.json()

      if (data.success) {
        // 有警告訊息時，先顯示提醒再確認
        if (data.data?.warning && !skipWarning) {
          const confirmed = window.confirm(data.data.warning)
          if (confirmed) {
            setActionLoading(null)
            await handleAcceptOrder(orderId, true)
            return
          } else {
            // 使用者取消，回滾
            setAvailableOrders(prev => [order, ...prev])
            setMyOrders(prev => prev.filter(o => o.id !== orderId))
            setActionLoading(null)
            return
          }
        }
        // 接單成功
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

  const handleCancelOrder = async (orderId: string) => {
    if (!token) return
    const order = myOrders.find(o => o.id === orderId)
    if (!order) return
    const cancelFee = Math.floor(order.price * 0.1)
    const confirmed = window.confirm(
      `確定要退單嗎？退單將扣除 NT$${order.price} 的 10%，共 ${cancelFee} 點`
    )
    if (!confirmed) return

    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setMyOrders(prev => prev.filter(o => o.id !== orderId))
        // 直接用 API 回傳的新餘額更新，避免 fetchBalance 取到舊資料
        if (balance) {
          setBalance({
            ...balance,
            balance: data.data.newBalance,
          })
        }
        await fetchBalance()
        alert(`退單成功，已扣除 ${data.data.cancelFee} 點（NT$${order.price} × 10%）`)
      } else {
        alert(data.error || '退單失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally { setActionLoading(null) }
  }

  const handleCheckMatch = async () => {
    if (!token) return
    setMatchLoading(true)
    setMatchResults(null)
    try {
      const res = await fetch('/api/orders/match', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setMatchResults(data.data)
      } else {
        alert(data.error || '查詢失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setMatchLoading(false)
    }
  }

  const handleAcceptFromMatch = async (orderId: string) => {
    if (!token) return
    const order = availableOrders.find(o => o.id === orderId)
    if (!order) {
      // 如果大廳沒有，先加進去
      alert('請稍候，訂單可能已被其他人接走')
      return
    }
    await handleAcceptOrder(orderId)
    // 接單成功後重新檢查配單
    setMatchResults(null)
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
              onClick={() => setActiveTab('available')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                activeTab === 'available'
                  ? 'border-[#F59E0B] text-[#F59E0B]'
                  : 'border-transparent text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F0]/50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              接單大廳
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                {filteredAvailableOrders.length}
              </span>
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
            ) : (
              <>
                {/* 排序工具列 */}
                <div className="flex items-center justify-between mb-4 gap-3">
                  {/* 車型範圍提示 */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F4F0] border border-[#DDDDDD] rounded-lg">
                      <Car className="w-3.5 h-3.5 text-[#717171]" />
                      <span className="text-[12px] text-[#717171]">
                        您的車型：<span className="font-bold text-[#222222]">{driverProfile?.carType || '未設定'}</span>
                      </span>
                      <span className="text-[11px] text-[#A8A29E]">
                        （顯示 {filteredAvailableOrders.length} / {availableOrders.length} 單）
                      </span>
                    </div>
                  </div>
                  {/* 排序按鈕 */}
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#717171] flex-shrink-0" />
                    <span className="text-[11px] text-[#717171] mr-1">排序：</span>
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          if (sortKey === opt.key) {
                            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortKey(opt.key)
                            setSortDir('asc')
                          }
                        }}
                        className={`flex items-center gap-0.5 px-2 py-1 rounded text-[12px] font-medium transition-colors ${
                          sortKey === opt.key
                            ? 'bg-[#F59E0B]/10 text-[#B45309] border border-[#F59E0B]/20'
                            : 'text-[#717171] hover:bg-[#F5F4F0] border border-transparent'
                        }`}
                      >
                        {opt.label}
                        {sortKey === opt.key && (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredAvailableOrders.length === 0 ? (
                  <div className="text-center py-32 border border-[#DDDDDD] rounded-2xl bg-white/50 relative overflow-hidden shadow-sm">
                    <div className="absolute inset-0 dot-matrix opacity-30" />
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-[#F5F4F0] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
                        <Inbox className="w-8 h-8 text-[#D6D3D1]" />
                      </div>
                      <p className="text-[#78716C] mb-1 text-lg font-medium">
                        {availableOrders.length === 0 ? '目前沒有可接的訂單' : '沒有符合您車型的訂單'}
                      </p>
                      <p className="text-[#A8A29E] text-sm">
                        等待派單方發布符合您車型的訂單
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredAvailableOrders.map((order, index) => (
                      <div key={order.id} className="animate-cardEntry" style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}>
                        <OrderCard order={order} onAccept={handleAcceptOrder} showActions={true} isNew={true} />
                      </div>
                    ))}
                  </div>
                )}
              </>
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

            {/* 檢查合適配單 */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCheckMatch}
                  disabled={matchLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-[14px] font-bold rounded-xl hover:shadow-[0_2px_8px_rgba(245,158,11,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Sparkles className={`w-4 h-4 ${matchLoading ? 'animate-spin' : ''}`} />
                  {matchLoading ? '檢查中...' : '檢查合適配單'}
                </button>
                {matchResults && (
                  <span className="text-[13px] text-[#78716C]">
                    司機自由時間：<span className="font-bold font-mono-nums text-[#222222]">{matchResults.driverFreeTime}</span>
                    {matchResults.recommendations.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#B45309] text-[12px] font-medium">
                        {matchResults.recommendations.length} 筆推薦
                      </span>
                    )}
                  </span>
                )}
              </div>
              {matchResults && (
                <button
                  onClick={() => setMatchResults(null)}
                  className="text-[12px] text-[#78716C] hover:text-[#222222] underline"
                >
                  清除結果
                </button>
              )}
            </div>

            {/* 配單推薦結果 */}
            {matchResults && (
              <div className="space-y-3">
                {/* 當前行程概覽 */}
                {matchResults.currentOrders.length > 0 && (
                  <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] text-[#78716C] uppercase tracking-wider mb-2 font-medium">當前行程</p>
                    <div className="space-y-1.5">
                      {matchResults.currentOrders.map(order => (
                        <div key={order.id} className="flex items-center justify-between text-[13px]">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono-nums" style={{
                              backgroundColor: order.type === 'pickup' || order.type === 'pickup_boat' ? '#E6F1FB' : '#FFF3E0',
                              color: order.type === 'pickup' || order.type === 'pickup_boat' ? '#0C447C' : '#92400E'
                            }}>
                              {order.type === 'pickup' || order.type === 'pickup_boat' ? '接機' : order.type === 'dropoff' || order.type === 'dropoff_boat' ? '送機' : '其他'}
                            </span>
                            <span className="text-[#717171]">
                              {order.pickupLocation} → {order.dropoffLocation}
                            </span>
                          </div>
                          <span className="text-[12px] text-[#717171] font-mono-nums">
                            自由：{order.freeTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 推薦清單 */}
                {matchResults.recommendations.length === 0 ? (
                  <div className="text-center py-8 bg-white border border-[#DDDDDD] rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-[#F5F4F0] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-6 h-6 text-[#D6D3D1]" />
                    </div>
                    <p className="text-[14px] text-[#78716C] font-medium">目前沒有合適的配單</p>
                    <p className="text-[12px] text-[#A8A29E] mt-1">符合您行程的大廳訂單會在此顯示</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#78716C] uppercase tracking-wider font-medium">推薦配單</p>
                    {matchResults.recommendations.map(rec => {
                      return (
                        <div key={rec.id} className="bg-white border border-[#DDDDDD] rounded-xl p-4 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-1 bg-[#FF385C] text-white text-[13px] font-bold font-mono-nums rounded">
                                #{rec.orderSeq.toString().padStart(4, '0')}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-bold font-mono-nums rounded" style={{
                                backgroundColor: rec.type === 'pickup' || rec.type === 'pickup_boat' ? '#E6F1FB' : '#FFF3E0',
                                color: rec.type === 'pickup' || rec.type === 'pickup_boat' ? '#0C447C' : '#92400E'
                              }}>
                                {rec.type === 'pickup' || rec.type === 'pickup_boat' ? '接機' : rec.type === 'dropoff' || rec.type === 'dropoff_boat' ? '送機' : rec.type === 'transfer' ? '接駁' : '包車'}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
                                {rec.vehicle === 'small' ? '小車' : rec.vehicle === 'suv' ? '休旅' : rec.vehicle === 'van9' ? '9人座' : rec.vehicle === 'any' ? '任意' : rec.vehicle === 'any_r' ? '任意R' : '待確認'}
                              </span>
                              {rec.kenichiRequired && (
                                <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">
                                  肯驛
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-[20px] font-bold font-mono-nums text-[#FF385C] leading-none">
                                NT${rec.price.toLocaleString()}
                              </p>
                              <p className="text-[11px] text-[#78716C] mt-0.5 font-mono-nums">
                                自由後 {rec.minutesFromFree >= 0 ? `+${rec.minutesFromFree}分` : `${rec.minutesFromFree}分`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-2 text-[13px]">
                            <span className="font-bold font-mono-nums text-[#222222]">
                              {format(parseISO(rec.scheduledTime), 'M/dd HH:mm', { locale: zhTW })}
                            </span>
                            {rec.flightNumber && (
                              <span className="px-1.5 py-0.5 rounded bg-[#F4EFE9] text-[11px] font-mono-nums text-[#717171]">
                                {rec.flightNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-start gap-2 mb-2 text-[13px] text-[#717171]">
                            <span className="font-medium text-[#222222] truncate">{rec.pickupLocation}</span>
                            <span className="text-[#DDDDDD] flex-shrink-0">→</span>
                            <span className="font-medium text-[#222222] truncate">{rec.dropoffLocation}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] text-[#B45309] italic">{rec.reason}</p>
                            <button
                              onClick={() => handleAcceptFromMatch(rec.id)}
                              disabled={actionLoading === rec.id}
                              className="px-4 py-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-[13px] font-bold rounded-lg hover:shadow-[0_2px_8px_rgba(245,158,11,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {actionLoading === rec.id ? '處理中...' : '配此單'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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
                  <div key={order.id} className="relative">
                    <OrderCard order={order} showActions={true} compact={true} />
                    {order.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={actionLoading === order.id}
                        className="mt-2 w-full py-2 px-4 bg-white border border-[#E24B4A] text-[#E24B4A] text-[13px] font-bold rounded-lg hover:bg-[#FCEBEB] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {actionLoading === order.id ? '處理中...' : '退單'}
                      </button>
                    )}
                  </div>
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
