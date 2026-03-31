'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { parseBatchOrders, ParsedOrder, BatchOrderDefaults, TYPE_LABELS } from '@/lib/ai'
import { DispatcherOrderCard } from '@/components/dispatcher/OrderCard'
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
  Calendar,
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
  kenichiRequired?: boolean
  driver?: { user: { name: string }; licensePlate: string; carType: string; carColor: string } | null
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
  editedVehicleCustom?: string
  editedPlateType?: string
  editedKenichi?: boolean
}

// Date options - label shows M/D, value is YYYY-MM-DD
const DATE_OPTIONS = [
  { value: '', label: '選擇日期...' },
]

// Generate date options for next 14 days (label shows M/D, no year)
for (let i = 0; i <= 14; i++) {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const dateStr = format(d, 'yyyy-MM-dd')
  const dayLabel = i === 0 ? '今天' : i === 1 ? '明天' : format(d, 'M/d (EEE)', { locale: zhTW })
  DATE_OPTIONS.push({ value: dateStr, label: dayLabel })
}

// 將 UI 顯示字串轉為 API vehicle enum
function vehicleDisplayToEnum(v?: string): string {
  if (!v) return 'any'
  const map: Record<string, string> = {
    '任意車': 'any',
    '小車': 'small',
    '休旅': 'suv',
    '7人座': 'van9',
    '9人座': 'van9',
    'VITO': 'van9',
    'GRANVIA': 'suv',
  }
  return map[v] || 'any'
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

// Car type options for dispatcher selection
const VEHICLE_OPTIONS = [
  '任意車', '小車', '休旅', '7人座', '9人座', 'VITO', 'GRANVIA', '自填',
] as const
type VehicleOption = typeof VEHICLE_OPTIONS[number]

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
  const [defaults, setDefaults] = useState<Omit<BatchOrderDefaults, 'vehicle' | 'kenichiRequired'> & { vehicle?: string; vehicleCustom?: string; kenichiRequired?: boolean }>({
    date: '',
    vehicle: '任意車',
    vehicleCustom: '',
    kenichiRequired: false,
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
    editedVehicle?: string
    editedVehicleCustom?: string
  }>({})
  const [createLoading, setCreateLoading] = useState(false)
  const [publishResult, setPublishResult] = useState<{ success: number; failed: number } | null>(null)

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

  const handleParseBatch = async () => {
    if (!rawText.trim()) return
    if (!defaults.date) {
      alert('請選擇日期')
      return
    }

    setCreateLoading(true)
    try {
      const res = await fetch('/api/orders/parse', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawText, defaults }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || '解析失敗')
        return
      }
      const parsed = data.data?.orders || []

      // Convert to review items with unique IDs, apply batch vehicle type and kenichi
      const batchVehicle = defaults.vehicle === '自填' ? defaults.vehicleCustom : defaults.vehicle
      const items: ReviewItem[] = parsed.map((p: any) => ({
        ...p,
        reviewId: generateId(),
        editedVehicle: batchVehicle,
        editedVehicleCustom: '',
        editedKenichi: defaults.kenichiRequired || false,
      }))

      setReviewItems(items)
      setActiveTab('review')
    } catch (e: any) {
      alert('解析失敗：' + e.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEditItem = (item: ReviewItem) => {
    setEditingId(item.reviewId)
    setEditForm({
      price: item.price ?? 800,
      scheduledTime: item.time || undefined,
      pickupLocation: item.pickupLocation || undefined,
      dropoffLocation: item.dropoffLocation || undefined,
      note: item.notes || undefined,
      editedVehicle: item.editedVehicle || '',
      editedVehicleCustom: item.editedVehicleCustom || '',
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
              editedVehicle: editForm.editedVehicle === '自填' ? editForm.editedVehicleCustom : editForm.editedVehicle,
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
      let successCount = 0
      let failedCount = 0
      for (const item of reviewItems) {
        const scheduledDateTime = `${orderDate}T${item.editedTime || item.time}:00`

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            passengerName: '待確認',
            passengerPhone: '待確認',
            pickupLocation: item.editedPickup || item.pickupLocation || '',
            pickupAddress: item.editedPickup || item.pickupLocation || '',
            dropoffLocation: item.editedDropoff || item.dropoffLocation || '',
            dropoffAddress: item.editedDropoff || item.dropoffLocation || '',
            passengerCount: 1,
            luggageCount: 0,
            scheduledTime: scheduledDateTime,
            price: item.editedPrice ?? item.price ?? 800,
            type: item.editedType || item.type || 'pending',
            vehicle: (() => {
              const raw = item.editedVehicle === '自填' ? item.editedVehicleCustom : item.editedVehicle || (defaults.vehicle === '自填' ? defaults.vehicleCustom : defaults.vehicle)
              const map: Record<string, string> = {
                '任意車': 'any', '小車': 'small', '休旅': 'suv',
                '7人座': 'van9', '9人座': 'van9', 'VITO': 'van9', 'GRANVIA': 'suv',
              }
              const converted = raw ? (map[raw] || 'any') : 'any'
              console.log('[publish] vehicle raw:', raw, '→', converted)
              return converted
            })(),
            plateType: item.editedPlateType || item.plateType || 'any',
            notes: item.editedNotes || item.notes || '',
            note: '',
            rawText: item.rawText || '',
            kenichiRequired: item.editedKenichi || false,
          }),
        })
        const data = await res.json()
        if (data.success) {
          successCount++
        } else {
          failedCount++
        }
      }

      setRawText('')
      setReviewItems([])
      setPublishResult({ success: successCount, failed: failedCount })
      fetchOrders()
    } catch (error) {
      console.error('Failed to create orders:', error)
      setPublishResult({ success: 0, failed: reviewItems.length })
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
                  orders.map(order => (
                    <DispatcherOrderCard
                      key={order.id}
                      order={order}
                      onEdit={openEditModal}
                      onDelete={handleDeleteOrder}
                    />
                  ))
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
                      <ClipboardList className="w-4 h-4 text-[#ff8c42]" /> 派單中心 - AI 智能解析
                    </h3>
                    <p className="text-sm text-[#666] mt-1">選擇日期與車型後，AI 會自動解析訂單。時間、種類、地點、金額全部由 AI 處理。</p>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* 日期 */}
                    <div className="space-y-2">
                      <label className="text-sm text-[#a0a0a0] font-medium">日期（必選）</label>
                      <div className="relative">
                        <select
                          value={defaults.date || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50 cursor-pointer"
                        >
                          {DATE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666] pointer-events-none" />
                      </div>
                    </div>

                    {/* 車型勾選 */}
                    <div className="space-y-2">
                      <label className="text-sm text-[#a0a0a0] font-medium">車型（勾選後套用到此批所有訂單）</label>
                      <div className="flex flex-wrap gap-2">
                        {VEHICLE_OPTIONS.filter(v => v !== '自填').map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setDefaults(prev => ({ ...prev, vehicle: v, vehicleCustom: '' }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              defaults.vehicle === v
                                ? 'bg-[#ff8c42] text-black border border-[#ff8c42]'
                                : 'bg-[#0a0a0a] text-[#a0a0a0] border border-white/10 hover:border-white/20'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                        {/* 自填 */}
                        <button
                          type="button"
                          onClick={() => setDefaults(prev => ({ ...prev, vehicle: '自填' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            defaults.vehicle === '自填'
                              ? 'bg-[#ff8c42] text-black border border-[#ff8c42]'
                              : 'bg-[#0a0a0a] text-[#a0a0a0] border border-white/10 hover:border-white/20'
                          }`}
                        >
                          自填
                        </button>
                      </div>
                      {defaults.vehicle === '自填' && (
                        <input
                          type="text"
                          value={defaults.vehicleCustom || ''}
                          onChange={(e) => setDefaults(prev => ({ ...prev, vehicleCustom: e.target.value }))}
                          placeholder="輸入車型"
                          className="mt-1 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff8c42]/50 w-full max-w-xs"
                        />
                      )}
                    </div>

                    {/* 肯驛勾選 */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDefaults(prev => ({ ...prev, kenichiRequired: !prev.kenichiRequired }))}
                        className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                          defaults.kenichiRequired ? 'bg-[#a855f7] border-[#a855f7]' : 'bg-[#0a0a0a] border-white/20'
                        }`}
                      >
                        {defaults.kenichiRequired && (
                          <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <span className="text-xs text-[#a855f7]">肯驛系統</span>
                      <span className="text-xs text-[#666]">（勾選後，此批訂單會標記為肯驛單）</span>
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
                                {/* 車型選擇 */}
                                <div className="space-y-1">
                                  <label className="text-xs text-[#666]">車型</label>
                                  <div className="flex flex-wrap gap-1.5">
                                    {VEHICLE_OPTIONS.filter(v => v !== '自填').map(v => (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setEditForm(prev => ({ ...prev, editedVehicle: v, editedVehicleCustom: '' }))}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                                          editForm.editedVehicle === v
                                            ? 'bg-[#ff8c42] text-black border border-[#ff8c42]'
                                            : 'bg-[#0a0a0a] text-[#a0a0a0] border border-white/10 hover:border-white/20'
                                        }`}
                                      >
                                        {v}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setEditForm(prev => ({ ...prev, editedVehicle: '自填' }))}
                                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                                        editForm.editedVehicle === '自填'
                                          ? 'bg-[#ff8c42] text-black border border-[#ff8c42]'
                                          : 'bg-[#0a0a0a] text-[#a0a0a0] border border-white/10 hover:border-white/20'
                                      }`}
                                    >
                                      自填
                                    </button>
                                  </div>
                                  {editForm.editedVehicle === '自填' && (
                                    <input
                                      type="text"
                                      value={editForm.editedVehicleCustom || ''}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, editedVehicleCustom: e.target.value }))}
                                      placeholder="輸入車型"
                                      className="mt-1 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs w-full"
                                    />
                                  )}
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
                                      item.editedVehicle?.includes('9人座') || item.editedVehicle?.includes('VITO') ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
                                      : item.editedVehicle?.includes('休旅') || item.editedVehicle?.includes('GRANVIA') || item.editedVehicle?.includes('7人座') ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30'
                                      : item.editedVehicle?.includes('小車') ? 'bg-white/10 text-[#e0e0e0] border-white/20'
                                      : 'bg-white/10 text-[#a0a0a0] border-white/20'
                                    }>
                                      {item.editedVehicle || '待確認'}
                                    </Badge>
                                    {(item as any).editedKenichi ? (
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
                                      NT${item.editedPrice ?? item.price ?? 800}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666]">車型</p>
                                    <p className="font-medium text-[#e0e0e0]">
                                      {item.editedVehicle || '待確認'}
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

      {/* Publish Result Modal */}
      {publishResult && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-sm mx-4 text-center p-8">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
              publishResult.failed === 0
                ? 'bg-[#22c55e]/20'
                : 'bg-[#f59e0b]/20'
            }`}>
              {publishResult.failed === 0 ? (
                <svg className="w-8 h-8 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {publishResult.failed === 0
                ? `成功發布 ${publishResult.success} 筆訂單`
                : `發布完成：${publishResult.success} 成功、${publishResult.failed} 失敗`}
            </h3>
            <p className="text-sm text-[#666] mb-6">
              {publishResult.failed === 0
                ? '司機已可在接單牆看到這些行程'
                : '部分訂單發布失敗，請稍後重試'}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setPublishResult(null)}
                className="flex-1 bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-semibold"
              >
                前往行控中心
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPublishResult(null)
                  setActiveTab('create')
                }}
                className="flex-1 border-white/20 text-[#666] hover:bg-white/10 hover:text-white"
              >
                繼續派單
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
