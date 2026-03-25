'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { parseBatchOrders, ParsedOrder, BatchOrderDefaults } from '@/lib/ai'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  ClipboardList,
  Plus,
  Search,
  UserCheck,
  Wallet,
  FileText,
  Car,
  BarChart3,
  Building2,
  User,
  Phone,
  Plane,
  LogOut,
  Radio,
  TrendingUp,
  CheckCircle,
  Clock,
} from 'lucide-react'
import Link from 'next/link'

type Tab = 'orders' | 'create' | 'review' | 'drivers' | 'settlement'
type OrderStatus = 'PENDING' | 'PUBLISHED' | 'ASSIGNED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface Order {
  id: string
  status: OrderStatus
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  dropoffLocation: string
  dropoffAddress: string
  passengerCount: number
  luggageCount: number
  scheduledTime: string
  price: number
  note?: string
  driver?: { user: { name: string }; licensePlate: string }
  createdAt: string
}

interface Driver {
  id: string
  status: string
  licensePlate: string
  carType: string
  carColor: string
  user: { name: string; phone: string }
}

// Review item with unique ID
interface ReviewItem extends ParsedOrder {
  reviewId: string
  editedPrice?: number
  editedTime?: string
  editedPickup?: string
  editedDropoff?: string
  editedNote?: string
}

// Date options
const DATE_OPTIONS = [
  { value: '', label: '選擇日期...' },
  { value: 'today', label: '今天' },
  { value: 'tomorrow', label: '明天' },
]

// Generate date options for next 7 days
for (let i = 2; i <= 7; i++) {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const dateStr = format(d, 'yyyy-MM-dd')
  const label = format(d, 'M/d (EEE)', { locale: zhTW })
  DATE_OPTIONS.push({ value: dateStr, label })
}

// Price options
const PRICE_OPTIONS = [
  { value: 0, label: '選擇價格...' },
  { value: 600, label: '$600' },
  { value: 700, label: '$700' },
  { value: 800, label: '$800' },
  { value: 900, label: '$900' },
  { value: 1000, label: '$1000' },
  { value: 1200, label: '$1200' },
  { value: 1500, label: '$1500' },
  { value: 1800, label: '$1800' },
  { value: 2000, label: '$2000' },
  { value: 2500, label: '$2500' },
  { value: 3000, label: '$3000' },
  { value: 3500, label: '$3500' },
  { value: 4000, label: '$4000' },
]

// Car type options
const CAR_TYPE_OPTIONS = [
  { value: '', label: '選擇車型...' },
  { value: '小車', label: '小車（一般轎車）' },
  { value: '休旅車', label: '休旅車' },
  { value: '任何車', label: '不限車型' },
]

// Passenger count options
const PASSENGER_OPTIONS = [
  { value: 1, label: '1 人' },
  { value: 2, label: '2 人' },
  { value: 3, label: '3 人' },
  { value: 4, label: '4 人' },
]

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

