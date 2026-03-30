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
  Clock,
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

interface DriverTransfer {
  driver: { id: string; name: string; licensePlate: string }
  totalOrders: number
  totalAmount: number
  platformFee: number
  netAmount: number
}

interface SettlementOrder {
  id: string
  price: number
  completedAt: string | Date
  createdAt: string | Date
  driver?: { user: { name: string }; licensePlate: string }
}

interface SettlementData {
  summary: SettlementSummary
  orders: SettlementOrder[]
  driverTransferList: DriverTransfer[]
}

function SettlementTab({ token }: { token: string | null }) {
  const [loading, setLoading] = useState(true)
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'drivers' | 'orders'>('summary')

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
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-[#ff8c42]/20 to-[#ff8c42]/5 border border-[#ff8c42]/20 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-[#ff8c42] uppercase tracking-wider mb-2">總訂單數</p>
              <p className="text-3xl font-bold text-white">{settlementData.summary.totalOrders}</p>
              <p className="text-xs text-[#666] mt-1">筆</p>
            </div>
            <div className="bg-gradient-to-br from-[#22c55e]/20 to-[#22c55e]/5 border border-[#22c55e]/20 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-[#22c55e] uppercase tracking-wider mb-2">總營收</p>
              <p className="text-3xl font-bold text-white">NT${settlementData.summary.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-[#666] mt-1">元</p>
            </div>
            <div className="bg-gradient-to-br from-[#ef4444]/20 to-[#ef4444]/5 border border-[#ef4444]/20 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-[#ef4444] uppercase tracking-wider mb-2">平台費 (5%)</p>
              <p className="text-3xl font-bold text-white">-NT${settlementData.summary.totalPlatformFee.toLocaleString()}</p>
              <p className="text-xs text-[#666] mt-1">元</p>
            </div>
            <div className="bg-gradient-to-br from-[#3b82f6]/20 to-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-[#3b82f6] uppercase tracking-wider mb-2">淨營收</p>
              <p className="text-3xl font-bold text-white">NT${settlementData.summary.totalNetRevenue.toLocaleString()}</p>
              <p className="text-xs text-[#666] mt-1">元</p>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl">
            <div className="flex border-b border-white/5">
              <button
                onClick={() => setActiveSubTab('summary')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeSubTab === 'summary'
                    ? 'text-[#ff8c42] border-b-2 border-[#ff8c42]'
                    : 'text-[#666] hover:text-[#a0a0a0]'
                }`}
              >
                概況總覽
              </button>
              <button
                onClick={() => setActiveSubTab('drivers')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeSubTab === 'drivers'
                    ? 'text-[#ff8c42] border-b-2 border-[#ff8c42]'
                    : 'text-[#666] hover:text-[#a0a0a0]'
                }`}
              >
                司機轉帳清單 ({settlementData.driverTransferList.length})
              </button>
              <button
                onClick={() => setActiveSubTab('orders')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeSubTab === 'orders'
                    ? 'text-[#ff8c42] border-b-2 border-[#ff8c42]'
                    : 'text-[#666] hover:text-[#a0a0a0]'
                }`}
              >
                訂單明细 ({settlementData.orders.length})
              </button>
            </div>

            <div className="p-6">
              {/* Summary Sub Tab */}
              {activeSubTab === 'summary' && (
                <div className="space-y-6">
                  {settlementData.driverTransferList.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-[#333] mx-auto mb-3" />
                      <p className="text-[#666]">此區間尚無完成的訂單</p>
                    </div>
                  ) : (
                    <>
                      {/* Revenue breakdown chart */}
                      <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-5">
                        <p className="text-sm font-medium text-[#e0e0e0] mb-4">營收組成</p>
                        <div className="space-y-3">
                          {settlementData.driverTransferList
                            .sort((a, b) => b.totalAmount - a.totalAmount)
                            .map((item) => (
                              <div key={item.driver.id} className="flex items-center gap-3">
                                <div className="w-32 truncate text-sm text-[#a0a0a0]">{item.driver.name}</div>
                                <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden relative">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#ff8c42] to-[#ff8c42]/60 rounded transition-all"
                                    style={{
                                      width: `${settlementData.summary.totalRevenue > 0
                                        ? (item.totalAmount / settlementData.summary.totalRevenue) * 100
                                        : 0}%`,
                                    }}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#e0e0e0]">
                                    NT${item.totalAmount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="w-16 text-right text-xs text-[#666]">
                                  {settlementData.summary.totalRevenue > 0
                                    ? Math.round((item.totalAmount / settlementData.summary.totalRevenue) * 100)
                                    : 0}%
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Fee breakdown */}
                      <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-5">
                        <p className="text-sm font-medium text-[#e0e0e0] mb-4">費用分析</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-white/5 rounded-xl">
                            <p className="text-2xl font-bold text-[#ff8c42]">
                              NT${settlementData.summary.totalRevenue.toLocaleString()}
                            </p>
                            <p className="text-xs text-[#666] mt-1">司機總營收</p>
                          </div>
                          <div className="text-center p-4 bg-white/5 rounded-xl">
                            <p className="text-2xl font-bold text-[#ef4444]">
                              -NT${settlementData.summary.totalPlatformFee.toLocaleString()}
                            </p>
                            <p className="text-xs text-[#666] mt-1">平台服務費 (5%)</p>
                          </div>
                          <div className="text-center p-4 bg-white/5 rounded-xl">
                            <p className="text-2xl font-bold text-[#22c55e]">
                              NT${settlementData.summary.totalNetRevenue.toLocaleString()}
                            </p>
                            <p className="text-xs text-[#666] mt-1">司機實收</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Drivers Sub Tab */}
              {activeSubTab === 'drivers' && (
                <div>
                  {settlementData.driverTransferList.length === 0 ? (
                    <div className="text-center py-12">
                      <UserCheck className="w-12 h-12 text-[#333] mx-auto mb-3" />
                      <p className="text-[#666]">尚無司機完成行程</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">司機</th>
                            <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">車牌</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">總趟次</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">總金額</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">平台費</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">實收金額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementData.driverTransferList
                            .sort((a, b) => b.netAmount - a.netAmount)
                            .map((item) => (
                              <tr key={item.driver.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-[#ff8c42]/20 flex items-center justify-center">
                                      <span className="text-xs font-bold text-[#ff8c42]">
                                        {item.driver.name.charAt(0)}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium text-[#e0e0e0]">{item.driver.name}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-sm text-[#a0a0a0] font-mono">{item.driver.licensePlate}</span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm font-medium text-[#e0e0e0]">{item.totalOrders}</span>
                                  <span className="text-xs text-[#666] ml-1">筆</span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm font-medium text-[#e0e0e0]">
                                    NT${item.totalAmount.toLocaleString()}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm text-[#ef4444]">
                                    -NT${item.platformFee.toLocaleString()}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm font-bold text-[#22c55e]">
                                    NT${item.netAmount.toLocaleString()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          {/* Total Row */}
                          <tr className="bg-white/5">
                            <td colSpan={2} className="py-3 px-4">
                              <span className="text-sm font-bold text-[#e0e0e0]">合計</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm font-bold text-[#e0e0e0]">
                                {settlementData.driverTransferList.reduce((acc, d) => acc + d.totalOrders, 0)} 筆
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm font-bold text-[#e0e0e0]">
                                NT${settlementData.summary.totalRevenue.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm font-bold text-[#ef4444]">
                                -NT${settlementData.summary.totalPlatformFee.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm font-bold text-[#22c55e]">
                                NT${settlementData.summary.totalNetRevenue.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Orders Sub Tab */}
              {activeSubTab === 'orders' && (
                <div>
                  {settlementData.orders.length === 0 ? (
                    <div className="text-center py-12">
                      <ClipboardList className="w-12 h-12 text-[#333] mx-auto mb-3" />
                      <p className="text-[#666]">尚無完成的訂單</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">日期</th>
                            <th className="text-left text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">司機</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">車牌</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">金額</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">平台費</th>
                            <th className="text-right text-xs text-[#666] uppercase tracking-wider py-3 px-4 font-medium">實收</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementData.orders.map((order) => {
                            const fee = Math.floor(order.price * 0.05)
                            const net = order.price - fee
                            return (
                              <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-3 px-4">
                                  <span className="text-sm text-[#a0a0a0]">
                                    {format(
                                      typeof order.completedAt === 'string'
                                        ? parseISO(order.completedAt)
                                        : order.completedAt,
                                      'MM/dd HH:mm'
                                    )}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-sm font-medium text-[#e0e0e0]">
                                    {order.driver?.user?.name || '-'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm text-[#666] font-mono">
                                    {order.driver?.licensePlate || '-'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm font-medium text-[#e0e0e0]">
                                    NT${order.price.toLocaleString()}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-xs text-[#ef4444]">
                                    -NT${fee.toLocaleString()}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm font-bold text-[#22c55e]">
                                    NT${net.toLocaleString()}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
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
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="text-center py-24 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                    <p className="text-[#a0a0a0] mb-2 text-lg">還沒有訂單</p>
                    <Button className="mt-4 bg-[#ff8c42] hover:bg-[#ff9d5c] text-black" onClick={() => setActiveTab('create')}>
                      建立第一筆訂單
                    </Button>
                  </div>
                ) : (
                  orders.map(order => {
                    const isKenichi = (order.notes || order.note || order.rawText || '').toLowerCase().includes('kenichi') || (order.notes || order.note || order.rawText || '').includes('肯驛')

                    return (
                    <div key={order.id} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 hover:border-white/20 transition-all">
                      {/* Row 1: ID + Price + Type + Status + Kenichi */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-[#666] font-mono">#{order.id.slice(0, 8)}</span>
                        <span className="text-base font-bold" style={{ color: '#ff8c42' }}>NT${order.price.toLocaleString()}</span>
                        {/* Type badge */}
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          order.type === 'pickup' ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                          : order.type === 'dropoff' ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30'
                          : order.type === 'transfer' ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30'
                          : order.type === 'charter' ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30'
                          : 'bg-white/10 text-[#888] border border-white/20'
                        }`}>
                          {order.type === 'pickup' ? '接機' : order.type === 'dropoff' ? '送機' : order.type === 'transfer' ? '交通接駁' : order.type === 'charter' ? '包車' : '待確認'}
                        </span>
                        {/* Status badge */}
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          ['PENDING', 'PUBLISHED'].includes(order.status) ? 'bg-[#ff8c42]/20 text-[#ff8c42] border border-[#ff8c42]/30'
                          : ['ASSIGNED', 'ACCEPTED'].includes(order.status) ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30'
                          : order.status === 'ARRIVED' ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30'
                          : order.status === 'IN_PROGRESS' ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                          : order.status === 'COMPLETED' ? 'bg-white/10 text-[#666] border border-white/10'
                          : 'bg-white/10 text-[#888] border border-white/20'
                        }`}>
                          {order.status === 'PENDING' ? '待接單' : order.status === 'PUBLISHED' ? '待搶單' : order.status === 'ASSIGNED' ? '已指派' : order.status === 'ACCEPTED' ? '已接單' : order.status === 'ARRIVED' ? '已抵達' : order.status === 'IN_PROGRESS' ? '進行中' : order.status === 'COMPLETED' ? '已完成' : order.status === 'CANCELLED' ? '已取消' : order.status}
                        </span>
                        {isKenichi && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30">
                            肯驛
                          </span>
                        )}
                      </div>
                      {/* Row 2: Pickup → Dropoff */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#a0a0a0]">
                        <span className="truncate flex-1">{order.pickupLocation}</span>
                        <span className="text-[#666] flex-shrink-0">→</span>
                        <span className="truncate flex-1 text-right">{order.dropoffLocation}</span>
                      </div>
                      {/* Row 3: Driver */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#666]">
                        <span>承接：</span>
                        {order.driver ? (
                          <span className="text-[#a0a0a0]">{order.driver.user.name} ({order.driver.licensePlate})</span>
                        ) : (
                          <span className="text-[#444]">待指派</span>
                        )}
                        <span className="ml-auto text-[#444] font-mono">
                          {order.scheduledTime ? format(parseISO(order.scheduledTime), 'MM/dd HH:mm', { locale: zhTW }) : '-'}
                        </span>
                      </div>
                      {/* Assign Driver Section for PUBLISHED */}
                      {order.status === 'PUBLISHED' && (
                        <div className="border-t border-white/5 pt-2 mt-2">
                          <div className="flex flex-wrap gap-1">
                            {drivers
                              .filter(d => d.status === 'ONLINE')
                              .map(driver => (
                                <button
                                  key={driver.id}
                                  onClick={() => handleAssignDriver(order.id, driver.id)}
                                  disabled={actionLoading === order.id}
                                  className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-[#a0a0a0] hover:text-white transition-all disabled:opacity-50"
                                >
                                  {driver.user.name} ({driver.licensePlate})
                                </button>
                              ))}
                            {drivers.filter(d => d.status === 'ONLINE').length === 0 && (
                              <span className="text-xs text-[#444]">目前沒有在線司機</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )})
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
