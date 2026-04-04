'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { parseBatchOrders, ParsedOrder, BatchOrderDefaults, TYPE_LABELS } from '@/lib/ai'
import { DispatcherOrderCard } from '@/components/dispatcher/OrderCard'
import { FleetControl } from '@/components/dispatcher/FleetControl'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import {
  ClipboardList,
  Search,
  FileText,
  Plane,
  LogOut,
  TrendingUp,
  Clock,
  Download,
  Calendar,
  Car,
  CheckCircle,
  UserCheck,
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
  { value: 600, label: '$600' }, { value: 700, label: '$700' },
  { value: 800, label: '$800' }, { value: 900, label: '$900' },
  { value: 1000, label: '$1000' }, { value: 1200, label: '$1200' },
  { value: 1500, label: '$1500' }, { value: 1800, label: '$1800' },
  { value: 2000, label: '$2000' }, { value: 2500, label: '$2500' },
  { value: 3000, label: '$3000' }, { value: 3500, label: '$3500' },
  { value: 4000, label: '$4000' },
]

const VEHICLE_OPTIONS = [
  '任意車', '小車', '休旅', '7人座', '9人座', 'VITO', 'GRANVIA', '自填',
] as const
type VehicleOption = typeof VEHICLE_OPTIONS[number]

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

