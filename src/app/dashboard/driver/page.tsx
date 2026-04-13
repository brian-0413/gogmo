'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { OrderCard, Order } from '@/components/driver/OrderCard'
import { OrderCalendar } from '@/components/driver/OrderCalendar'
import { SmartSchedulePanel } from '@/components/driver/SmartSchedulePanel'
import { SettlementTab } from '@/components/driver/SettlementTab'
import { SquadTab } from '@/components/driver/SquadTab'
import { ProfileTab } from '@/components/driver/ProfileTab'
import { SelfDispatchChat } from '@/components/driver/SelfDispatchChat'
import { TransferRequestForm } from '@/components/driver/TransferRequestForm'
import type { BalanceData } from '@/components/driver/SettlementTab'
import { format, parseISO, startOfDay, startOfWeek, isSameDay } from 'date-fns'
import { formatOrderNo } from '@/lib/utils'
import { zhTW } from 'date-fns/locale'
import { DRIVER_EARNINGS_RATE, CANCELLATION_FEE_RATE, TRANSFER_FEE_RATE } from '@/lib/constants'
import { ClipboardList, FileText, Wallet, LogOut, Plane, Radio, Inbox, ArrowUpDown, ArrowUp, ArrowDown, Car, Sparkles, Calendar, Sparkle, Users } from 'lucide-react'
import Link from 'next/link'

