'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { parseBatchOrders, ParsedOrder, BatchOrderDefaults, VEHICLE_LABELS, TYPE_LABELS } from '@/lib/ai'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import {
  ClipboardList,
  Plus,
  Search,
  Wallet,
  FileText,
  Car,
  Building2,
  User,
  Phone,
  Plane,
  LogOut,
  Radio,
  TrendingUp,
  Clock,
  Download,
  Pencil,
  Trash2,
  X,
  MapPin,
} from 'lucide-react'
import Link from 'next/link'

type Tab = 'orders' | 'create' | 'review' | 'drivers' | 'settlement'
type OrderStatus = 'PENDING' | 'PUBLISHED' | 'ASSIGNED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface Order {
  id: string
  status: OrderStatus
  type: string
  vehicle: string
  plateType: string
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
  notes?: string
  rawText?: string
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
  editedNotes?: string
  editedType?: string
  editedVehicle?: string
  editedPlateType?: string
  editedKenichi?: boolean
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
const VEHICLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'any', label: '任意車型' },
  { value: 'small', label: '小車（轎車）' },
  { value: 'suv', label: '休旅車' },
  { value: 'van9', label: '9人座' },
  { value: 'any_r', label: '任意R牌' },
]

// Plate type options
const PLATETYPE_OPTIONS = [
  { value: 'any', label: '任意車牌' },
  { value: 'R', label: 'R牌' },
  { value: 'T', label: 'T牌' },
]

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

// ========== Settlement Tab ==========
interface SettlementSummary {
  totalOrders: number
  totalRevenue: number
  totalPlatformFee: number
  totalNetRevenue: number
}

interface SettlementOrder {
  id: string
  price: number
  completedAt: string | Date
  createdAt: string | Date
  transferStatus: string
  driver?: {
    user: { name: string }
    licensePlate: string
    bankCode?: string
    bankAccount?: string
  }
}

interface SettlementData {
  allOrdersCount: number
  pendingTransferCount: number
  summary: SettlementSummary
  orders: SettlementOrder[]
  driverTransferList: never[]
}

