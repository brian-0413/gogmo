'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { parseBatchOrders, ParsedOrder, BatchOrderDefaults } from '@/lib/ai'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">載入中...</p>
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
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">🏢 {user.dispatcher?.companyName || '車頭專區'}</h1>
              <p className="text-sm text-slate-600">{user.name}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              登出
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{statusCounts.PUBLISHED}</p>
              <p className="text-xs text-amber-600">待搶單</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{statusCounts.ACTIVE}</p>
              <p className="text-xs text-blue-600">進行中</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-600">{statusCounts.COMPLETED}</p>
              <p className="text-xs text-green-600">已完成</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-[140px] z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'orders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600'
              }`}
            >
              📋 訂單管理
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'create'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600'
              }`}
            >
              ➕ 批次建單
            </button>
            {reviewItems.length > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className={`px-4 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'review'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600'
                }`}
              >
                🔍 審核清單 ({reviewItems.length})
              </button>
            )}
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'drivers'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600'
              }`}
            >
              👨‍✈️ 司機列表
            </button>
            <button
              onClick={() => setActiveTab('settlement')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'settlement'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600'
              }`}
            >
              💰 對帳表
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : (
          <>
            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <p className="text-slate-500">還沒有訂單</p>
                      <Button className="mt-4" onClick={() => setActiveTab('create')}>
                        建立第一筆訂單
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  orders.map(order => (
                    <Card key={order.id} variant="elevated">
                      <CardContent>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-blue-600">
                              NT${order.price}
                            </span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">#{order.id.slice(0, 8)}</p>
                            <p className="text-xs text-slate-400">
                              {order.scheduledTime ? format(parseISO(order.scheduledTime), 'MM/dd HH:mm', { locale: zhTW }) : '-'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-slate-500">航班</p>
                            <p className="font-mono font-medium">{order.flightNumber || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">時間</p>
                            <p className="font-medium">
                              {order.scheduledTime ? format(parseISO(order.scheduledTime), 'HH:mm') : '-'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm truncate">{order.pickupLocation}</span>
                          </div>
                          <span className="text-slate-400">→</span>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm truncate">{order.dropoffLocation}</span>
                          </div>
                        </div>

                        <div className="text-sm text-slate-600 mb-3">
                          👤 {order.passengerName || '待確認'} • 📞 {order.passengerPhone || '待確認'}
                        </div>

                        {order.note && (
                          <div className="text-xs text-slate-500 italic mb-3 bg-slate-50 p-2 rounded">
                            📝 {order.note}
                          </div>
                        )}

                        {/* Assign Driver Section */}
                        {order.status === 'PUBLISHED' && (
                          <div className="border-t border-slate-100 pt-3">
                            <p className="text-xs text-slate-500 mb-2">指派司機：</p>
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
                                  >
                                    {driver.user.name} ({driver.licensePlate})
                                  </Button>
                                ))}
                              {drivers.filter(d => d.status === 'ONLINE').length === 0 && (
                                <p className="text-xs text-slate-400">目前沒有在線司機</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Assigned Driver */}
                        {order.driver && (
                          <div className="border-t border-slate-100 pt-3">
                            <Badge variant="info">
                              👨‍✈️ {order.driver.user.name} ({order.driver.licensePlate})
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Batch Create Tab */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                {/* Defaults Selection */}
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>📋 批次建單 - 設定預設值</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                      選擇預設值後，貼上的所有訂單都會套用這些設定
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          價格（統一）
                        </label>
                        <select
                          value={defaults.price || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, price: parseInt(e.target.value) || undefined }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {PRICE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          日期（統一）
                        </label>
                        <select
                          value={defaults.date || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {DATE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          車型要求
                        </label>
                        <select
                          value={defaults.carType || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, carType: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CAR_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          人數（統一）
                        </label>
                        <select
                          value={defaults.passengerCount || 1}
                          onChange={(e) => setDefaults(prev => ({ ...prev, passengerCount: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {PASSENGER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Text Input */}
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>📝 貼上訂單文字</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                      每行一筆訂單，格式：<code className="bg-slate-100 px-1 rounded">時間 上下車地點 /備註</code>
                    </p>
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
                      className="w-full h-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <Button onClick={handleParseBatch} className="mt-4 w-full" size="lg">
                      解析並進入審核
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Review Tab */}
            {activeTab === 'review' && (
              <div className="space-y-6">
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>🔍 審核清單 ({reviewItems.length} 筆)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                      請確認每一筆訂單的資訊，確認無誤後點擊「發布」按鈕
                    </p>

                    {reviewItems.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">暫無待審核的訂單</p>
                    ) : (
                      <div className="space-y-4">
                        {reviewItems.map((item, idx) => (
                          <div key={item.reviewId} className="border border-slate-200 rounded-lg p-4">
                            {editingId === item.reviewId ? (
                              // Edit mode
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">編輯訂單 #{idx + 1}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <Input
                                    label="時間 (HH:mm)"
                                    value={editForm.scheduledTime || ''}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                                  />
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">價格</label>
                                    <select
                                      value={editForm.price || ''}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, price: parseInt(e.target.value) }))}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    >
                                      {PRICE_OPTIONS.filter(p => p.value > 0).map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <Input
                                  label="上車地點"
                                  value={editForm.pickupLocation || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, pickupLocation: e.target.value }))}
                                />
                                <Input
                                  label="下地點"
                                  value={editForm.dropoffLocation || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, dropoffLocation: e.target.value }))}
                                />
                                <Input
                                  label="備註"
                                  value={editForm.note || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                                />
                                <div className="flex gap-2">
                                  <Button onClick={() => handleSaveEdit(item.reviewId)} size="sm">
                                    儲存
                                  </Button>
                                  <Button variant="outline" onClick={() => setEditingId(null)} size="sm">
                                    取消
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // View mode
                              <div>
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-500">#{idx + 1}</span>
                                    {/* Order Type Badge */}
                                    {item.orderType === 'pickup' ? (
                                      <Badge variant="success">接機</Badge>
                                    ) : item.orderType === 'dropoff' ? (
                                      <Badge variant="danger">送機</Badge>
                                    ) : null}
                                    <span className="text-xs text-slate-400 font-mono">{item.rawText}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                                      編輯
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteItem(item.reviewId)}>
                                      刪除
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs text-slate-500">時間</p>
                                    <p className="font-mono font-medium">
                                      {item.editedTime || item.scheduledTime || '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">費用</p>
                                    <p className="font-bold text-blue-600">
                                      NT${item.editedPrice || item.price || defaults.price || 800}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">車型</p>
                                    <p className="font-medium">
                                      {item.note?.includes('休旅') || defaults.carType === '休旅車' ? '休旅車' : '小車'}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-sm">{item.editedPickup || item.pickupLocation || '-'}</span>
                                  </div>
                                  <span className="text-slate-400">→</span>
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-sm">{item.editedDropoff || item.dropoffLocation || '-'}</span>
                                  </div>
                                </div>

                                {(item.editedNote || item.note) && (
                                  <p className="text-xs text-slate-500 italic mt-2">
                                    📝 {item.editedNote || item.note}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {reviewItems.length > 0 && (
                          <div className="flex gap-4 pt-4 border-t border-slate-200">
                            <Button onClick={handlePublishOrders} loading={createLoading} size="lg" className="flex-1">
                              發布 {reviewItems.length} 筆訂單
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('create')} size="lg">
                              繼續新增
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Drivers Tab */}
            {activeTab === 'drivers' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers.length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="text-center py-12">
                      <p className="text-slate-500">目前沒有司機資料</p>
                    </CardContent>
                  </Card>
                ) : (
                  drivers.map(driver => (
                    <Card key={driver.id} variant="elevated">
                      <CardContent>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-slate-900">{driver.user.name}</p>
                            <p className="text-sm text-slate-600">{driver.user.phone}</p>
                          </div>
                          <Badge variant={driver.status === 'ONLINE' ? 'success' : 'default'}>
                            {driver.status === 'ONLINE' ? '在線' : driver.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-600">
                          <p>🚗 {driver.licensePlate}</p>
                          <p>{driver.carType} / {driver.carColor}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Settlement Tab */}
            {activeTab === 'settlement' && (
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>📊 對帳表</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    查看已完成行程的帳務概況和司機轉帳清單
                  </p>
                  <div className="mt-4 text-center py-8 text-slate-500">
                    功能開發中...
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