export default function DispatcherDashboard() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Batch order defaults
  const [defaults, setDefaults] = useState<BatchOrderDefaults>({
    price: 800,
    carType: '',
    date: '',
    passengerCount: 1,
    flightNumber: '',
  })
  const [rawText, setRawText] = useState('')
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ParsedOrder>>({})
  const [createLoading, setCreateLoading] = useState(false)

  // Redirect if not dispatcher
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'DISPATCHER')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  const fetchOrders = useCallback(async () => {
    if (!token) return

    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setOrders(data.data)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchDrivers = useCallback(async () => {
    if (!token) return

    try {
      const res = await fetch('/api/dispatchers/drivers', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setDrivers(data.data)
    } catch (error) {
      console.error('Failed to fetch drivers:', error)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchOrders()
      fetchDrivers()
    }
  }, [token, fetchOrders, fetchDrivers])

  const handleParseBatch = () => {
    if (!rawText.trim()) return

    const parsed = parseBatchOrders(rawText, defaults)

    // Convert to review items with unique IDs
    const items: ReviewItem[] = parsed.map(p => ({
      ...p,
      reviewId: generateId(),
    }))

    setReviewItems(items)
    setActiveTab('review')
  }

  const handleEditItem = (item: ReviewItem) => {
    setEditingId(item.reviewId)
    setEditForm({
      price: item.price || defaults.price || 800,
      scheduledTime: item.scheduledTime,
      pickupLocation: item.pickupLocation,
      dropoffLocation: item.dropoffLocation,
      note: item.note,
    })
  }

  const handleSaveEdit = (reviewId: string) => {
    setReviewItems(prev =>
      prev.map(item =>
        item.reviewId === reviewId
          ? {
              ...item,
              editedPrice: editForm.price,
              editedTime: editForm.scheduledTime,
              editedPickup: editForm.pickupLocation,
              editedDropoff: editForm.dropoffLocation,
              editedNote: editForm.note,
            }
          : item
      )
    )
    setEditingId(null)
    setEditForm({})
  }

  const handleDeleteItem = (reviewId: string) => {
    setReviewItems(prev => prev.filter(item => item.reviewId !== reviewId))
  }

  const handlePublishOrders = async () => {
    if (!token || reviewItems.length === 0) return

    setCreateLoading(true)

    try {
      // Determine date to use
      let orderDate = ''
      if (defaults.date === 'today') {
        orderDate = format(new Date(), 'yyyy-MM-dd')
      } else if (defaults.date === 'tomorrow') {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        orderDate = format(d, 'yyyy-MM-dd')
      } else if (defaults.date) {
        orderDate = defaults.date
      } else {
        orderDate = format(new Date(), 'yyyy-MM-dd')
      }

      // Create orders one by one
      for (const item of reviewItems) {
        const scheduledDateTime = `${orderDate}T${item.editedTime || item.scheduledTime}:00`

        await fetch('/api/orders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            passengerName: '待確認',
            passengerPhone: '待確認',
            flightNumber: defaults.flightNumber || '',
            pickupLocation: item.editedPickup || item.pickupLocation || '',
            pickupAddress: item.editedPickup || item.pickupLocation || '',
            dropoffLocation: item.editedDropoff || item.dropoffLocation || '',
            dropoffAddress: item.editedDropoff || item.dropoffLocation || '',
            passengerCount: defaults.passengerCount || 1,
            luggageCount: 0,
            scheduledTime: scheduledDateTime,
            price: item.editedPrice || item.price || defaults.price || 800,
            note: item.editedNote || item.note || '',
            rawText: item.rawText || '',
          }),
        })
      }

      alert(`已成功發布 ${reviewItems.length} 筆訂單！`)
      setRawText('')
      setReviewItems([])
      setActiveTab('orders')
      fetchOrders()
    } catch (error) {
      console.error('Failed to create orders:', error)
      alert('發布訂單失敗')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    if (!token) return

    setActionLoading(orderId)

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ _action: 'assign', driverId }),
      })

      const data = await res.json()

      if (data.success) {
        await fetchOrders()
      } else {
        alert(data.error || '指派失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#ff8c42] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[#666]">載入中...</p>
        </div>
      </div>
    )
  }

  const statusCounts = {
    PUBLISHED: orders.filter(o => o.status === 'PUBLISHED').length,
    ACTIVE: orders.filter(o => ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(o.status)).length,
    COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-[#ff8c42]/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-[#ff8c42] flex items-center justify-center">
                <Plane className="w-4 h-4 text-black" />
              </div>
              <span className="text-[#ff8c42] font-semibold tracking-tight">
                {user.dispatcher?.companyName || '車頭專區'}
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs text-[#22c55e]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                </span>
                {drivers.filter(d => d.status === 'ONLINE').length} 司機在線
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium">{user.name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="border-white/20 text-[#666] hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <div className="relative z-10 bg-black/50 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#ff8c42]/20 to-[#ff8c42]/5 border border-[#ff8c42]/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#ff8c42]" />
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts.PUBLISHED}</p>
              <p className="text-xs text-[#666]">待搶單</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts.ACTIVE}</p>
              <p className="text-xs text-[#666]">進行中</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-[#22c55e]" />
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts.COMPLETED}</p>
              <p className="text-xs text-[#666]">已完成</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 bg-black/50 backdrop-blur-xl border-b border-white/5 sticky top-[156px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'orders'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <ClipboardList className="w-4 h-4" /> 訂單管理
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <Plus className="w-4 h-4" /> 批次建單
            </button>
            {reviewItems.length > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'review'
                    ? 'border-[#ff8c42] text-[#ff8c42]'
                    : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
                }`}
              >
                <Search className="w-4 h-4" /> 審核清單 ({reviewItems.length})
              </button>
            )}
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'drivers'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <UserCheck className="w-4 h-4" /> 司機列表
            </button>
            <button
              onClick={() => setActiveTab('settlement')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settlement'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <Wallet className="w-4 h-4" /> 對帳表
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-2 border-[#ff8c42] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="text-center py-24 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                    <p className="text-[#a0a0a0] mb-2 text-lg">還沒有訂單</p>
                    <Button className="mt-4 bg-[#ff8c42] hover:bg-[#ff9d5c] text-black" onClick={() => setActiveTab('create')}>
                      建立第一筆訂單
                    </Button>
                  </div>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all">
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold" style={{ color: '#ff8c42' }}>
                              NT${order.price}
                            </span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[#666] font-mono">#{order.id.slice(0, 8)}</p>
                            <p className="text-xs text-[#666]">
                              {order.scheduledTime ? format(parseISO(order.scheduledTime), 'MM/dd HH:mm', { locale: zhTW }) : '-'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-[#666] mb-1">航班</p>
                            <p className="font-mono font-medium text-[#e0e0e0]">{order.flightNumber || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#666] mb-1">時間</p>
                            <p className="font-medium text-[#e0e0e0]">
                              {order.scheduledTime ? format(parseISO(order.scheduledTime), 'HH:mm') : '-'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                            <span className="text-sm text-[#e0e0e0] truncate">{order.pickupLocation}</span>
                          </div>
                          <span className="text-[#666]">→</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                            <span className="text-sm text-[#e0e0e0] truncate">{order.dropoffLocation}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-[#666] mb-4">
                          <span className="flex items-center gap-1"><User className="w-4 h-4" /> {order.passengerName || '待確認'}</span>
                          <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {order.passengerPhone || '待確認'}</span>
                        </div>

                        {order.note && (
                          <div className="text-xs text-[#888] italic mb-4 bg-white/5 p-2 rounded flex items-start gap-1">
                            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" /> {order.note}
                          </div>
                        )}

                        {/* Assign Driver Section */}
                        {order.status === 'PUBLISHED' && (
                          <div className="border-t border-white/5 pt-4">
                            <p className="text-xs text-[#666] mb-2">指派司機：</p>
                            <div className="flex flex-wrap gap-2">
                              {drivers
                                .filter(d => d.status === 'ONLINE')
                                .map(driver => (
                                  <Button
                                    key={driver.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAssignDriver(order.id, driver.id)}
                                    disabled={actionLoading === order.id}
                                    className="border-white/20 text-[#a0a0a0] hover:bg-white/10 hover:text-white"
                                  >
                                    {driver.user.name} ({driver.licensePlate})
                                  </Button>
                                ))}
                              {drivers.filter(d => d.status === 'ONLINE').length === 0 && (
                                <p className="text-xs text-[#444]">目前沒有在線司機</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Assigned Driver */}
                        {order.driver && (
                          <div className="border-t border-white/5 pt-4">
                            <Badge variant="info" className="bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30">
                              <UserCheck className="w-3 h-3 inline mr-1" /> {order.driver.user.name} ({order.driver.licensePlate})
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Batch Create Tab */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                {/* Defaults Selection */}
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-[#ff8c42]" /> 批次建單 - 設定預設值
                    </h3>
                    <p className="text-sm text-[#666] mt-1">選擇預設值後，貼上的所有訂單都會套用這些設定</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-[#a0a0a0] font-medium">價格（統一）</label>
                        <select
                          value={defaults.price || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, price: parseInt(e.target.value) || undefined }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                        >
                          {PRICE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-[#a0a0a0] font-medium">日期（統一）</label>
                        <select
                          value={defaults.date || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                        >
                          {DATE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-[#a0a0a0] font-medium">車型要求</label>
                        <select
                          value={defaults.carType || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, carType: e.target.value }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                        >
                          {CAR_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-[#a0a0a0] font-medium">人數（統一）</label>
                        <select
                          value={defaults.passengerCount || 1}
                          onChange={(e) => setDefaults(prev => ({ ...prev, passengerCount: parseInt(e.target.value) }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                        >
                          {PASSENGER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text Input */}
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#ff8c42]" /> 貼上訂單文字
                    </h3>
                    <p className="text-sm text-[#666] mt-1">
                      每行一筆訂單，格式：<code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">時間 上下車地點 /備註</code>
                    </p>
                  </div>
                  <div className="p-6">
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder={`範例：
0400 內湖送桃機
0400 松山送桃機/休旅
0410 文山送桃機/休旅
0430 新竹東區送桃機/休旅 $1000
1545 桃機接萬華 $700
...`}
                      className="w-full h-48 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-[#ff8c42]/50 resize-none placeholder-[#444]"
                    />
                    <Button
                      onClick={handleParseBatch}
                      className="mt-4 w-full bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
                      size="lg"
                    >
                      解析並進入審核
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Review Tab */}
            {activeTab === 'review' && (
              <div className="space-y-6">
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Search className="w-4 h-4 text-[#ff8c42]" /> 審核清單 ({reviewItems.length} 筆)
                    </h3>
                    <p className="text-sm text-[#666] mt-1">請確認每一筆訂單的資訊，確認無誤後點擊「發布」按鈕</p>
                  </div>
                  <div className="p-6">
                    {reviewItems.length === 0 ? (
                      <p className="text-center text-[#666] py-8">暫無待審核的訂單</p>
                    ) : (
                      <div className="space-y-4">
                        {reviewItems.map((item, idx) => (
                          <div key={item.reviewId} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                            {editingId === item.reviewId ? (
                              // Edit mode
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-white">編輯訂單 #{idx + 1}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs text-[#666]">時間 (HH:mm)</label>
                                    <input
                                      type="text"
                                      value={editForm.scheduledTime || ''}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-[#666]">價格</label>
                                    <select
                                      value={editForm.price || ''}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, price: parseInt(e.target.value) }))}
                                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                    >
                                      {PRICE_OPTIONS.filter(p => p.value > 0).map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-[#666]">上車地點</label>
                                  <input
                                    type="text"
                                    value={editForm.pickupLocation || ''}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, pickupLocation: e.target.value }))}
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-[#666]">下下地點</label>
                                  <input
                                    type="text"
                                    value={editForm.dropoffLocation || ''}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, dropoffLocation: e.target.value }))}
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-[#666]">備註</label>
                                  <input
                                    type="text"
                                    value={editForm.note || ''}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={() => handleSaveEdit(item.reviewId)} size="sm" className="bg-[#ff8c42] hover:bg-[#ff9d5c] text-black">
                                    儲存
                                  </Button>
                                  <Button variant="outline" onClick={() => setEditingId(null)} size="sm" className="border-white/20 text-[#666] hover:bg-white/10">
                                    取消
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // View mode
                              <div>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[#666]">#{idx + 1}</span>
                                    {item.orderType === 'pickup' ? (
                                      <Badge className="bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30">接機</Badge>
                                    ) : item.orderType === 'dropoff' ? (
                                      <Badge className="bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30">送機</Badge>
                                    ) : null}
                                    <span className="text-xs text-[#444] font-mono">{item.rawText}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleEditItem(item)} className="border-white/20 text-[#666] hover:bg-white/10 text-xs py-1 px-2">
                                      編輯
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item.reviewId)} className="border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10 text-xs py-1 px-2">
                                      刪除
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mb-3">
                                  <div>
                                    <p className="text-xs text-[#666]">時間</p>
                                    <p className="font-mono font-medium text-[#e0e0e0]">
                                      {item.editedTime || item.scheduledTime || '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666]">費用</p>
                                    <p className="font-bold" style={{ color: '#ff8c42' }}>
                                      NT${item.editedPrice || item.price || defaults.price || 800}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666]">車型</p>
                                    <p className="font-medium text-[#e0e0e0]">
                                      {item.note?.includes('休旅') || defaults.carType === '休旅車' ? '休旅車' : '小車'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-sm">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                                    <span className="text-[#e0e0e0]">{item.editedPickup || item.pickupLocation || '-'}</span>
                                  </div>
                                  <span className="text-[#666]">→</span>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                                    <span className="text-[#e0e0e0]">{item.editedDropoff || item.dropoffLocation || '-'}</span>
                                  </div>
                                </div>

                                {(item.editedNote || item.note) && (
                                  <p className="text-xs text-[#888] italic mt-2 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> {item.editedNote || item.note}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {reviewItems.length > 0 && (
                          <div className="flex gap-4 pt-4 border-t border-white/5">
                            <Button
                              onClick={handlePublishOrders}
                              loading={createLoading}
                              size="lg"
                              className="flex-1 bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
                            >
                              發布 {reviewItems.length} 筆訂單
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setActiveTab('create')}
                              size="lg"
                              className="border-white/20 text-[#666] hover:bg-white/10 hover:text-white"
                            >
                              繼續新增
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Drivers Tab */}
            {activeTab === 'drivers' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers.length === 0 ? (
                  <div className="col-span-full text-center py-24 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                    <p className="text-[#a0a0a0] mb-2 text-lg">目前沒有司機資料</p>
                  </div>
                ) : (
                  drivers.map(driver => (
                    <div key={driver.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-medium text-white">{driver.user.name}</p>
                          <p className="text-sm text-[#666]">{driver.user.phone}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          driver.status === 'ONLINE'
                            ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                            : 'bg-white/10 text-[#666] border border-white/10'
                        }`}>
                          {driver.status === 'ONLINE' ? '在線' : driver.status}
                        </span>
                      </div>
                      <div className="text-sm text-[#a0a0a0] space-y-1">
                        <p className="flex items-center gap-2"><Car className="w-4 h-4 text-[#ff8c42]" /> {driver.licensePlate}</p>
                        <p>{driver.carType} / {driver.carColor}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Settlement Tab */}
            {activeTab === 'settlement' && (
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#ff8c42]" /> 對帳表
                  </h3>
                  <p className="text-sm text-[#666] mt-1">查看已完成行程的帳務概況和司機轉帳清單</p>
                </div>
                <div className="p-12 text-center">
                  <p className="text-[#666]">功能開發中...</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