function SettlementTab({ token }: { token: string | null }) {
  const [loading, setLoading] = useState(true)
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return format(d, 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const fetchSettlement = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/dispatchers/settlement?startDate=${startDate}&endDate=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()

      if (data.success) {
        setSettlementData(data.data)
      } else {
        setError(data.error || '載入失敗')
      }
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }, [token, startDate, endDate])

  useEffect(() => {
    if (token) {
      fetchSettlement()
    }
  }, [token, fetchSettlement])

  const handleDatePreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  const handleToggleTransfer = async (orderId: string, currentStatus: string) => {
    if (!token) return
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending'
    setTogglingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transferStatus: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        // Update local state
        setSettlementData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            pendingTransferCount: prev.orders.map(o =>
              o.id === orderId
                ? { ...o, transferStatus: newStatus }
                : o
            ).filter(o => o.transferStatus === 'pending').length,
            orders: prev.orders.map(o =>
              o.id === orderId ? { ...o, transferStatus: newStatus } : o
            ),
          }
        })
      }
    } catch {
      console.error('Failed to toggle transfer status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDownloadExcel = () => {
    if (!settlementData) return

    const rows = settlementData.orders.map(order => {
      const completedAt = order.completedAt
        ? format(
            typeof order.completedAt === 'string' ? parseISO(order.completedAt) : order.completedAt,
            'yyyy-MM-dd HH:mm'
          )
        : '-'
      return {
        '單號': order.id.slice(0, 8),
        '完成日期': completedAt,
        '司機': order.driver?.user?.name || '-',
        '車牌': order.driver?.licensePlate || '-',
        '金額': order.price,
        '銀行代碼': order.driver?.bankCode || '-',
        '銀行帳號': order.driver?.bankAccount ? `****${order.driver.bankAccount.slice(-4)}` : '-',
        '轉帳狀態': order.transferStatus === 'completed' ? '已轉帳' : '待轉帳',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '轉帳清單')

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 10 },
    ]

    XLSX.writeFile(wb, `轉帳清單_${startDate}_${endDate}.xlsx`)
  }

  if (!token) return null

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs text-[#666] mb-2 uppercase tracking-wider font-medium">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[#666] mb-2 uppercase tracking-wider font-medium">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDatePreset(7)}
              className="border-white/10 text-[#a0a0a0] hover:bg-white/10 hover:text-white text-xs"
            >
              近7天
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDatePreset(30)}
              className="border-white/10 text-[#a0a0a0] hover:bg-white/10 hover:text-white text-xs"
            >
              近30天
            </Button>
            <Button
              size="sm"
              onClick={fetchSettlement}
              loading={loading}
              className="bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-medium"
            >
              查詢
            </Button>
          </div>
        </div>
        <div className="mt-3 text-xs text-[#666]">
          查詢區間：{startDate} ~ {endDate}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-2 border-[#ff8c42] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-6 text-center">
          <p className="text-[#ef4444]">{error}</p>
        </div>
      ) : settlementData ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-[#3b82f6]/20 to-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-[#3b82f6] uppercase tracking-wider mb-2">總派出單數</p>
              <p className="text-3xl font-bold text-white">{settlementData.allOrdersCount}</p>
              <p className="text-xs text-[#666] mt-1">筆</p>
            </div>
            <div className="bg-gradient-to-br from-[#f59e0b]/20 to-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-[#f59e0b] uppercase tracking-wider mb-2">待轉帳筆數</p>
              <p className="text-3xl font-bold text-white">{settlementData.pendingTransferCount}</p>
              <p className="text-xs text-[#666] mt-1">筆</p>
            </div>
          </div>

          {/* Transfer List */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-[#e0e0e0]">司機轉帳清單</h3>
                <span className="text-xs text-[#666]">共 {settlementData.orders.length} 筆已完成行程</span>
              </div>
              <Button
                size="sm"
                onClick={handleDownloadExcel}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-medium flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                下載 Excel
              </Button>
            </div>

            {/* Table */}
            {settlementData.orders.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="w-12 h-12 text-[#333] mx-auto mb-3" />
                <p className="text-[#666]">此區間尚無完成的行程</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">單號</th>
                      <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">司機</th>
                      <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">車牌</th>
                      <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">日期</th>
                      <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">金額</th>
                      <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">轉帳資料</th>
                      <th className="text-center text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">轉帳情形</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementData.orders.map((order) => {
                      const completedAt = order.completedAt
                        ? format(
                            typeof order.completedAt === 'string'
                              ? parseISO(order.completedAt as string)
                              : order.completedAt,
                            'MM/dd HH:mm'
                          )
                        : '-'
                      const isPending = order.transferStatus === 'pending'

                      return (
                        <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-xs font-mono text-[#666]">#{order.id.slice(0, 8)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-[#e0e0e0]">
                              {order.driver?.user?.name || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#a0a0a0] font-mono">
                              {order.driver?.licensePlate || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#a0a0a0]">{completedAt}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-bold text-[#22c55e]">
                              NT${order.price.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-[#a0a0a0]">
                              {order.driver?.bankCode
                                ? <span className="text-[#666]">銀行：{order.driver.bankCode}</span>
                                : <span className="text-[#444]">未設定</span>}
                              {order.driver?.bankAccount && (
                                <span className="ml-2 font-mono">
                                  {order.driver.bankAccount.slice(0, 3)}****{order.driver.bankAccount.slice(-3)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleTransfer(order.id, order.transferStatus)}
                              disabled={togglingId === order.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                isPending
                                  ? 'bg-[#f59e0b]/20 text-[#f59e0b] hover:bg-[#f59e0b]/30 cursor-pointer'
                                  : 'bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/30 cursor-pointer'
                              } disabled:opacity-50`}
                            >
                              {togglingId === order.id ? (
                                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              ) : isPending ? (
                                <>
                                  <Clock className="w-3 h-3" />
                                  待轉帳
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="w-3 h-3" />
                                  已轉帳
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

export default function DispatcherDashboard() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  // Batch order defaults
  const [defaults, setDefaults] = useState<BatchOrderDefaults>({
    price: 800,
    vehicle: 'any',
    plateType: 'any',
    date: '',
    type: 'dropoff',
    kenichiRequired: false,
    flightNumber: '',
  })
  const [rawText, setRawText] = useState('')
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    price?: number
    scheduledTime?: string
    pickupLocation?: string
    dropoffLocation?: string
    note?: string
    kenichiRequired?: boolean
  }>({})
  const [createLoading, setCreateLoading] = useState(false)

  // Edit modal state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editOrderForm, setEditOrderForm] = useState({
    passengerName: '',
    passengerPhone: '',
    flightNumber: '',
    pickupLocation: '',
    dropoffLocation: '',
    passengerCount: 1,
    luggageCount: 0,
    scheduledTime: '',
    price: 0,
    note: '',
  })
  const [editSaving, setEditSaving] = useState(false)

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
      if (data.success) setOrders(data.data.orders || [])
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

  const openEditModal = (order: Order) => {
    const scheduled = order.scheduledTime ? parseISO(order.scheduledTime) : null
    setEditingOrder(order)
    setEditOrderForm({
      passengerName: order.passengerName || '',
      passengerPhone: order.passengerPhone || '',
      flightNumber: order.flightNumber || '',
      pickupLocation: order.pickupLocation || '',
      dropoffLocation: order.dropoffLocation || '',
      passengerCount: order.passengerCount || 1,
      luggageCount: order.luggageCount || 0,
      scheduledTime: scheduled ? format(scheduled, "yyyy-MM-dd'T'HH:mm") : '',
      price: order.price || 0,
      note: order.note || order.notes || '',
    })
  }

  const closeEditModal = () => {
    setEditingOrder(null)
    setEditOrderForm({
      passengerName: '',
      passengerPhone: '',
      flightNumber: '',
      pickupLocation: '',
      dropoffLocation: '',
      passengerCount: 1,
      luggageCount: 0,
      scheduledTime: '',
      price: 0,
      note: '',
    })
  }

  const handleSaveOrderEdit = async () => {
    if (!token || !editingOrder) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          passengerName: editOrderForm.passengerName,
          passengerPhone: editOrderForm.passengerPhone,
          flightNumber: editOrderForm.flightNumber,
          pickupLocation: editOrderForm.pickupLocation,
          dropoffLocation: editOrderForm.dropoffLocation,
          passengerCount: editOrderForm.passengerCount,
          luggageCount: editOrderForm.luggageCount,
          scheduledTime: editOrderForm.scheduledTime,
          price: editOrderForm.price,
          note: editOrderForm.note,
        }),
      })
      const data = await res.json()
      if (data.success) {
        closeEditModal()
        fetchOrders()
      } else {
        alert(data.error || '更新失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!token) return
    if (!confirm('確定要刪除這筆行程嗎？')) return
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ _action: 'delete' }),
      })
      const data = await res.json()
      if (data.success) {
        fetchOrders()
      } else {
        alert(data.error || '刪除失敗')
      }
    } catch {
      alert('網路錯誤')
    }
  }

  const handleParseBatch = () => {
    if (!rawText.trim()) return
    if (!defaults.date) {
      alert('請選擇日期')
      return
    }
    if (!defaults.type) {
      alert('請選擇種類（接機/送機/交通接駁/包車）')
      return
    }

    const parsed = parseBatchOrders(rawText, { ...defaults, type: defaults.type })

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
      scheduledTime: item.time || undefined,
      pickupLocation: item.pickupLocation || undefined,
      dropoffLocation: item.dropoffLocation || undefined,
      note: item.notes || undefined,
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
              editedNotes: editForm.note,
              editedKenichi: editForm.kenichiRequired,
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
        const scheduledDateTime = `${orderDate}T${item.editedTime || item.time}:00`

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
            passengerCount: 1,
            luggageCount: 0,
            scheduledTime: scheduledDateTime,
            price: item.editedPrice || item.price || defaults.price || 800,
            type: item.editedType || item.type || defaults.type || 'pending',
            vehicle: item.editedVehicle || item.vehicle || defaults.vehicle || 'any',
            plateType: item.editedPlateType || item.plateType || defaults.plateType || 'any',
            notes: item.editedNotes || item.notes || '',
            note: '',
            rawText: item.rawText || '',
            kenichiRequired: item.editedKenichi ?? defaults.kenichiRequired ?? false,
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
    PICKUP: orders.filter(o => o.type === 'pickup').length,
    DROPOFF: orders.filter(o => o.type === 'dropoff').length,
    PENDING: orders.filter(o => ['PENDING', 'PUBLISHED'].includes(o.status)).length,
    ACCEPTED: orders.filter(o => ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(o.status)).length,
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
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Plane className="w-3 h-3 text-[#22c55e]" />
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts.PICKUP}</p>
              <p className="text-xs text-[#666]">接機</p>
            </div>
            <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Plane className="w-3 h-3 text-[#3b82f6] rotate-90" />
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts.DROPOFF}</p>
              <p className="text-xs text-[#666]">送機</p>
            </div>
            <div className="bg-[#ff8c42]/10 border border-[#ff8c42]/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-[#ff8c42]" />
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts.PENDING}</p>
              <p className="text-xs text-[#666]">待接單</p>
            </div>
            <div className="bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-[#a855f7]" />
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts.ACCEPTED}</p>
              <p className="text-xs text-[#666]">已接單</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 bg-black/50 backdrop-blur-xl border-b border-white/5 sticky top-[152px]">
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
              <ClipboardList className="w-4 h-4" /> 行控中心
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <Plus className="w-4 h-4" /> 派單中心
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
              onClick={() => setActiveTab('settlement')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settlement'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <Wallet className="w-4 h-4" /> 帳務中心
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
              <>
                {/* Edit Modal */}
                {editingOrder && (
                  <dialog
                    open
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) closeEditModal() }}
                  >
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-[#1a1a1a] z-10">
                        <h3 className="text-lg font-semibold text-white">編輯行程 #{editingOrder.id.slice(0, 8)}</h3>
                        <button onClick={closeEditModal} className="text-[#666] hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs text-[#666]">乘客姓名</label>
                            <input
                              type="text"
                              value={editOrderForm.passengerName}
                              onChange={(e) => setEditOrderForm(prev => ({ ...prev, passengerName: e.target.value }))}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-[#666]">乘客電話</label>
                            <input
                              type="text"
                              value={editOrderForm.passengerPhone}
                              onChange={(e) => setEditOrderForm(prev => ({ ...prev, passengerPhone: e.target.value }))}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#666]">航班</label>
                          <input
                            type="text"
                            value={editOrderForm.flightNumber}
                            onChange={(e) => setEditOrderForm(prev => ({ ...prev, flightNumber: e.target.value }))}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#666]">上車地點</label>
                          <input
                            type="text"
                            value={editOrderForm.pickupLocation}
                            onChange={(e) => setEditOrderForm(prev => ({ ...prev, pickupLocation: e.target.value }))}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#666]">下地點</label>
                          <input
                            type="text"
                            value={editOrderForm.dropoffLocation}
                            onChange={(e) => setEditOrderForm(prev => ({ ...prev, dropoffLocation: e.target.value }))}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs text-[#666]">乘客人數</label>
                            <input
                              type="number"
                              min="1"
                              value={editOrderForm.passengerCount}
                              onChange={(e) => setEditOrderForm(prev => ({ ...prev, passengerCount: parseInt(e.target.value) || 1 }))}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-[#666]">行李件數</label>
                            <input
                              type="number"
                              min="0"
                              value={editOrderForm.luggageCount}
                              onChange={(e) => setEditOrderForm(prev => ({ ...prev, luggageCount: parseInt(e.target.value) || 0 }))}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-[#666]">價格</label>
                            <input
                              type="number"
                              min="0"
                              value={editOrderForm.price}
                              onChange={(e) => setEditOrderForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#666]">預定時間</label>
                          <input
                            type="datetime-local"
                            value={editOrderForm.scheduledTime}
                            onChange={(e) => setEditOrderForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#666]">備註</label>
                          <input
                            type="text"
                            value={editOrderForm.note}
                            onChange={(e) => setEditOrderForm(prev => ({ ...prev, note: e.target.value }))}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                          />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button
                            onClick={handleSaveOrderEdit}
                            loading={editSaving}
                            className="flex-1 bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-semibold"
                          >
                            儲存
                          </Button>
                          <Button
                            variant="outline"
                            onClick={closeEditModal}
                            className="flex-1 border-white/20 text-[#666] hover:bg-white/10 hover:text-white"
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    </div>
                  </dialog>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {orders.length === 0 ? (
                  <div className="col-span-full text-center py-24 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                    <p className="text-[#a0a0a0] mb-2 text-lg">還沒有訂單</p>
                    <Button className="mt-4 bg-[#ff8c42] hover:bg-[#ff9d5c] text-black" onClick={() => setActiveTab('create')}>
                      建立第一筆訂單
                    </Button>
                  </div>
                ) : (
                  orders.map(order => {
                    const isKenichi = (order.notes || order.note || order.rawText || '').toLowerCase().includes('kenichi') || (order.notes || order.note || order.rawText || '').includes('肯驛')
                    const typeColors: Record<string, string> = {
                      pickup: 'text-[#22c55e]',
                      dropoff: 'text-[#3b82f6]',
                      transfer: 'text-[#a855f7]',
                      charter: 'text-[#f59e0b]',
                    }
                    const typeLabels: Record<string, string> = {
                      pickup: '接機',
                      dropoff: '送機',
                      transfer: '交通接駁',
                      charter: '包車',
                    }
                    const airportKeywords = ['桃機', 'TPE', 'TSA', 'KHH', 'RMQ', '松山', '小港', '清泉', '桃園', '國際機場', '機場']
                    const inferType = (o: Order): { label: string; color: string } | null => {
                      const pickup = (o.pickupLocation || '').toLowerCase()
                      const dropoff = (o.dropoffLocation || '').toLowerCase()
                      const raw = (o.rawText || o.notes || o.note || '').toLowerCase()
                      const isAirport = (str: string) => airportKeywords.some(k => str.includes(k.toLowerCase()))
                      // 優先以地點是否為機場判斷
                      if (isAirport(dropoff)) return { label: '送機', color: 'text-[#3b82f6]' }
                      if (isAirport(pickup)) return { label: '接機', color: 'text-[#22c55e]' }
                      // 其次以文字是否含「送/接」判斷
                      if (raw.includes('送')) return { label: '送機', color: 'text-[#3b82f6]' }
                      if (raw.includes('接')) return { label: '接機', color: 'text-[#22c55e]' }
                      return null
                    }
                    const inferred = inferType(order)
                    const displayType = order.type && typeLabels[order.type]
                      ? { label: typeLabels[order.type], color: typeColors[order.type] || 'text-[#888]' }
                      : inferred || { label: '待確認', color: 'text-[#888]' }

                    return (
                    <div key={order.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 hover:border-white/20 transition-all">
                      {/* Type title */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-lg font-bold ${displayType.color}`}>
                          {displayType.label}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(order)}
                            className="p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-white/10 transition-colors"
                            title="編輯"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-1.5 rounded-lg text-[#666] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Row 1: ID + Price + Type badge + Status + Kenichi */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[#666] font-mono">#{order.id.slice(0, 8)}</span>
                        <span className="text-base font-bold" style={{ color: '#ff8c42' }}>NT${order.price.toLocaleString()}</span>
                        {/* Status badge */}
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          ['PENDING', 'PUBLISHED'].includes(order.status) ? 'bg-[#ff8c42]/20 text-[#ff8c42] border border-[#ff8c42]/30'
                          : ['ASSIGNED', 'ACCEPTED'].includes(order.status) ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30'
                          : order.status === 'ARRIVED' ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30'
                          : order.status === 'IN_PROGRESS' ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                          : order.status === 'COMPLETED' ? 'bg-white/10 text-[#666] border border-white/10'
                          : 'bg-white/10 text-[#888] border border-white/20'
                        }`}>
                          {order.status === 'PENDING' ? '待接單' : order.status === 'PUBLISHED' ? '待接單' : order.status === 'ASSIGNED' ? '已指派' : order.status === 'ACCEPTED' ? '已接單' : order.status === 'ARRIVED' ? '已抵達' : order.status === 'IN_PROGRESS' ? '進行中' : order.status === 'COMPLETED' ? '已完成' : order.status === 'CANCELLED' ? '已取消' : order.status}
                        </span>
                        {isKenichi && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30">
                            肯驛
                          </span>
                        )}
                      </div>
                      {/* Row 2: Pickup → Dropoff */}
                      <div className="flex items-center gap-2 mt-2 text-xs text-[#a0a0a0]">
                        <MapPin className="w-3 h-3 text-[#22c55e] flex-shrink-0" />
                        <span className="truncate flex-1">{order.pickupLocation}</span>
                        <span className="text-[#666] flex-shrink-0">→</span>
                        <span className="truncate flex-1 text-right">{order.dropoffLocation}</span>
                      </div>
                      {/* Row 3: Time + Driver */}
                      <div className="flex items-center justify-between mt-1 text-xs text-[#a0a0a0]">
                        <span className="text-[#444] font-mono">
                          {order.scheduledTime ? format(parseISO(order.scheduledTime), 'MM/dd HH:mm', { locale: zhTW }) : '-'}
                        </span>
                        <span>
                          {order.driver ? (
                            <span className="truncate">{order.driver.user.name} ({order.driver.licensePlate})</span>
                          ) : (
                            <span className="text-[#444]">待指派</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )})
                )}
              </div>
              </>
            )}

            {/* Batch Create Tab */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                {/* Defaults Selection */}
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-[#ff8c42]" /> 派單中心 - 設定預設值
                    </h3>
                    <p className="text-sm text-[#666] mt-1">必選欄位沒填完無法解析訂單，選擇預設值後，貼上的所有訂單都會套用這些設定</p>
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Row 1: Date + Type */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-[#a0a0a0] font-medium">日期（必選）</label>
                        <input
                          type="date"
                          value={defaults.date || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-[#a0a0a0] font-medium">種類（必選，整批統一）</label>
                        <div className="grid grid-cols-4 gap-1">
                          {([
                            { value: 'pickup', label: '接機' },
                            { value: 'dropoff', label: '送機' },
                            { value: 'transfer', label: '交通接駁' },
                            { value: 'charter', label: '包車' },
                          ] as const).map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setDefaults(prev => ({ ...prev, type: opt.value }))}
                              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border ${
                                defaults.type === opt.value
                                  ? 'bg-[#ff8c42] text-black border-[#ff8c42]'
                                  : 'bg-[#0a0a0a] text-[#666] border-white/10 hover:border-white/20 hover:text-[#a0a0a0]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Price + Vehicle + PlateType */}
                    <div className="grid grid-cols-3 gap-4">
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
                        <label className="text-sm text-[#a0a0a0] font-medium">車型要求</label>
                        <select
                          value={defaults.vehicle || 'any'}
                          onChange={(e) => setDefaults(prev => ({ ...prev, vehicle: e.target.value as BatchOrderDefaults['vehicle'] }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                        >
                          {VEHICLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-[#a0a0a0] font-medium">車牌限制</label>
                        <select
                          value={defaults.plateType || 'any'}
                          onChange={(e) => setDefaults(prev => ({ ...prev, plateType: e.target.value as BatchOrderDefaults['plateType'] }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50"
                        >
                          {PLATETYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Kenichi checkbox */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={defaults.kenichiRequired || false}
                            onChange={(e) => setDefaults(prev => ({ ...prev, kenichiRequired: e.target.checked }))}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border transition-all ${
                            defaults.kenichiRequired
                              ? 'bg-[#a855f7] border-[#a855f7]'
                              : 'bg-[#0a0a0a] border-white/20 hover:border-white/40'
                          }`}>
                            {defaults.kenichiRequired && (
                              <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-[#a0a0a0]">
                          <span className="text-[#a855f7] font-medium">肯驛系統</span>
                          <span className="text-[#666]">（勾選後，此批訂單會標記為肯驛單，只有肯驛名單內的司機可以接單）</span>
                        </span>
                      </label>
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
                      每行一筆訂單，格式：<code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">時間 地點 送機/接機 /車型 /備註</code>
                    </p>
                  </div>
                  <div className="p-6">
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder={`範例：
0400 內湖送桃機
0400 松山送桃機/休旅
0430 新竹東區送桃機/9座 $1000
2310 tr875 接北屯+北區 任意車2000
1545 桃機接萬華 任意R 800
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
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editForm.kenichiRequired || false}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, kenichiRequired: e.target.checked }))}
                                      className="sr-only"
                                    />
                                    <div className={`w-4 h-4 rounded border transition-all ${
                                      editForm.kenichiRequired ? 'bg-[#a855f7] border-[#a855f7]' : 'bg-[#1a1a1a] border-white/20'
                                    }`}>
                                      {editForm.kenichiRequired && (
                                        <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
                                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      )}
                                    </div>
                                    <span className="text-xs text-[#a855f7]">肯驛系統</span>
                                  </label>
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
                                    <Badge className={
                                      item.type === 'pickup' ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30'
                                      : item.type === 'dropoff' ? 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30'
                                      : item.type === 'transfer' ? 'bg-[#a855f7]/20 text-[#a855f7] border-[#a855f7]/30'
                                      : item.type === 'charter' ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30'
                                      : 'bg-white/10 text-[#888] border-white/20'
                                    }>
                                      {TYPE_LABELS[item.type] || '待確認'}
                                    </Badge>
                                    <Badge className={
                                      item.vehicle === 'van9' ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
                                      : item.vehicle === 'suv' ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30'
                                      : item.vehicle === 'small' ? 'bg-white/10 text-[#e0e0e0] border-white/20'
                                      : item.vehicle === 'any_r' ? 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30'
                                      : 'bg-white/10 text-[#a0a0a0] border-white/20'
                                    }>
                                      {VEHICLE_LABELS[item.vehicle] || '待確認'}
                                      {item.plateType && item.plateType !== 'any' ? ` (${item.plateType}牌)` : ''}
                                    </Badge>
                                    {(item as any).editedKenichi || defaults.kenichiRequired ? (
                                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30">肯驛</span>
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
                                      {item.editedTime || item.time || '-'}
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
                                      {VEHICLE_LABELS[item.vehicle] || '待確認'}
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

                                {(item.editedNotes || item.notes) && (
                                  <p className="text-xs text-[#888] italic mt-2 flex items-start gap-1">
                                    <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" /> {item.editedNotes || item.notes}
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

            {/* Drivers Tab - removed, redirect to orders */}
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
              <SettlementTab token={token} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
