'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { parseBatchOrders, ParsedOrder, BatchOrderDefaults, TYPE_LABELS } from '@/lib/ai'
import { DispatcherOrderCard } from '@/components/dispatcher/OrderCard'
import { FleetControl } from '@/components/dispatcher/FleetControl'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import {
  ClipboardList,
  Plus,
  Search,
  Wallet,
  FileText,
  Building2,
  Plane,
  LogOut,
  Radio,
  TrendingUp,
  Clock,
  Download,
  X,
  Calendar,
  Users,
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

const DATE_OPTIONS = [
  { value: '', label: '選擇日期...' },
]

for (let i = 0; i <= 14; i++) {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const dateStr = format(d, 'yyyy-MM-dd')
  const dayLabel = i === 0 ? '今天' : i === 1 ? '明天' : format(d, 'M/d (EEE)', { locale: zhTW })
  DATE_OPTIONS.push({ value: dateStr, label: dayLabel })
}

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

const VEHICLE_OPTIONS = [
  '任意車', '小車', '休旅', '7人座', '9人座', 'VITO', 'GRANVIA', '自填',
] as const
type VehicleOption = typeof VEHICLE_OPTIONS[number]

const PLATETYPE_OPTIONS = [
  { value: 'any', label: '任意車牌' },
  { value: 'R', label: 'R牌' },
  { value: 'T', label: 'T牌' },
]

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transferStatus: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setSettlementData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            pendingTransferCount: prev.orders.map(o =>
              o.id === orderId ? { ...o, transferStatus: newStatus } : o
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
        ? format(typeof order.completedAt === 'string' ? parseISO(order.completedAt) : order.completedAt, 'yyyy-MM-dd HH:mm')
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
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 10 }]
    XLSX.writeFile(wb, `轉帳清單_${startDate}_${endDate}.xlsx`)
  }

  if (!token) return null

  return (
    <div className="space-y-5">
      {/* Date Range Picker - cleaner horizontal layout */}
      <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="block text-[10px] text-[#6b6560] mb-2 uppercase tracking-widest font-medium">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors font-mono-nums"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-[#6b6560] mb-2 uppercase tracking-widest font-medium">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors font-mono-nums"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(7)} className="border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] hover:bg-[#ff6b2b]/5 text-xs">
              近7天
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(30)} className="border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] hover:bg-[#ff6b2b]/5 text-xs">
              近30天
            </Button>
            <Button size="sm" onClick={fetchSettlement} loading={loading} className="bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold text-xs px-4">
              查詢
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-2 border-[#ff6b2b] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-xl p-6 text-center">
          <p className="text-[#ef4444] text-sm">{error}</p>
        </div>
      ) : settlementData ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3b82f6]/40 to-transparent" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                <span className="text-[10px] text-[#3b82f6] uppercase tracking-widest font-medium">總派出單數</span>
              </div>
              <p className="text-3xl font-bold text-[#f0ebe3] font-mono-nums">{settlementData.allOrdersCount}</p>
              <p className="text-xs text-[#6b6560] mt-1">筆</p>
            </div>
            <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f59e0b]/40 to-transparent" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                <span className="text-[10px] text-[#f59e0b] uppercase tracking-widest font-medium">待轉帳筆數</span>
              </div>
              <p className="text-3xl font-bold text-[#f0ebe3] font-mono-nums">{settlementData.pendingTransferCount}</p>
              <p className="text-xs text-[#6b6560] mt-1">筆</p>
            </div>
          </div>

          {/* Transfer table */}
          <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e26]">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-[#f0ebe3]">司機轉帳清單</h3>
                <span className="text-xs text-[#6b6560]">共 {settlementData.orders.length} 筆已完成行程</span>
              </div>
              <Button size="sm" onClick={handleDownloadExcel} className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-medium flex items-center gap-2 text-xs">
                <Download className="w-3 h-3" />
                下載 Excel
              </Button>
            </div>

            {settlementData.orders.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="w-10 h-10 text-[#2a2a30] mx-auto mb-3" />
                <p className="text-[#6b6560] text-sm">此區間尚無完成的行程</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e1e26]">
                      <th className="text-left text-[10px] text-[#6b6560] uppercase tracking-wider py-3 px-5 font-medium">單號</th>
                      <th className="text-left text-[10px] text-[#6b6560] uppercase tracking-wider py-3 px-4 font-medium">司機</th>
                      <th className="text-left text-[10px] text-[#6b6560] uppercase tracking-wider py-3 px-4 font-medium">車牌</th>
                      <th className="text-left text-[10px] text-[#6b6560] uppercase tracking-wider py-3 px-4 font-medium">日期</th>
                      <th className="text-right text-[10px] text-[#6b6560] uppercase tracking-wider py-3 px-4 font-medium">金額</th>
                      <th className="text-left text-[10px] text-[#6b6560] uppercase tracking-wider py-3 px-4 font-medium">轉帳資料</th>
                      <th className="text-center text-[10px] text-[#6b6560] uppercase tracking-wider py-3 px-4 font-medium">轉帳情形</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementData.orders.map((order) => {
                      const completedAt = order.completedAt
                        ? format(typeof order.completedAt === 'string' ? parseISO(order.completedAt as string) : order.completedAt, 'MM/dd HH:mm')
                        : '-'
                      const isPending = order.transferStatus === 'pending'
                      return (
                        <tr key={order.id} className="border-b border-[#1e1e26]/50 hover:bg-[#141418]/50 transition-colors">
                          <td className="py-3 px-5">
                            <span className="text-xs font-mono-nums text-[#6b6560]">#{order.id.slice(0, 8)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-[#f0ebe3]">{order.driver?.user?.name || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#6b6560] font-mono-nums">{order.driver?.licensePlate || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#6b6560] font-mono-nums">{completedAt}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-bold text-[#22c55e] font-mono-nums">NT${order.price.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-[#6b6560]">
                              {order.driver?.bankCode
                                ? <span>銀行：{order.driver.bankCode}</span>
                                : <span className="text-[#3a3a40]">未設定</span>}
                              {order.driver?.bankAccount && (
                                <span className="ml-2 font-mono-nums text-[10px]">
                                  {order.driver.bankAccount.slice(0, 3)}****{order.driver.bankAccount.slice(-3)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleTransfer(order.id, order.transferStatus)}
                              disabled={togglingId === order.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isPending
                                  ? 'bg-[#f59e0b]/10 text-[#f59e0b] hover:bg-[#f59e0b]/20 border border-[#f59e0b]/20'
                                  : 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/20'
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
  const [publishResult, setPublishResult] = useState<{ success: number; failed: number; errors: Array<{ rawText: string; error: string }> } | null>(null)

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

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'DISPATCHER')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  const fetchOrders = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
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
      const res = await fetch('/api/dispatchers/drivers', { headers: { Authorization: `Bearer ${token}` } })
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
    setEditOrderForm({ passengerName: '', passengerPhone: '', flightNumber: '', pickupLocation: '', dropoffLocation: '', passengerCount: 1, luggageCount: 0, scheduledTime: '', price: 0, note: '' })
  }

  const handleSaveOrderEdit = async () => {
    if (!token || !editingOrder) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    } catch { alert('網路錯誤') } finally { setEditSaving(false) }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!token) return
    if (!confirm('確定要刪除這筆行程嗎？')) return
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ _action: 'delete' }),
      })
      const data = await res.json()
      if (data.success) fetchOrders()
      else alert(data.error || '刪除失敗')
    } catch { alert('網路錯誤') }
  }

  const handleParseBatch = async () => {
    if (!rawText.trim()) return
    if (!defaults.date) { alert('請選擇日期'); return }
    setCreateLoading(true)
    try {
      const res = await fetch('/api/orders/parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, defaults }),
      })
      const data = await res.json()
      if (!data.success) { alert(data.error || '解析失敗'); return }
      const parsed = data.data?.orders || []
      const batchVehicle = defaults.vehicle === '自填' ? defaults.vehicleCustom : defaults.vehicle
      const items: ReviewItem[] = parsed.map((p: any) => ({
        ...p, reviewId: generateId(),
        editedVehicle: batchVehicle,
        editedVehicleCustom: '',
        editedKenichi: defaults.kenichiRequired || false,
      }))
      setReviewItems(items)
      setActiveTab('review')
    } catch (e: any) { alert('解析失敗：' + e.message) } finally { setCreateLoading(false) }
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
          ? { ...item, editedPrice: editForm.price, editedTime: editForm.scheduledTime, editedPickup: editForm.pickupLocation, editedDropoff: editForm.dropoffLocation, editedNotes: editForm.note, editedKenichi: editForm.kenichiRequired, editedVehicle: editForm.editedVehicle === '自填' ? editForm.editedVehicleCustom : editForm.editedVehicle }
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
    const missingTime = reviewItems.filter(item => !(item.editedTime || item.time))
    if (missingTime.length > 0) {
      alert(`以下 ${missingTime.length} 筆訂單缺少時間`)
      return
    }
    setCreateLoading(true)
    try {
      let orderDate = ''
      if (defaults.date === 'today') orderDate = format(new Date(), 'yyyy-MM-dd')
      else if (defaults.date === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); orderDate = format(d, 'yyyy-MM-dd') }
      else if (defaults.date) orderDate = defaults.date
      else orderDate = format(new Date(), 'yyyy-MM-dd')

      let successCount = 0
      let failedCount = 0
      const errors: Array<{ rawText: string; error: string }> = []
      for (const item of reviewItems) {
        const rawTime = item.editedTime || item.time
        const scheduledDateTime = rawTime === '落地' ? `${orderDate}T23:59:00` : `${orderDate}T${rawTime}:00`
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passengerName: '待確認', passengerPhone: '待確認',
            pickupLocation: item.editedPickup || item.pickupLocation || '', pickupAddress: item.editedPickup || item.pickupLocation || '',
            dropoffLocation: item.editedDropoff || item.dropoffLocation || '', dropoffAddress: item.editedDropoff || item.dropoffLocation || '',
            passengerCount: 1, luggageCount: 0, scheduledTime: scheduledDateTime,
            price: item.editedPrice ?? item.price ?? 800,
            type: item.editedType || item.type || 'pending',
            vehicle: (() => {
              const raw = item.editedVehicle === '自填' ? item.editedVehicleCustom : item.editedVehicle || (defaults.vehicle === '自填' ? defaults.vehicleCustom : defaults.vehicle)
              const map: Record<string, string> = { '任意車': 'any', '小車': 'small', '休旅': 'suv', '7人座': 'van9', '9人座': 'van9', 'VITO': 'van9', 'GRANVIA': 'suv' }
              return raw ? (map[raw] || 'any') : 'any'
            })(),
            plateType: item.editedPlateType || item.plateType || 'any',
            notes: item.editedNotes || item.notes || '', note: '', rawText: item.rawText || '',
            kenichiRequired: item.editedKenichi || false,
          }),
        })
        const data = await res.json()
        if (data.success) successCount++
        else { failedCount++; errors.push({ rawText: (item.rawText || '').substring(0, 30), error: data.error || '未知錯誤' }) }
      }
      setRawText('')
      setReviewItems([])
      setPublishResult({ success: successCount, failed: failedCount, errors })
      fetchOrders()
    } catch (error) {
      console.error('Failed to create orders:', error)
      setPublishResult({ success: 0, failed: reviewItems.length, errors: [] })
    } finally {
      setCreateLoading(false)
    }
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

  const statusCounts = {
    PICKUP: orders.filter(o => o.type === 'pickup').length,
    DROPOFF: orders.filter(o => o.type === 'dropoff').length,
    PENDING: orders.filter(o => ['PENDING', 'PUBLISHED'].includes(o.status)).length,
    ACCEPTED: orders.filter(o => ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(o.status)).length,
  }

  const onlineDrivers = drivers.filter(d => d.status === 'ONLINE').length
  const busyDrivers = drivers.filter(d => d.status === 'BUSY').length

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
            {/* Branding */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-[#ff6b2b] flex items-center justify-center shadow-[0_0_20px_rgba(255,107,43,0.3)] animate-ember-pulse">
                <Plane className="w-4 h-4 text-[#060608]" />
              </div>
              <div>
                <span className="text-[#ff6b2b] font-bold tracking-tight text-lg">{user.dispatcher?.companyName || '車頭專區'}</span>
                <div className="flex items-center gap-3 text-[10px] text-[#6b6560]">
                  <span className="font-mono-nums">{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                  <span className="font-mono-nums">{new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </Link>

            {/* Status indicators */}
            <div className="flex items-center gap-6">
              {/* Driver status strip */}
              <div className="hidden md:flex items-center gap-4 px-4 py-1.5 bg-[#0c0c10] border border-[#1e1e26] rounded-lg">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  <span className="text-xs text-[#22c55e] font-medium font-mono-nums">{onlineDrivers}</span>
                  <span className="text-[10px] text-[#6b6560]">在線</span>
                </div>
                <div className="w-px h-3 bg-[#1e1e26]" />
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-xs text-[#f59e0b] font-medium font-mono-nums">{busyDrivers}</span>
                  <span className="text-[10px] text-[#6b6560]">忙碌</span>
                </div>
                <div className="w-px h-3 bg-[#1e1e26]" />
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-[#6b6560]" />
                  <span className="text-xs text-[#f0ebe3] font-medium font-mono-nums">{drivers.length}</span>
                  <span className="text-[10px] text-[#6b6560]">司機</span>
                </div>
              </div>

              {/* User + logout */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-[#f0ebe3]">{user.name}</p>
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] hover:bg-[#ff6b2b]/5">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar - Command Strip */}
      <div className="relative z-10 bg-[#060608]/80 backdrop-blur-xl border-b border-[#1e1e26]">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Pickup */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/10">
              <div className="w-7 h-7 rounded-md bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
                <Plane className="w-3.5 h-3.5 text-[#22c55e]" />
              </div>
              <div>
                <p className="text-xs text-[#6b6560] leading-none">接機</p>
                <p className="text-xl font-bold text-[#f0ebe3] font-mono-nums leading-tight">{statusCounts.PICKUP}</p>
              </div>
            </div>
            {/* Dropoff */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#3b82f6]/5 border border-[#3b82f6]/10">
              <div className="w-7 h-7 rounded-md bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
                <Plane className="w-3.5 h-3.5 text-[#3b82f6] rotate-45" />
              </div>
              <div>
                <p className="text-xs text-[#6b6560] leading-none">送機</p>
                <p className="text-xl font-bold text-[#f0ebe3] font-mono-nums leading-tight">{statusCounts.DROPOFF}</p>
              </div>
            </div>
            {/* Pending */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#ff6b2b]/5 border border-[#ff6b2b]/10">
              <div className="w-7 h-7 rounded-md bg-[#ff6b2b]/10 border border-[#ff6b2b]/20 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-[#ff6b2b]" />
              </div>
              <div>
                <p className="text-xs text-[#6b6560] leading-none">待接單</p>
                <p className="text-xl font-bold text-[#ff6b2b] font-mono-nums leading-tight">{statusCounts.PENDING}</p>
              </div>
            </div>
            {/* Accepted */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#a855f7]/5 border border-[#a855f7]/10">
              <div className="w-7 h-7 rounded-md bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-[#a855f7]" />
              </div>
              <div>
                <p className="text-xs text-[#6b6560] leading-none">已接單</p>
                <p className="text-xl font-bold text-[#f0ebe3] font-mono-nums leading-tight">{statusCounts.ACCEPTED}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 bg-[#060608]/80 backdrop-blur-xl border-b border-[#1e1e26] sticky top-[108px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {[
              { key: 'orders' as Tab, icon: ClipboardList, label: '行控中心' },
              { key: 'create' as Tab, icon: Plus, label: '派單中心' },
              { key: 'drivers' as Tab, icon: Users, label: '司機車隊' },
              { key: 'settlement' as Tab, icon: Wallet, label: '帳務中心' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                  activeTab === tab.key
                    ? 'border-[#ff6b2b] text-[#ff6b2b]'
                    : 'border-transparent text-[#6b6560] hover:text-[#f0ebe3] hover:bg-[#141418]/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.key === 'orders' && orders.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums bg-[#ff6b2b]/15 text-[#ff6b2b] border border-[#ff6b2b]/20">
                    {orders.length}
                  </span>
                )}
                {tab.key === 'create' && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/20">AI</span>
                )}
                {/* Active indicator line */}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff6b2b]" style={{ boxShadow: '0 0 8px rgba(255,107,43,0.5)' }} />
                )}
              </button>
            ))}

            {/* Review tab - only shows when items exist */}
            {reviewItems.length > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 relative ${
                  activeTab === 'review'
                    ? 'border-[#ff6b2b] text-[#ff6b2b]'
                    : 'border-transparent text-[#6b6560] hover:text-[#f0ebe3]'
                }`}
              >
                <Search className="w-4 h-4" />
                審核 ({reviewItems.length})
                {activeTab === 'review' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff6b2b]" style={{ boxShadow: '0 0 8px rgba(255,107,43,0.5)' }} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-6">

        {/* ===== ORDERS TAB ===== */}
        {activeTab === 'orders' && (
          <>
            {/* Edit Modal */}
            {editingOrder && (
              <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-[#060608]/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) closeEditModal() }}>
                <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e26] sticky top-0 bg-[#0c0c10] z-10">
                    <h3 className="text-base font-semibold text-[#f0ebe3]">
                      <span className="text-[#6b6560] font-mono-nums">#</span>{editingOrder.id.slice(0, 8)}
                    </h3>
                    <button onClick={closeEditModal} className="text-[#6b6560] hover:text-[#f0ebe3] transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">乘客姓名</label>
                        <input type="text" value={editOrderForm.passengerName} onChange={(e) => setEditOrderForm(prev => ({ ...prev, passengerName: e.target.value }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">乘客電話</label>
                        <input type="text" value={editOrderForm.passengerPhone} onChange={(e) => setEditOrderForm(prev => ({ ...prev, passengerPhone: e.target.value }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">航班</label>
                      <input type="text" value={editOrderForm.flightNumber} onChange={(e) => setEditOrderForm(prev => ({ ...prev, flightNumber: e.target.value }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">上車地點</label>
                      <input type="text" value={editOrderForm.pickupLocation} onChange={(e) => setEditOrderForm(prev => ({ ...prev, pickupLocation: e.target.value }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">下地點</label>
                      <input type="text" value={editOrderForm.dropoffLocation} onChange={(e) => setEditOrderForm(prev => ({ ...prev, dropoffLocation: e.target.value }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">人數</label>
                        <input type="number" min="1" value={editOrderForm.passengerCount} onChange={(e) => setEditOrderForm(prev => ({ ...prev, passengerCount: parseInt(e.target.value) || 1 }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors font-mono-nums" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">行李</label>
                        <input type="number" min="0" value={editOrderForm.luggageCount} onChange={(e) => setEditOrderForm(prev => ({ ...prev, luggageCount: parseInt(e.target.value) || 0 }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors font-mono-nums" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">金額</label>
                        <input type="number" min="0" value={editOrderForm.price} onChange={(e) => setEditOrderForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors font-mono-nums" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">預定時間</label>
                      <input type="datetime-local" value={editOrderForm.scheduledTime} onChange={(e) => setEditOrderForm(prev => ({ ...prev, scheduledTime: e.target.value }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors font-mono-nums" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#6b6560] uppercase tracking-wider">備註</label>
                      <input type="text" value={editOrderForm.note} onChange={(e) => setEditOrderForm(prev => ({ ...prev, note: e.target.value }))} className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 transition-colors" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleSaveOrderEdit} loading={editSaving} className="flex-1 bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold text-sm">
                        儲存變更
                      </Button>
                      <Button variant="outline" onClick={closeEditModal} className="flex-1 border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] hover:bg-[#ff6b2b]/5 text-sm">
                        取消
                      </Button>
                    </div>
                  </div>
                </div>
              </dialog>
            )}

            {/* Orders grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-[#ff6b2b] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-32 border border-[#1e1e26] rounded-2xl bg-[#0c0c10]/50 relative overflow-hidden">
                <div className="absolute inset-0 dot-matrix opacity-30" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#141418] border border-[#1e1e26] flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="w-8 h-8 text-[#3a3a40]" />
                  </div>
                  <p className="text-[#6b6560] mb-1 text-lg font-medium">目前沒有訂單</p>
                  <p className="text-[#3a3a40] text-sm mb-6">建立第一筆訂單來開始派車</p>
                  <Button className="bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold" onClick={() => setActiveTab('create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    建立訂單
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {orders.map((order, i) => (
                  <div key={order.id} className="animate-cardEntry" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                    <DispatcherOrderCard order={order} onEdit={openEditModal} onDelete={handleDeleteOrder} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== CREATE TAB ===== */}
        {activeTab === 'create' && (
          <div className="space-y-5">
            {/* Defaults card */}
            <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e1e26] flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-[#ff6b2b]/10 border border-[#ff6b2b]/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#ff6b2b]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#f0ebe3]">派單中心 — AI 智能解析</h3>
                  <p className="text-xs text-[#6b6560]">選擇日期與車型，AI 自動解析訂單文字</p>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Date */}
                <div className="space-y-2">
                  <label className="text-[10px] text-[#6b6560] uppercase tracking-widest font-medium">日期（必選）</label>
                  <div className="relative">
                    <select
                      value={defaults.date || ''}
                      onChange={(e) => setDefaults(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-[#060608] border border-[#1e1e26] rounded-lg pl-10 pr-3 py-2.5 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 cursor-pointer transition-colors appearance-none font-mono-nums"
                    >
                      {DATE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6560] pointer-events-none" />
                  </div>
                </div>

                {/* Vehicle */}
                <div className="space-y-2">
                  <label className="text-[10px] text-[#6b6560] uppercase tracking-widest font-medium">車型（整批套用）</label>
                  <div className="flex flex-wrap gap-2">
                    {VEHICLE_OPTIONS.filter(v => v !== '自填').map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDefaults(prev => ({ ...prev, vehicle: v, vehicleCustom: '' }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          defaults.vehicle === v
                            ? 'bg-[#ff6b2b] text-[#060608] border border-[#ff6b2b]'
                            : 'bg-[#060608] text-[#6b6560] border border-[#1e1e26] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b]'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDefaults(prev => ({ ...prev, vehicle: '自填' }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        defaults.vehicle === '自填'
                          ? 'bg-[#ff6b2b] text-[#060608] border border-[#ff6b2b]'
                          : 'bg-[#060608] text-[#6b6560] border border-[#1e1e26] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b]'
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
                      className="mt-1 bg-[#060608] border border-[#1e1e26] rounded-lg px-3 py-2 text-[#f0ebe3] text-sm focus:outline-none focus:border-[#ff6b2b]/50 w-full max-w-xs transition-colors"
                    />
                  )}
                </div>

                {/* Kenichi */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaults(prev => ({ ...prev, kenichiRequired: !prev.kenichiRequired }))}
                    className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                      defaults.kenichiRequired ? 'bg-[#a855f7] border-[#a855f7]' : 'bg-[#060608] border-[#1e1e26]'
                    }`}
                  >
                    {defaults.kenichiRequired && (
                      <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                  <span className="text-xs text-[#a855f7]">肯驛系統</span>
                  <span className="text-xs text-[#6b6560]">（整批標記）</span>
                </div>
              </div>
            </div>

            {/* Text input */}
            <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e1e26]">
                <h3 className="text-sm font-semibold text-[#f0ebe3] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#ff6b2b]" />
                  貼上訂單文字
                </h3>
              </div>
              <div className="p-5">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`範例：
0400 內湖送桃機
0400 松山送桃機/休旅
0430 新竹東區送桃機/9座 $1000
2310 tr875 接北屯+北區 任意車2000
1545 桃機接萬華 任意R 800`}
                  className="w-full h-44 bg-[#060608] border border-[#1e1e26] rounded-lg px-4 py-3 text-[#f0ebe3] text-sm font-mono-nums focus:outline-none focus:border-[#ff6b2b]/50 resize-none placeholder-[#2a2a30] transition-colors leading-relaxed"
                />
                <Button
                  onClick={handleParseBatch}
                  loading={createLoading}
                  className="mt-4 w-full bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold h-12 rounded-xl flex items-center justify-center gap-2 text-sm"
                >
                  <Search className="w-4 h-4" />
                  解析並進入審核
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== REVIEW TAB ===== */}
        {activeTab === 'review' && (
          <div className="space-y-5">
            <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e1e26] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-[#ff6b2b]/10 border border-[#ff6b2b]/20 flex items-center justify-center">
                    <Search className="w-4 h-4 text-[#ff6b2b]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#f0ebe3]">審核清單</h3>
                    <p className="text-xs text-[#6b6560]">{reviewItems.length} 筆待確認</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {reviewItems.length === 0 ? (
                  <p className="text-center text-[#6b6560] py-8 text-sm">暫無待審核的訂單</p>
                ) : (
                  <div className="space-y-3">
                    {reviewItems.map((item, idx) => (
                      <div key={item.reviewId} className="bg-[#060608] border border-[#1e1e26] rounded-xl p-4">
                        {editingId === item.reviewId ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-[#f0ebe3]">編輯 #{idx + 1}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-[#6b6560] uppercase">時間</label>
                                <input type="text" value={editForm.scheduledTime || ''} onChange={(e) => setEditForm(prev => ({ ...prev, scheduledTime: e.target.value }))} className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-lg px-3 py-2 text-[#f0ebe3] text-sm font-mono-nums" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-[#6b6560] uppercase">價格</label>
                                <select value={editForm.price || ''} onChange={(e) => setEditForm(prev => ({ ...prev, price: parseInt(e.target.value) }))} className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-lg px-3 py-2 text-[#f0ebe3] text-sm font-mono-nums">
                                  {PRICE_OPTIONS.filter(p => p.value > 0).map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#6b6560] uppercase">車型</label>
                              <div className="flex flex-wrap gap-1.5">
                                {VEHICLE_OPTIONS.filter(v => v !== '自填').map(v => (
                                  <button key={v} type="button" onClick={() => setEditForm(prev => ({ ...prev, editedVehicle: v, editedVehicleCustom: '' }))} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${editForm.editedVehicle === v ? 'bg-[#ff6b2b] text-[#060608]' : 'bg-[#0c0c10] text-[#6b6560] border border-[#1e1e26]'}`}>{v}</button>
                                ))}
                                <button type="button" onClick={() => setEditForm(prev => ({ ...prev, editedVehicle: '自填' }))} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${editForm.editedVehicle === '自填' ? 'bg-[#ff6b2b] text-[#060608]' : 'bg-[#0c0c10] text-[#6b6560] border border-[#1e1e26]'}`}>自填</button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#6b6560] uppercase">上車地點</label>
                              <input type="text" value={editForm.pickupLocation || ''} onChange={(e) => setEditForm(prev => ({ ...prev, pickupLocation: e.target.value }))} className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-lg px-3 py-2 text-[#f0ebe3] text-sm" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#6b6560] uppercase">下地點</label>
                              <input type="text" value={editForm.dropoffLocation || ''} onChange={(e) => setEditForm(prev => ({ ...prev, dropoffLocation: e.target.value }))} className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-lg px-3 py-2 text-[#f0ebe3] text-sm" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#6b6560] uppercase">備註</label>
                              <input type="text" value={editForm.note || ''} onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))} className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-lg px-3 py-2 text-[#f0ebe3] text-sm" />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={() => handleSaveEdit(item.reviewId)} size="sm" className="bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] text-xs">儲存</Button>
                              <Button variant="outline" onClick={() => setEditingId(null)} size="sm" className="border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 text-xs">取消</Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono-nums text-[#6b6560]">#{idx + 1}</span>
                                <Badge className={
                                  item.type === 'pickup' ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/25'
                                  : item.type === 'dropoff' ? 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25'
                                  : item.type === 'transfer' ? 'bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/25'
                                  : item.type === 'charter' ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25'
                                  : 'bg-[#141418] text-[#6b6560] border-[#1e1e26]'
                                }>
                                  {TYPE_LABELS[item.type] || '待確認'}
                                </Badge>
                                <Badge className="bg-[#141418] text-[#6b6560] border-[#1e1e26]">
                                  {item.editedVehicle || '待確認'}
                                </Badge>
                                {(item as any).editedKenichi && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/25 font-medium">肯驛</span>
                                )}
                                <span className="text-[10px] text-[#3a3a40] font-mono-nums">{item.rawText}</span>
                              </div>
                              <div className="flex gap-1.5">
                                <Button variant="outline" size="sm" onClick={() => handleEditItem(item)} className="border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] text-xs py-1 px-2">編輯</Button>
                                <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item.reviewId)} className="border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10 text-xs py-1 px-2">刪除</Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-2">
                              <div>
                                <p className="text-[10px] text-[#6b6560] uppercase">時間</p>
                                <p className="font-mono-nums font-medium text-[#f0ebe3] text-sm">{item.editedTime || item.time || '-'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-[#6b6560] uppercase">費用</p>
                                <p className="font-bold text-[#ff6b2b] font-mono-nums text-sm">NT${item.editedPrice ?? item.price ?? 800}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-[#6b6560] uppercase">車型</p>
                                <p className="font-medium text-[#f0ebe3] text-sm">{item.editedVehicle || '待確認'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
                              <span className="text-[#6b6560] truncate">{item.editedPickup || item.pickupLocation || '-'}</span>
                              <span className="text-[#3a3a40] flex-shrink-0">→</span>
                              <div className="w-2 h-2 rounded-full bg-[#ef4444] flex-shrink-0" />
                              <span className="text-[#6b6560] truncate">{item.editedDropoff || item.dropoffLocation || '-'}</span>
                            </div>
                            {(item.editedNotes || item.notes) && (
                              <p className="text-[10px] text-[#6b6560] italic mt-2 flex items-start gap-1">
                                <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {item.editedNotes || item.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {reviewItems.length > 0 && (
                      <div className="flex gap-3 pt-4 border-t border-[#1e1e26]">
                        <Button onClick={handlePublishOrders} loading={createLoading} size="lg" className="flex-1 bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold h-12 rounded-xl flex items-center justify-center gap-2 text-sm">
                          發布 {reviewItems.length} 筆訂單
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('create')} size="lg" className="border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] hover:bg-[#ff6b2b]/5 text-sm">
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

        {/* ===== DRIVERS TAB ===== */}
        {activeTab === 'drivers' && <FleetControl drivers={drivers} />}

        {/* ===== SETTLEMENT TAB ===== */}
        {activeTab === 'settlement' && <SettlementTab token={token} />}
      </main>

      {/* Publish Result Modal */}
      {publishResult && (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-[#060608]/70 backdrop-blur-sm p-4">
          <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-2xl w-full max-w-md mx-4 text-center p-8">
            <div className={`w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center ${publishResult.failed === 0 ? 'bg-[#22c55e]/10 border border-[#22c55e]/20' : 'bg-[#f59e0b]/10 border border-[#f59e0b]/20'}`}>
              {publishResult.failed === 0 ? (
                <svg className="w-8 h-8 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <TrendingUp className="w-8 h-8 text-[#f59e0b]" />
              )}
            </div>
            <h3 className="text-xl font-bold text-[#f0ebe3] mb-2">
              {publishResult.failed === 0
                ? `成功發布 ${publishResult.success} 筆訂單`
                : `${publishResult.success} 成功、${publishResult.failed} 失敗`}
            </h3>
            <p className="text-sm text-[#6b6560] mb-6">
              {publishResult.failed === 0 ? '司機已可在接單牆看到這些行程' : '請查看失敗原因，修正後重新發布'}
            </p>
            {publishResult.failed > 0 && publishResult.errors.length > 0 && (
              <div className="bg-[#060608] border border-[#ef4444]/20 rounded-xl p-4 mb-6 text-left max-h-40 overflow-y-auto">
                {publishResult.errors.map((err, i) => (
                  <div key={i} className="text-sm mb-2 last:mb-0">
                    <span className="text-[#6b6560] font-mono-nums text-xs">{err.rawText}</span>
                    <p className="text-[#f59e0b] text-xs mt-0.5">{err.error}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <Button onClick={() => setPublishResult(null)} className="flex-1 bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold text-sm">
                前往行控中心
              </Button>
              <Button variant="outline" onClick={() => { setPublishResult(null); setActiveTab('create') }} className="flex-1 border-[#1e1e26] text-[#6b6560] hover:border-[#ff6b2b]/30 hover:text-[#ff6b2b] hover:bg-[#ff6b2b]/5 text-sm">
                繼續派單
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