type Tab = 'available' | 'myorders' | 'balance' | 'selfdispatch' | 'squad' | 'profile'
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
  const [balance, setBalance] = useState<BalanceData | null>(null)
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

  // 智慧排班結果狀態
  const [scheduleResult, setScheduleResult] = useState<{
    currentOrders: Array<{ id: string; scheduledTime: string; type: string; status: string; pickupLocation: string; dropoffLocation: string; price: number }>
    currentOrder: { id: string; scheduledTime: string; type: string; pickupLocation: string; dropoffLocation: string; price: number } | null
    availableCount: number
    recommendations: Array<{
      id: string; orderDate: string; orderSeq: number
      type: string; vehicle: string; scheduledTime: string; price: number
      pickupLocation: string; dropoffLocation: string; passengerName: string
      passengerCount: number; luggageCount: number; flightNumber: string
      kenichiRequired: boolean; reason: string
      tightnessLabel: string; tightnessLevel: string
      recommendType: 'pickup' | 'dropoff'
    }>
    timeline: Array<{ time: string; label: string; orderId?: string; price?: number; isTrigger?: boolean }>
    totalIncome: number
  } | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  // 選中的排班訂單（用於一次確認多單）
  const [selectedScheduleOrders, setSelectedScheduleOrders] = useState<string[]>([])
  // 排班確認中
  const [scheduleConfirming, setScheduleConfirming] = useState(false)
  // 小車頭 Tab 狀態
  const [showSelfDispatch, setShowSelfDispatch] = useState(false)
  // 請求小隊支援對話框
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; orderId: string | null; order: Order | null }>({
    open: false,
    orderId: null,
    order: null,
  })
  const [transferReason, setTransferReason] = useState('')

  // 根據觸發類型過濾推薦（送機觸發→只看接機；接機觸發→只看送機）
  const filteredScheduleRecs = useMemo(() => {
    if (!scheduleResult?.currentOrder) return { recs: [], label: '', sortHint: '' }
    const isPickup = scheduleResult.currentOrder.type === 'pickup' || scheduleResult.currentOrder.type === 'pickup_boat'
    const recs = scheduleResult.recommendations.filter(r => r.recommendType === (isPickup ? 'dropoff' : 'pickup'))
    return {
      recs,
      label: isPickup ? '推薦送機' : '推薦接機',
      sortHint: isPickup ? '地理距離' : '落地時間',
    }
  }, [scheduleResult])

  const filteredOrders = useMemo(() => {
    if (!selectedDate) return myOrders
    return myOrders.filter(order => {
      const d = typeof order.scheduledTime === 'string'
        ? new Date(order.scheduledTime)
        : order.scheduledTime
      return isSameDay(d, selectedDate)
    })
  }, [myOrders, selectedDate])

  const calculateStats = useCallback((transactions: unknown[]) => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = startOfWeek(now, { locale: zhTW })
    let today = 0, thisWeek = 0, allTime = 0, todayOrders = 0, weekOrders = 0, allOrders = 0
    for (const tx of transactions as Array<{ type: string; amount: number; createdAt: string | Date }>) {
      if (tx.type !== 'RIDE_FARE') continue
      const createdAt = typeof tx.createdAt === 'string' ? parseISO(tx.createdAt) : tx.createdAt
      const netAmount = Math.floor(tx.amount * DRIVER_EARNINGS_RATE)
      allTime += netAmount; allOrders++
      if (createdAt >= todayStart) { today += netAmount; todayOrders++ }
      if (createdAt >= weekStart) { thisWeek += netAmount; weekOrders++ }
    }
    setBalanceStats({ today, thisWeek, allTime, todayOrders, weekOrders, allOrders })
  }, [])

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

  // 合併的 SSE：單一連線處理所有事件
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
  }, [token])

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
    if (!user || user.accountStatus !== 'ACTIVE') { alert('帳號尚未通過審核，暫時無法接單'); return }
    if (!user.driver?.bankCode || !user.driver?.bankAccount) { alert('請先至個人中心填寫銀行帳號，以開始接單'); return }
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
    const cancelFee = Math.floor(order.price * CANCELLATION_FEE_RATE)
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

  const handleTransferRequest = async (orderId: string, reason: string) => {
    if (!token) return
    const order = myOrders.find(o => o.id === orderId)
    if (!order) return
    setTransferDialog({ open: true, orderId, order })
    setTransferReason(reason)
  }

  const handleTransferSuccess = async (message: string) => {
    if (!token || !transferDialog.orderId) return
    setTransferDialog({ open: false, orderId: null, order: null })
    setTransferReason('')
    alert(message)
    // Update the order's transferStatus
    setMyOrders(prev =>
      prev.map(o =>
        o.id === transferDialog.orderId
          ? { ...o, transferStatus: 'PENDING_SQUAD' }
          : o
      )
    )
    // Refresh balance
    await fetchBalance()
  }

  const handleCancelTransfer = () => {
    setTransferDialog({ open: false, orderId: null, order: null })
    setTransferReason('')
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

  // 智慧排班：呼叫新 API
  const handleSmartSchedule = async () => {
    if (!token) return
    setScheduleLoading(true)
    setScheduleResult(null)
    setSelectedScheduleOrders([])
    try {
      const res = await fetch('/api/schedule/recommend', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setScheduleResult(data.data)
      } else {
        alert(data.error || '查詢失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setScheduleLoading(false)
    }
  }

  // 針對特定訂單做智慧排單
  const handleScheduleForOrder = async (orderId: string) => {
    if (!token) return
    setScheduleLoading(true)
    setScheduleResult(null)
    setSelectedScheduleOrders([])
    try {
      const res = await fetch(`/api/schedule/recommend?orderId=${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setScheduleResult(data.data)
      } else {
        alert(data.error || '查詢失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setScheduleLoading(false)
    }
  }

  // 排班中勾選/取消訂單
  const toggleScheduleOrder = (orderId: string) => {
    setSelectedScheduleOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  // 確認排班（一次接多單）
  const handleConfirmSchedule = async () => {
    if (!token || selectedScheduleOrders.length === 0) return
    const confirmed = window.confirm(
      `確定要一次接 ${selectedScheduleOrders.length} 單嗎？\n每單將扣除 5% 平台費。`
    )
    if (!confirmed) return

    setScheduleConfirming(true)
    try {
      const res = await fetch('/api/schedule/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds: selectedScheduleOrders }),
      })
      const data = await res.json()
      if (data.success) {
        alert(data.data.message)
        setScheduleResult(null)
        setSelectedScheduleOrders([])
        await fetchOrders()
        await fetchBalance()
      } else {
        alert(data.error || '排班確認失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setScheduleConfirming(false)
    }
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

  // Account status gate — REJECTED blocks full access, PENDING_* only shows banner
  if (user.accountStatus === 'REJECTED') {
    const msg = { title: '審核未通過', message: `您的資料審核未通過：${user.rejectReason || '原因不明'}。如有疑問請聯繫客服。`, color: '#E24B4A', icon: '✕' }
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="bg-white border border-[#DDDDDD] rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${msg.color}15` }}>
            <span className="text-3xl">{msg.icon}</span>
          </div>
          <h2 className="text-lg font-bold text-[#222222] mb-2">{msg.title}</h2>
          <p className="text-sm text-[#717171]">{msg.message}</p>
        </div>
      </div>
    )
  }

  const showStatusBanner = user.accountStatus && user.accountStatus !== 'ACTIVE'
  const statusMsg = showStatusBanner
    ? { title: '資料審核中', message: '您的資料已送出，審核通過後即可開始接單。', color: '#3B82F6', icon: '⏳' }
    : null

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917]">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 scan-lines" />
      </div>

      {/* Status banner */}
      {showStatusBanner && statusMsg && (
        <div className="bg-[#3B82F6] text-white px-4 py-3 text-center text-sm font-medium z-30 relative">
          {statusMsg.icon} {statusMsg.message}
        </div>
      )}

      {/* 銀行帳號未填寫橫幅（帳號已啟用但缺少銀行資料） */}
      {user.accountStatus === 'ACTIVE' && (!user.driver?.bankCode || !user.driver?.bankAccount) && (
        <div className="bg-[#FFF3E0] border-b border-[#FFE0B2] px-4 py-3 z-30 relative">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <p className="text-[#B45309] text-sm font-medium">請填寫銀行帳號以開始接單</p>
              <p className="text-[#B45309] text-xs opacity-75 mt-0.5">前往「個人中心」填寫銀行代碼與帳號</p>
            </div>
            <button
              onClick={() => setActiveTab('profile')}
              className="text-[#FF385C] text-sm font-medium hover:text-[#D70466] flex-shrink-0"
            >
              前往填寫 →
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-20 bg-[#FAF8F5]/90 backdrop-blur-xl border-b border-[#E7E5E4] sticky top-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
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
            <div className="flex items-center gap-3 sm:gap-6">
              {/* Mobile balance pill */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DDDDDD] rounded-lg shadow-sm md:hidden">
                <span className="text-sm font-bold text-[#FF385C] font-mono-nums">{user.driver?.balance ?? 0}</span>
                <span className="text-[10px] text-[#717171]">點</span>
                <span className="text-[10px] text-[#E7E5E4]">|</span>
                <span className="text-[10px] text-[#717171]">今日</span>
                <span className="text-sm font-bold text-[#008A05] font-mono-nums">{balanceStats.todayOrders}</span>
                <span className="text-[10px] text-[#717171]">單</span>
              </div>
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
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-[#1C1917] hidden sm:block">{user.name}</p>
                  <p className="text-xs text-[#78716C] hidden sm:block">{driverProfile?.licensePlate || '未設定車牌'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="border-[#DDDDDD] text-[#717171] hover:border-[#FF385C]/30 hover:text-[#FF385C] hover:bg-[#FFF3E0]">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 行動版：Header 右側餘額（md+ 以上 Header 已有豐富資訊） */}
      <div className="md:hidden relative z-10 bg-[#FAF8F5]/90 border-b border-[#E7E5E4]">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#22C55E]/5 border border-[#22C55E]/20">
            <Radio className="w-3 h-3 text-[#22C55E] animate-pulse" />
            <span className="text-[11px] text-[#22C55E] font-medium font-mono-nums">即時</span>
          </div>
          <div className="flex items-center gap-3 text-[12px] font-mono-nums text-[#78716C]">
            <span>今<strong className="text-[#22C55E]">{balanceStats.todayOrders}</strong>單</span>
            <span>週<strong className="text-[#3B82F6]">{balanceStats.weekOrders}</strong>單</span>
          </div>
        </div>
      </div>

      {/* Desktop 專用 Tab 導航（md 以上顯示於 Header 右側） */}
      <div className="hidden md:block relative z-10 bg-[#FAF8F5]/80 border-b border-[#E7E5E4]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {[
              { key: 'available' as Tab, icon: ClipboardList, label: '接單大廳', accent: '#F59E0B', badge: filteredAvailableOrders.length },
              { key: 'myorders' as Tab, icon: FileText, label: '我的行程', accent: '#F59E0B', badge: myOrders.length },
              { key: 'balance' as Tab, icon: Wallet, label: '帳務中心', accent: '#F59E0B', badge: null },
              { key: 'selfdispatch' as Tab, icon: Sparkle, label: '小車頭', accent: '#FF385C', badge: null },
              { key: 'squad' as Tab, icon: Users, label: '我的小隊', accent: '#F59E0B', badge: null },
              { key: 'profile' as Tab, icon: Users, label: '個人中心', accent: '#F59E0B', badge: null },
            ].map(({ key, icon: Icon, label, accent, badge }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                  activeTab === key
                    ? `border-[${accent}] text-[${accent}]`
                    : 'border-transparent text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F0]/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge !== null && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums bg-[#F5F4F0] text-[#78716C] border border-[#DDDDDD]">
                    {badge}
                  </span>
                )}
                {activeTab === key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}66` }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content — 底部留 padding 避免被 Tab Bar 遮住 */}
      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-6">

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
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F4F0] border border-[#DDDDDD] rounded-lg">
                      <Car className="w-3.5 h-3.5 text-[#717171]" />
                      <span className="text-[12px] text-[#717171]">
                        您的車型：<span className="font-bold text-[#222222]">{driverProfile?.carType || '未設定'}</span>
                      </span>
                      <span className="text-[11px] text-[#A8A29E]">
                        （顯示 {filteredAvailableOrders.length} / {availableOrders.length} 單）
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:hidden">
                      <span className="text-[13px] font-bold text-[#222222] font-mono-nums">{filteredAvailableOrders.length}</span>
                      <span className="text-[12px] text-[#717171]">筆可接</span>
                    </div>
                  </div>
                  {/* 排序按鈕 */}
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#717171] flex-shrink-0" />
                    <span className="text-[11px] text-[#717171] mr-1 hidden sm:inline">排序：</span>
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

            {/* 智慧排班工具列 */}
            <div className="flex items-center justify-between px-1 mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSmartSchedule}
                  disabled={scheduleLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-[14px] font-bold rounded-xl hover:shadow-[0_2px_8px_rgba(245,158,11,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Sparkles className={`w-4 h-4 ${scheduleLoading ? 'animate-spin' : ''}`} />
                  {scheduleLoading ? '分析中...' : '智慧排班'}
                </button>
                <button
                  onClick={handleCheckMatch}
                  disabled={matchLoading}
                  className="flex items-center gap-2 px-3 py-2 border border-[#DDDDDD] text-[#717171] text-[13px] font-medium rounded-lg hover:bg-[#F5F4F0] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {matchLoading ? '檢查中...' : '時間配單'}
                </button>
                {(scheduleResult || matchResults) && (
                  <span className="text-[13px] text-[#78716C]">
                    <span className="font-bold font-mono-nums text-[#222222]">
                      {scheduleResult?.recommendations?.length ?? matchResults?.recommendations.length ?? 0}
                    </span> 筆推薦
                  </span>
                )}
              </div>
              {(scheduleResult || matchResults) && (
                <button
                  onClick={() => { setScheduleResult(null); setMatchResults(null); setSelectedScheduleOrders([]) }}
                  className="text-[12px] text-[#78716C] hover:text-[#222222] underline"
                >
                  清除
                </button>
              )}
            </div>

            {/* ===== 智慧排班結果面板 ===== */}
            <SmartSchedulePanel
              scheduleResult={scheduleResult}
              filteredScheduleRecs={filteredScheduleRecs}
              selectedScheduleOrders={selectedScheduleOrders}
              onToggleOrder={toggleScheduleOrder}
              onConfirmSchedule={handleConfirmSchedule}
              onClear={() => { setScheduleResult(null); setMatchResults(null); setSelectedScheduleOrders([]) }}
              scheduleConfirming={scheduleConfirming}
            />

            {/* 舊的時間配單結果（保留相容性） */}
            {matchResults && !scheduleResult && (
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
                    <div
                      onClick={() => router.push(`/dashboard/driver/order/${order.id}`)}
                      className="cursor-pointer"
                    >
                      <OrderCard order={order} showActions={true} compact={true} onTransferRequest={handleTransferRequest} onCancel={handleCancelOrder} transferLoading={actionLoading} />
                    </div>
                    {order.status === 'ACCEPTED' && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/driver/order/${order.id}`)}
                            className="flex-1 py-3 sm:py-2 px-3 bg-[#0C447C] text-white text-[15px] sm:text-[13px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors active:bg-[#082a52]"
                          >
                            執行行程
                          </button>
                          <button
                            onClick={() => handleTransferRequest(order.id, '')}
                            disabled={actionLoading === order.id || !!order.transferStatus}
                            className="flex-1 py-3 sm:py-2 px-3 bg-[#0C447C] text-white text-[15px] sm:text-[13px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors active:bg-[#082a52] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            {order.transferStatus && order.transferStatus !== 'pending' ? '等待隊友回應...' : '請求小隊支援'}
                          </button>
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={actionLoading === order.id}
                            className="py-3 sm:py-2 px-3 bg-white border border-[#E24B4A] text-[#E24B4A] text-[13px] font-bold rounded-lg hover:bg-[#FCEBEB] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            退單
                          </button>
                        </div>
                        <div className="text-[11px] text-[#717171] px-1">
                          <span className="text-[#0C447C]">請求支援</span>
                          <span className="mx-1">：</span>
                          轉單費 5%（約 NT${Math.floor(order.price * TRANSFER_FEE_RATE).toLocaleString()}）
                          <span className="mx-2 text-[#DDDDDD]">|</span>
                          <span className="text-[#E24B4A]">直接退單</span>
                          <span className="mx-1">：</span>
                          退單費 10%
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== BALANCE ===== */}
        {activeTab === 'balance' && <SettlementTab token={token} balance={balance} balanceStats={balanceStats} />}

        {/* ===== 小車頭 ===== */}
        {activeTab === 'selfdispatch' && token && (
          <div>
            {!user?.driver?.isPremium ? (
              <div className="text-center py-20 bg-white border border-[#DDDDDD] rounded-2xl">
                <div className="w-16 h-16 rounded-2xl bg-[#F4EFE9] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-4">
                  <Sparkle className="w-8 h-8 text-[#D6D3D1]" />
                </div>
                <p className="text-[#717171] text-lg font-medium mb-2">小車頭功能僅限 Premium 司機</p>
                <p className="text-[#A8A29E] text-sm">升級 Premium 解鎖自助發單功能</p>
              </div>
            ) : showSelfDispatch ? (
              <SelfDispatchChat
                token={token}
                onSuccess={() => {
                  setShowSelfDispatch(false)
                  setActiveTab('myorders')
                }}
                onClose={() => setShowSelfDispatch(false)}
              />
            ) : (
              <div className="text-center py-20 bg-white border border-[#DDDDDD] rounded-2xl">
                <div className="w-16 h-16 rounded-2xl bg-[#FFF3E0] border border-[#F59E0B]/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkle className="w-8 h-8 text-[#F59E0B]" />
                </div>
                <p className="text-[#222222] text-lg font-medium mb-2">小車頭 — 自行發單上架</p>
                <p className="text-[#717171] text-sm mb-6">將您的空車時間發布到接單大廳，讓派單方看到您的車</p>
                <button
                  onClick={() => setShowSelfDispatch(true)}
                  className="px-6 py-3 bg-[#FF385C] text-white text-[15px] font-bold rounded-xl hover:bg-[#E83355] transition-colors"
                >
                  開始發單
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== 我的小隊 ===== */}
        {activeTab === 'squad' && token && (
          <SquadTab token={token} driverId={user.driver?.id || ''} />
        )}

        {/* ===== 個人中心 ===== */}
        {activeTab === 'profile' && token && (
          <ProfileTab token={token} />
        )}

        {/* ===== 請求小隊支援對話框 ===== */}
        {transferDialog.open && transferDialog.order && (
          <TransferRequestForm
            order={transferDialog.order}
            driverBalance={user.driver?.balance ?? 0}
            token={token}
            onSuccess={handleTransferSuccess}
            onCancel={handleCancelTransfer}
          />
        )}
      </main>

      {/* ══════════════════════════════════════════════
          底部 Tab Bar（行動優先）
          桌面版隱藏，固定在底部
          參考 Vant / Apple HIG 設計標準
      ══════════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E8E5E0]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* iOS 底部指示線 */}
        <div className="h-[3px] w-16 mx-auto bg-[#F59E0B] rounded-b-full" />
        <div className="flex h-16">
          {/* 接單大廳 */}
          <button
            onClick={() => setActiveTab('available')}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            <div className="relative">
              <ClipboardList className={`w-6 h-6 ${activeTab === 'available' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`} />
              {filteredAvailableOrders.length > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[17px] h-[17px] px-0.5 rounded-full bg-[#F59E0B] text-white text-[10px] font-bold font-mono-nums flex items-center justify-center leading-none">
                  {filteredAvailableOrders.length > 99 ? '99+' : filteredAvailableOrders.length}
                </span>
              )}
            </div>
            <span className={`text-[11px] font-medium leading-none ${activeTab === 'available' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`}>
              接單
            </span>
          </button>

          {/* 我的行程 */}
          <button
            onClick={() => setActiveTab('myorders')}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            <div className="relative">
              <FileText className={`w-6 h-6 ${activeTab === 'myorders' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`} />
              {myOrders.length > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[17px] h-[17px] px-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-bold font-mono-nums flex items-center justify-center leading-none">
                  {myOrders.length > 99 ? '99+' : myOrders.length}
                </span>
              )}
            </div>
            <span className={`text-[11px] font-medium leading-none ${activeTab === 'myorders' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`}>
              行程
            </span>
          </button>

          {/* 帳務中心 */}
          <button
            onClick={() => setActiveTab('balance')}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            <Wallet className={`w-6 h-6 ${activeTab === 'balance' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`} />
            <span className={`text-[11px] font-medium leading-none ${activeTab === 'balance' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`}>
              帳務
            </span>
          </button>

          {/* 小車頭（Premium only） */}
          <button
            onClick={() => user?.driver?.isPremium ? setActiveTab('selfdispatch') : null}
            className={`flex-1 flex flex-col items-center justify-center gap-1 relative ${!user?.driver?.isPremium ? 'opacity-40' : ''}`}
          >
            <Sparkle className={`w-6 h-6 ${activeTab === 'selfdispatch' ? 'text-[#FF385C]' : 'text-[#71717A]'}`} />
            <span className={`text-[11px] font-medium leading-none ${activeTab === 'selfdispatch' ? 'text-[#FF385C]' : 'text-[#71717A]'}`}>
              小車頭
            </span>
          </button>

          {/* 我的小隊 */}
          <button
            onClick={() => setActiveTab('squad')}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            <Users className={`w-6 h-6 ${activeTab === 'squad' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`} />
            <span className={`text-[11px] font-medium leading-none ${activeTab === 'squad' ? 'text-[#F59E0B]' : 'text-[#71717A]'}`}>
              我的
            </span>
          </button>
        </div>
      </nav>
    </div>
  )
}
