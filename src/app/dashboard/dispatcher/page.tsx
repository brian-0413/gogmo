'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { parseBatchOrders, ParsedOrder, BatchOrderDefaults, TYPE_LABELS } from '@/lib/ai'
import { DispatcherOrderCard } from '@/components/dispatcher/OrderCard'
import { FleetControl } from '@/components/dispatcher/FleetControl'
import { SettlementTab } from '@/components/dispatcher/SettlementTab'
import { CreateDefaultsCard } from '@/components/dispatcher/CreateDefaultsCard'
import { ReviewItemCard, ReviewItemCardItem } from '@/components/dispatcher/ReviewItemCard'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { Order } from '@/types'
import {
  ClipboardList,
  Search,
  Plane,
  LogOut,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

type Tab = 'orders' | 'create' | 'review' | 'drivers' | 'settlement'

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

function generateId() {
  return Math.random().toString(36).substring(2, 9)
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

  // 派單方 SSE 即時接收狀態更新
  useEffect(() => {
    if (!token || user?.role !== 'DISPATCHER') return

    const es = new EventSource('/api/dispatchers/events')
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'ORDER_STATUS_CHANGE') {
          setOrders(prev => prev.map(order =>
            order.id === data.orderId
              ? {
                  ...order,
                  status: data.status,
                  startedAt: data.startedAt,
                  arrivedAt: data.arrivedAt,
                  pickedUpAt: data.pickedUpAt,
                  completedAt: data.completedAt,
                }
              : order
          ))
        }
      } catch {}
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [token, user?.role])

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

  const handleEditItem = (item: ReviewItemCardItem & { [key: string]: unknown }) => {
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
            <CreateDefaultsCard
              defaults={defaults}
              onChange={(newDefaults) => setDefaults(prev => ({ ...prev, ...newDefaults }))}
            />

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
                  <ReviewItemCard
                    key={item.reviewId}
                    item={item}
                    index={idx}
                    editingId={editingId}
                    editForm={editForm}
                    onEdit={handleEditItem}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                    onDelete={handleDeleteItem}
                    onEditFormChange={setEditForm}
                  />
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