// ========== Settlement Tab ==========
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
  summary: { totalOrders: number; totalRevenue: number }
  orders: SettlementOrder[]
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
    if (token) { fetchSettlement() }
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
    XLSX.writeFile(wb, `轉帳清單_${startDate}_${endDate}.xlsx`)
  }

  if (!token) return null

  return (
    <div className="space-y-5">
      {/* Date Range Picker */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="block text-[11px] text-[#717171] mb-2 font-normal">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222] focus:ring-[1px] focus:ring-[#222222] font-mono-nums"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-[#717171] mb-2 font-normal">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222] focus:ring-[1px] focus:ring-[#222222] font-mono-nums"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(7)} className="text-[13px]">近7天</Button>
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(30)} className="text-[13px]">近30天</Button>
            <Button size="sm" onClick={fetchSettlement} loading={loading} className="text-[13px]">查詢</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-[#FCEBEB] border border-[#F5C6C6] rounded-xl p-6 text-center">
          <p className="text-[#E24B4A] text-sm">{error}</p>
        </div>
      ) : settlementData ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">總派出單數</p>
              <p className="text-[22px] font-medium text-[#222222] font-mono-nums">{settlementData.allOrdersCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">待轉帳筆數</p>
              <p className="text-[22px] font-medium text-[#222222] font-mono-nums">{settlementData.pendingTransferCount}</p>
            </div>
          </div>

          {/* Transfer table */}
          <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDDDDD]">
              <h3 className="text-sm font-medium text-[#222222]">司機轉帳清單</h3>
              <span className="text-[13px] text-[#717171]">共 {settlementData.orders.length} 筆已完成行程</span>
              <Button size="sm" onClick={handleDownloadExcel} className="text-[13px]">
                <Download className="w-3 h-3 mr-1" />
                下載 Excel
              </Button>
            </div>

            {settlementData.orders.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="w-8 h-8 text-[#B0B0B0] mx-auto mb-3" />
                <p className="text-[#717171] text-sm">此區間尚無完成的行程</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#DDDDDD]">
                      <th className="text-left text-[11px] text-[#717171] py-3 px-5 font-normal">單號</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">司機</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">車牌</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">日期</th>
                      <th className="text-right text-[11px] text-[#717171] py-3 px-4 font-normal">金額</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">轉帳資料</th>
                      <th className="text-center text-[11px] text-[#717171] py-3 px-4 font-normal">轉帳情形</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementData.orders.map((order) => {
                      const completedAt = order.completedAt
                        ? format(typeof order.completedAt === 'string' ? parseISO(order.completedAt as string) : order.completedAt, 'MM/dd HH:mm')
                        : '-'
                      const isPending = order.transferStatus === 'pending'
                      return (
                        <tr key={order.id} className="border-b border-[#DDDDDD] last:border-0 hover:bg-[#F7F7F7] transition-colors">
                          <td className="py-3 px-5">
                            <span className="text-xs font-mono-nums text-[#717171]">#{order.id.slice(0, 8)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-normal text-[#222222]">{order.driver?.user?.name || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#717171] font-mono-nums">{order.driver?.licensePlate || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#717171] font-mono-nums">{completedAt}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-medium text-[#222222] font-mono-nums">NT${order.price.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-[13px] text-[#717171]">
                              {order.driver?.bankCode
                                ? <span>{order.driver.bankCode}</span>
                                : <span className="text-[#B0B0B0]">未設定</span>}
                              {order.driver?.bankAccount && (
                                <span className="ml-2 font-mono-nums text-[11px]">
                                  {order.driver.bankAccount.slice(0, 3)}****{order.driver.bankAccount.slice(-3)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleTransfer(order.id, order.transferStatus)}
                              disabled={togglingId === order.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-normal transition-colors ${
                                isPending
                                  ? 'bg-[#FFF3E0] text-[#B45309] hover:bg-[#FFE0B2]'
                                  : 'bg-[#E8F5E8] text-[#008A05] hover:bg-[#C8E6C8]'
                              } disabled:opacity-50`}
                            >
                              {isPending ? (
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

// ========== Main Component ==========
export default function DispatcherDashboard() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  const [defaults, setDefaults] = useState<Omit<BatchOrderDefaults, 'vehicle' | 'kenichiRequired'> & { vehicle?: string; vehicleCustom?: string; kenichiRequired?: boolean }>({
    date: '', vehicle: '任意車', vehicleCustom: '', kenichiRequired: false,
  })
  const [rawText, setRawText] = useState('')
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    price?: number; scheduledTime?: string; pickupLocation?: string;
    dropoffLocation?: string; note?: string; editedVehicle?: string; editedVehicleCustom?: string;
  }>({})
  const [createLoading, setCreateLoading] = useState(false)
  const [publishResult, setPublishResult] = useState<{ success: number; failed: number; errors: Array<{ rawText: string; error: string }> } | null>(null)

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
    if (token) { fetchOrders(); fetchDrivers() }
  }, [token, fetchOrders, fetchDrivers])

  // 每 10 秒自動刷新訂單和司機列表
  useEffect(() => {
    if (!token) return
    const interval = setInterval(() => {
      fetchOrders()
      fetchDrivers()
    }, 10000)
    return () => clearInterval(interval)
  }, [token, fetchOrders, fetchDrivers])

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
          ? { ...item, editedPrice: editForm.price, editedTime: editForm.scheduledTime, editedPickup: editForm.pickupLocation, editedDropoff: editForm.dropoffLocation, editedNotes: editForm.note, editedVehicle: editForm.editedVehicle === '自填' ? editForm.editedVehicleCustom : editForm.editedVehicle }
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
      if (defaults.date) orderDate = defaults.date
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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[#717171] text-sm">載入中...</p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const statusCounts = {
    // 統計所有狀態的接機/送機訂單總數
    PICKUP: orders.filter(o => o.type === 'pickup' || o.type === 'pickup_boat').length,
    DROPOFF: orders.filter(o => o.type === 'dropoff' || o.type === 'dropoff_boat').length,
    // 待接單：PENDING 狀態
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    ACCEPTED: orders.filter(o => ['ASSIGNED', 'ACCEPTED'].includes(o.status)).length,
    IN_PROGRESS: orders.filter(o => ['ARRIVED', 'IN_PROGRESS'].includes(o.status)).length,
    COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
    // 未派出：PUBLISHED 但已過期（過了 scheduledTime 仍未被司機接走）
    UNASSIGNED: orders.filter(o => o.status === 'PUBLISHED' && new Date(o.scheduledTime) < now).length,
  }

  const onlineDrivers = drivers.filter(d => d.status === 'ONLINE').length

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Header */}
      <header className="bg-[#FAF8F5] border-b border-[#DDDDDD] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            {/* Title + driver count */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
                  <Plane className="w-4 h-4 text-white" />
                </div>
                <span className="text-[22px] font-medium text-[#222222]">{user.dispatcher?.companyName || '派單方專區'}</span>
              </Link>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E8] text-[#008A05] text-[13px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#008A05]" />
                {onlineDrivers} 司機在線
              </div>
            </div>

            {/* User + logout */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#717171]">{user.name}</span>
              <Button variant="outline" size="sm" onClick={logout} className="text-[13px]">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation — pill buttons */}
      <div className="bg-[#FAF8F5] border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-2 py-3">
            {([
              { key: 'orders' as Tab, label: '行控中心' },
              { key: 'create' as Tab, label: '派單中心' },
              { key: 'drivers' as Tab, label: '司機車隊' },
              { key: 'settlement' as Tab, label: '帳務中心' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm rounded-full transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#222222] text-white'
                    : 'bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
                }`}
              >
                {tab.label}
                {tab.key === 'orders' && orders.length > 0 && (
                  <span className="ml-1.5 text-[11px] opacity-70">({orders.length})</span>
                )}
              </button>
            ))}
            {reviewItems.length > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className={`px-4 py-2 text-sm rounded-full transition-colors ${
                  activeTab === 'review'
                    ? 'bg-[#222222] text-white'
                    : 'bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
                }`}
              >
                審核 ({reviewItems.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">

        {/* ===== ORDERS TAB ===== */}
        {activeTab === 'orders' && (
          <>
            {/* Stats — 6 in a row: 接(x)/送(x) / 待接單 / 已接單 / 進行中 / 已完成 / 未派出 */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
              {/* 接(x)/送(x) */}
              <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 flex flex-col items-center justify-center gap-0.5">
                <p className="text-[13px] text-[#717171] font-bold leading-tight">接機</p>
                <div className="flex items-baseline gap-0.5 leading-none">
                  <p className="text-[28px] font-bold text-[#0C447C] font-mono-nums">{statusCounts.PICKUP}</p>
                  <p className="text-[16px] text-[#717171] font-mono-nums">/</p>
                  <p className="text-[28px] font-bold text-[#B45309] font-mono-nums">{statusCounts.DROPOFF}</p>
                </div>
              </div>
              {/* 待接單 */}
              <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 flex flex-col items-center justify-center gap-0.5">
                <p className="text-[13px] text-[#A32D2D] font-bold leading-tight">待接單</p>
                <p className="text-[36px] font-bold text-[#A32D2D] font-mono-nums leading-none">{statusCounts.PENDING}</p>
              </div>
              {/* 已接單 */}
              <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 flex flex-col items-center justify-center gap-0.5">
                <p className="text-[13px] text-[#B45309] font-bold leading-tight">已接單</p>
                <p className="text-[36px] font-bold text-[#B45309] font-mono-nums leading-none">{statusCounts.ACCEPTED}</p>
              </div>
              {/* 進行中 */}
              <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 flex flex-col items-center justify-center gap-0.5">
                <p className="text-[13px] text-[#0C447C] font-bold leading-tight">進行中</p>
                <p className="text-[36px] font-bold text-[#0C447C] font-mono-nums leading-none">{statusCounts.IN_PROGRESS}</p>
              </div>
              {/* 已完成 */}
              <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 flex flex-col items-center justify-center gap-0.5">
                <p className="text-[13px] text-[#008A05] font-bold leading-tight">已完成</p>
                <p className="text-[36px] font-bold text-[#008A05] font-mono-nums leading-none">{statusCounts.COMPLETED}</p>
              </div>
              {/* 未派出 */}
              <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 flex flex-col items-center justify-center gap-0.5">
                <p className="text-[13px] text-[#717171] font-bold leading-tight">未派出</p>
                <p className="text-[36px] font-bold text-[#717171] font-mono-nums leading-none">{statusCounts.UNASSIGNED}</p>
              </div>
            </div>

            {/* Orders grid — 2 cols */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-24 border border-[#DDDDDD] rounded-xl bg-[#F4EFE9]">
                <ClipboardList className="w-10 h-10 text-[#B0B0B0] mx-auto mb-3" />
                <p className="text-[#717171] mb-1 text-lg font-medium">目前沒有訂單</p>
                <p className="text-[#B0B0B0] text-sm mb-6">建立第一筆訂單來開始派車</p>
                <Button onClick={() => setActiveTab('create')} className="text-[13px]">建立訂單</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {orders.map((order) => (
                  <DispatcherOrderCard key={order.id} order={order} token={token} onUpdate={fetchOrders} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== CREATE TAB ===== */}
        {activeTab === 'create' && (
          <div className="space-y-5">
            {/* Defaults card */}
            <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#DDDDDD] flex items-center gap-3">
                <FileText className="w-4 h-4 text-[#717171]" />
                <div>
                  <h3 className="text-[18px] font-medium text-[#222222]">派單中心 — AI 智能解析</h3>
                  <p className="text-[13px] text-[#717171]">選擇日期與車型，AI 自動解析訂單文字</p>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Date */}
                <div className="space-y-2">
                  <label className="text-[11px] text-[#717171] font-normal">日期（必選）</label>
                  <div className="relative">
                    <select
                      value={defaults.date || ''}
                      onChange={(e) => setDefaults(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-white border border-[#DDDDDD] rounded-lg pl-10 pr-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222] cursor-pointer font-mono-nums"
                    >
                      {DATE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171] pointer-events-none" />
                  </div>
                </div>

                {/* Vehicle */}
                <div className="space-y-2">
                  <label className="text-[11px] text-[#717171] font-normal">車型（整批套用）</label>
                  <div className="flex flex-wrap gap-2">
                    {VEHICLE_OPTIONS.filter(v => v !== '自填').map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDefaults(prev => ({ ...prev, vehicle: v, vehicleCustom: '' }))}
                        className={`px-3 py-1.5 rounded-lg text-[13px] font-normal transition-colors ${
                          defaults.vehicle === v
                            ? 'bg-[#FF385C] text-white'
                            : 'bg-white text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDefaults(prev => ({ ...prev, vehicle: '自填' }))}
                      className={`px-3 py-1.5 rounded-lg text-[13px] font-normal transition-colors ${
                        defaults.vehicle === '自填'
                          ? 'bg-[#FF385C] text-white'
                          : 'bg-white text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
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
                      className="mt-1 bg-white border border-[#DDDDDD] rounded-lg px-3 py-2 text-[#222222] text-sm focus:outline-none focus:border-[#222222] w-full max-w-xs"
                    />
                  )}
                </div>

                {/* Kenichi */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaults(prev => ({ ...prev, kenichiRequired: !prev.kenichiRequired }))}
                    className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${
                      defaults.kenichiRequired ? 'bg-[#6B21A8] border-[#6B21A8]' : 'bg-white border-[#DDDDDD]'
                    }`}
                  >
                    {defaults.kenichiRequired && (
                      <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                  <span className="text-[13px] text-[#6B21A8]">肯驛系統</span>
                  <span className="text-[13px] text-[#717171]">（整批標記）</span>
                </div>
              </div>
            </div>

            {/* Text input */}
            <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#DDDDDD]">
                <h3 className="text-[18px] font-medium text-[#222222] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#717171]" />
                  貼下訂單文字
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
                  className="w-full h-40 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-sm font-mono-nums focus:outline-none focus:border-[#222222] resize-none placeholder-[#B0B0B0]"
                />
                <Button
                  onClick={handleParseBatch}
                  loading={createLoading}
                  className="mt-4 w-full text-[14px]"
                >
                  <Search className="w-4 h-4 mr-2" />
                  解析並進入審核
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== REVIEW TAB ===== */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-bold text-[#222222]">審核清單</h2>
                <p className="text-[14px] text-[#717171]">{reviewItems.length} 筆待確認</p>
              </div>
              {reviewItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setReviewItems(prev => prev.map(item => ({ ...item })))}
                    className="text-[14px]"
                  >
                    全選
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setReviewItems([])}
                    className="text-[14px] text-[#E24B4A] hover:bg-[#FCEBEB]"
                  >
                    清除全部
                  </Button>
                </div>
              )}
            </div>

            {reviewItems.length === 0 ? (
              <div className="text-center py-24 border border-[#DDDDDD] rounded-xl bg-white">
                <ClipboardList className="w-12 h-12 text-[#B0B0B0] mx-auto mb-4" />
                <p className="text-[#717171] text-[16px] font-medium mb-1">暫無待審核的訂單</p>
                <p className="text-[#B0B0B0] text-[14px] mb-6">回到派單中心新增訂單</p>
                <Button onClick={() => setActiveTab('create')} className="text-[14px]">前往派單中心</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewItems.map((item, idx) => (
                  <div key={item.reviewId} className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow">
                    {editingId === item.reviewId ? (
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 bg-[#FF385C] text-white text-[15px] font-bold font-mono-nums rounded select-all">
                              #{idx + 1}
                            </span>
                            <span className="text-[14px] font-medium text-[#222222]">編輯訂單</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[13px] text-[#717171] font-medium">時間</label>
                            <input type="text" value={editForm.scheduledTime || ''} onChange={(e) => setEditForm(prev => ({ ...prev, scheduledTime: e.target.value }))} className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] font-mono-nums focus:outline-none focus:border-[#222222]" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] text-[#717171] font-medium">費用</label>
                            <select value={editForm.price || ''} onChange={(e) => setEditForm(prev => ({ ...prev, price: parseInt(e.target.value) }))} className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] font-mono-nums focus:outline-none focus:border-[#222222]">
                              {PRICE_OPTIONS.filter(p => p.value > 0).map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[13px] text-[#717171] font-medium">上車地點</label>
                          <input type="text" value={editForm.pickupLocation || ''} onChange={(e) => setEditForm(prev => ({ ...prev, pickupLocation: e.target.value }))} className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] focus:outline-none focus:border-[#222222]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[13px] text-[#717171] font-medium">下地點</label>
                          <input type="text" value={editForm.dropoffLocation || ''} onChange={(e) => setEditForm(prev => ({ ...prev, dropoffLocation: e.target.value }))} className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] focus:outline-none focus:border-[#222222]" />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button onClick={() => handleSaveEdit(item.reviewId)} className="text-[14px] px-6">儲存</Button>
                          <Button variant="outline" onClick={() => setEditingId(null)} className="text-[14px] px-6">取消</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5">
                        {/* 第一行：編號 + 種類 + 車型 + 肯驛 | 金額 | 編輯/刪除 */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-3 py-1.5 bg-[#FF385C] text-white text-[15px] font-bold font-mono-nums rounded select-all">
                              #{idx + 1}
                            </span>
                            <span className={`inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded ${
                              item.type === 'pickup' ? 'bg-[#E6F1FB] text-[#0C447C]'
                              : item.type === 'dropoff' ? 'bg-[#FFF3E0] text-[#92400E]'
                              : item.type === 'transfer' ? 'bg-[#F4EFE9] text-[#717171]'
                              : item.type === 'charter' ? 'bg-[#F3E8FF] text-[#6B21A8]'
                              : item.type === 'pickup_boat' ? 'bg-[#E0F7FA] text-[#006064]'
                              : item.type === 'dropoff_boat' ? 'bg-[#E0F7FA] text-[#006064]'
                              : 'bg-[#F4EFE9] text-[#717171]'
                            }`}>
                              {TYPE_LABELS[item.type] || '待確認'}
                            </span>
                            <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
                              {item.editedVehicle || '待確認'}
                            </span>
                            {(item as any).editedKenichi && (
                              <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">肯驛</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[28px] font-bold font-mono-nums text-[#FF385C] leading-none">
                              NT${item.editedPrice ?? item.price ?? 800}
                            </span>
                            <div className="flex gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => handleEditItem(item)} className="text-[14px] py-1.5 px-3">編輯</Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item.reviewId)} className="text-[#E24B4A] hover:bg-[#FCEBEB] text-[14px] py-1.5 px-3">刪除</Button>
                            </div>
                          </div>
                        </div>

                        {/* 第二行：時間 + 起訖點 */}
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#717171]" />
                            <span className="text-[15px] font-bold font-mono-nums text-[#222222]">{item.editedTime || item.time || '-'}</span>
                          </div>
                          <span className="text-[16px] font-bold text-[#222222]">
                            {item.editedPickup || item.pickupLocation || '-'}
                          </span>
                          <span className="text-[18px] font-bold text-[#DDDDDD]">→</span>
                          <span className="text-[16px] font-bold text-[#222222]">
                            {item.editedDropoff || item.dropoffLocation || '-'}
                          </span>
                        </div>

                        {/* 第三行：原始文字 */}
                        {item.rawText && (
                          <div className="text-[13px] text-[#B0B0B0] italic font-mono-nums bg-[#F9F9F9] px-3 py-2 rounded-lg border border-[#EBEBEB]">
                            {item.rawText}
                          </div>
                        )}
                        {(item.editedNotes || item.notes) && (
                          <p className="text-[13px] text-[#717171] mt-2">{item.editedNotes || item.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* 底部發布區 */}
                {reviewItems.length > 0 && (
                  <div className="flex gap-3 pt-4 border-t border-[#DDDDDD] sticky bottom-3 bg-[#FAF8F5] py-3">
                    <Button onClick={handlePublishOrders} loading={createLoading} className="flex-1 text-[15px] py-3">
                      發布 {reviewItems.length} 筆訂單
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('create')} className="text-[14px] px-6">
                      繼續新增
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== DRIVERS TAB ===== */}
        {activeTab === 'drivers' && <FleetControl drivers={drivers} />}

        {/* ===== SETTLEMENT TAB ===== */}
        {activeTab === 'settlement' && <SettlementTab token={token} />}
      </main>

      {/* Publish Result Modal */}
      {publishResult && (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white border border-[#DDDDDD] rounded-xl w-full max-w-md mx-4 text-center p-8">
            <div className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${publishResult.failed === 0 ? 'bg-[#E8F5E8]' : 'bg-[#FFF3E0]'}`}>
              {publishResult.failed === 0 ? (
                <svg className="w-7 h-7 text-[#008A05]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <TrendingUp className="w-7 h-7 text-[#B45309]" />
              )}
            </div>
            <h3 className="text-[22px] font-medium text-[#222222] mb-2">
              {publishResult.failed === 0
                ? `成功發布 ${publishResult.success} 筆訂單`
                : `${publishResult.success} 成功、${publishResult.failed} 失敗`}
            </h3>
            <p className="text-sm text-[#717171] mb-6">
              {publishResult.failed === 0 ? '司機已可在接單牆看到這些行程' : '請查看失敗原因，修正後重新發布'}
            </p>
            {publishResult.failed > 0 && publishResult.errors.length > 0 && (
              <div className="bg-[#F4EFE9] border border-[#DDDDDD] rounded-xl p-4 mb-6 text-left max-h-40 overflow-y-auto text-sm text-[#717171]">
                {publishResult.errors.map((err, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <span className="font-mono-nums text-[11px] text-[#717171]">{err.rawText}</span>
                    <p className="text-[#E24B4A] text-[11px] mt-0.5">{err.error}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <Button onClick={() => { setPublishResult(null); setActiveTab('orders') }} className="flex-1 text-[13px]">
                前往行控中心
              </Button>
              <Button variant="outline" onClick={() => { setPublishResult(null); setActiveTab('create') }} className="flex-1 text-[13px]">
                繼續派單
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
