'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil, Trash2, User, Check, X } from 'lucide-react'
import { formatOrderNo } from '@/lib/utils'
import { ProgressBar } from '@/components/driver/ProgressBar'
import { DocumentViewerModal } from './DocumentViewerModal'
import { TYPE_TAG_STYLE, STATUS_TAG_STYLE, TYPE_LABELS, STATUS_LABELS, VEHICLE_LABELS } from '@/lib/constants'
import type { Order, OrderStatus, OrderType, VehicleType } from '@/types'

interface DispatcherOrderCardProps {
  order: Order
  token: string | null
  onUpdate: () => void
}

const AIRPORT_OPTIONS = [
  { value: '桃園機場', label: '桃園機場' },
  { value: '松山機場', label: '松山機場' },
  { value: '清泉崗機場', label: '清泉崗機場' },
  { value: '小港機場', label: '小港機場' },
]

interface EditForm {
  pickupLocation: string
  dropoffLocation: string
  scheduledTime: string
  price: string
  passengerCount: string
  luggageCount: string
  note: string
}

export function DispatcherOrderCard({ order, token, onUpdate }: DispatcherOrderCardProps) {
  const scheduledDate = typeof order.scheduledTime === 'string'
    ? parseISO(order.scheduledTime)
    : order.scheduledTime

  const orderNo = formatOrderNo(scheduledDate, order.orderSeq)
  const hasDriver = !!order.driver
  const isPending = order.status === 'PENDING' || order.status === 'PUBLISHED'
  const isImmutable = ['ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'PICKED_UP', 'COMPLETED'].includes(order.status)

  const typeTagStyle = TYPE_TAG_STYLE[order.type || ''] || 'bg-[#F4EFE9] text-[#717171]'
  const statusTagStyle = STATUS_TAG_STYLE[order.status] || 'bg-[#F4EFE9] text-[#717171]'
  const vehicleLabel = VEHICLE_LABELS[(order.vehicle || '') as VehicleType] || ''
  const typeLabel = TYPE_LABELS[(order.type || '') as OrderType] || '待確認'
  const statusLabel = STATUS_LABELS[order.status] || order.status

  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    pickupLocation: order.pickupLocation,
    dropoffLocation: order.dropoffLocation,
    scheduledTime: format(scheduledDate, "yyyy-MM-dd'T'HH:mm"),
    price: String(order.price),
    passengerCount: String(order.passengerCount),
    luggageCount: String(order.luggageCount),
    note: order.note || order.notes || '',
  })
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [viewingDocuments, setViewingDocuments] = useState(false)

  const handleSave = async () => {
    if (!token) return
    setSaveLoading(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pickupLocation: editForm.pickupLocation,
          dropoffLocation: editForm.dropoffLocation,
          pickupAddress: editForm.pickupLocation,
          dropoffAddress: editForm.dropoffLocation,
          scheduledTime: editForm.scheduledTime,
          price: Number(editForm.price),
          passengerCount: Number(editForm.passengerCount),
          luggageCount: Number(editForm.luggageCount),
          note: editForm.note,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setIsEditing(false)
        onUpdate()
      } else {
        alert(data.error || '儲存失敗')
      }
    } catch { alert('網路錯誤') }
    finally { setSaveLoading(false) }
  }

  const handleDelete = async () => {
    if (!token) return
    if (!confirm('確定要刪除這筆行程嗎？')) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ _action: 'delete' }),
      })
      const data = await res.json()
      if (data.success) onUpdate()
      else alert(data.error || '刪除失敗')
    } catch { alert('網路錯誤') }
    finally { setDeleteLoading(false) }
  }

  const handleCancel = () => {
    setEditForm({
      pickupLocation: order.pickupLocation,
      dropoffLocation: order.dropoffLocation,
      scheduledTime: format(scheduledDate, "yyyy-MM-dd'T'HH:mm"),
      price: String(order.price),
      passengerCount: String(order.passengerCount),
      luggageCount: String(order.luggageCount),
      note: order.note || order.notes || '',
    })
    setIsEditing(false)
  }

  const inputClass = "w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2 text-[14px] text-[#222222] focus:outline-none focus:border-[#222222] font-mono-nums"

  return (
    <div
      className={`bg-white border rounded-xl p-3 sm:p-4 transition-shadow duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${
        isPending ? 'border-[2px] border-solid border-[#E24B4A]' : 'border-[#DDDDDD]'
      }`}
    >
      {/* 第一行：單號 + 狀態（派單方最重視） */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-3 py-1.5 bg-[#FF385C] text-white text-[15px] font-bold font-mono-nums rounded select-all">
            #{orderNo}
          </span>
          <span className={`inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded ${statusTagStyle}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#717171] font-mono-nums">{format(scheduledDate, 'MM/dd')}</span>
          <span className="text-[15px] font-bold text-[#222222] font-mono-nums">{format(scheduledDate, 'HH:mm')}</span>
          {order.flightNumber && (
            <span className="bg-[#F4EFE9] px-2 py-1 rounded font-mono-nums text-[13px] text-[#717171] font-bold">
              {order.flightNumber}
            </span>
          )}
        </div>
      </div>

      {/* 司機資訊區塊（派單方第二重視） */}
      {hasDriver && !isEditing ? (
        <div className="bg-[#F4EFE9] border border-[#E5DDD3] rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#717171]" />
              <span className="text-[15px] font-bold text-[#222222]">{order.driver?.user?.name}</span>
            </div>
            <div className="h-4 w-px bg-[#DDDDDD]" />
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold px-2 py-0.5 bg-[#222222] text-white rounded font-mono-nums">{order.driver?.licensePlate}</span>
              <span className="text-[13px] text-[#717171]">{order.driver?.carColor} {order.driver?.carType}</span>
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!token) return
                  setViewingDocuments(true)
                }}
                className="ml-auto text-[11px] px-2 py-1 bg-[#0C447C] text-white rounded hover:bg-[#0A3570] transition-colors"
              >
                查看證件
              </button>
            </div>
          </div>
        </div>
      ) : !isEditing ? (
        <div className="mb-3 px-3 py-2 bg-[#FCEBEB] border border-[#F5C6C6] rounded-xl">
          <span className="text-[13px] font-bold text-[#E24B4A]">等待司機接單</span>
        </div>
      ) : null}

      {/* 進度條（僅司機已接單後顯示） */}
      {['ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'PICKED_UP', 'COMPLETED'].includes(order.status) && order.driver && (
        <div className="px-4 pb-3 -mt-1">
          <ProgressBar status={order.status} size="sm" showLabel={true} animateNext={true} />
          <p className="text-[11px] text-[#717171] mt-1 text-center">
            司機：{order.driver?.user?.name}
          </p>
        </div>
      )}

      {/* 起訖點 */}
      {isEditing ? (
        <div className="mb-3 space-y-2">
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">起點</label>
            {order.type === 'pickup' ? (
              <select className={inputClass} value={editForm.pickupLocation} onChange={e => setEditForm(f => ({ ...f, pickupLocation: e.target.value }))}>
                {AIRPORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input className={inputClass} value={editForm.pickupLocation} onChange={e => setEditForm(f => ({ ...f, pickupLocation: e.target.value }))} placeholder="起點" />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">終點</label>
            {order.type === 'dropoff' ? (
              <select className={inputClass} value={editForm.dropoffLocation} onChange={e => setEditForm(f => ({ ...f, dropoffLocation: e.target.value }))}>
                {AIRPORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input className={inputClass} value={editForm.dropoffLocation} onChange={e => setEditForm(f => ({ ...f, dropoffLocation: e.target.value }))} placeholder="終點" />
            )}
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <p className="text-[15px] font-bold text-[#717171]">{order.pickupLocation} → {order.dropoffLocation}</p>
        </div>
      )}

      {/* 第三行：種類 + 車型 + 肯驛 + 金額 */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded ${typeTagStyle}`}>
            {typeLabel}
          </span>
          {vehicleLabel && (
            <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
              {vehicleLabel}
            </span>
          )}
          {order.kenichiRequired && (
            <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">
              肯驛
            </span>
          )}
        </div>
        <span className="text-[18px] font-bold font-mono-nums text-[#FF385C]">
          NT${order.price.toLocaleString()}
        </span>
      </div>

      {/* 人數行李（附屬） */}
      {isEditing ? (
        <div className="space-y-2 mb-3">
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">時間</label>
            <input type="datetime-local" className={inputClass} value={editForm.scheduledTime} onChange={e => setEditForm(f => ({ ...f, scheduledTime: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">金額</label>
              <input type="number" className={inputClass} value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">人數</label>
              <input type="number" className={inputClass} value={editForm.passengerCount} onChange={e => setEditForm(f => ({ ...f, passengerCount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">行李</label>
              <input type="number" className={inputClass} value={editForm.luggageCount} onChange={e => setEditForm(f => ({ ...f, luggageCount: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">備註</label>
            <input type="text" className={inputClass} value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="填寫備註" />
          </div>
        </div>
      ) : (
        <div className="text-[13px] text-[#717171] mb-3">
          <span className="font-medium">{order.passengerCount}人</span>
          <span className="mx-2">/</span>
          <span className="font-medium">{order.luggageCount}行李</span>
          {(order.note || order.notes) && (
            <span className="ml-2 italic">備註：{order.note || order.notes}</span>
          )}
        </div>
      )}

      {/* 附屬資訊：司機已接單時顯示鎖定提示 */}
      {isImmutable && (
        <div className="text-[11px] text-[#B0B0B0] italic mb-3">司機已接單，無法修改</div>
      )}

      {/* Action buttons — always visible */}
      <div className="flex gap-2 mt-3">
        {isImmutable ? (
          <>
            <button
              disabled
              className="flex-1 py-2 rounded-lg text-[14px] font-bold bg-[#F4EFE9] text-[#B0B0B0] cursor-not-allowed flex items-center justify-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" /> 編輯
            </button>
            <button
              disabled
              className="flex-1 py-2 rounded-lg text-[14px] font-bold bg-[#F4EFE9] text-[#B0B0B0] cursor-not-allowed flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> 刪除
            </button>
          </>
        ) : isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="flex-1 py-2 rounded-lg text-[14px] font-bold bg-[#008A05] text-white hover:bg-[#007000] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> {saveLoading ? '儲存中...' : '儲存'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saveLoading}
              className="flex-1 py-2 rounded-lg text-[14px] font-bold bg-white border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] transition-colors flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> 取消
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 py-2 rounded-lg text-[14px] font-bold bg-[#E6F1FB] text-[#0C447C] hover:bg-[#C2DBF5] transition-colors flex items-center justify-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" /> 編輯
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex-1 py-2 rounded-lg text-[14px] font-bold bg-[#FCEBEB] text-[#A32D2D] hover:bg-[#F5C6C6] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {deleteLoading ? '刪除中...' : '刪除'}
            </button>
          </>
        )}
      </div>

      {viewingDocuments && order.driver && (
        <DocumentViewerModal
          driverId={order.driver.userId}
          driverName={order.driver.user?.name || ''}
          licensePlate={order.driver.licensePlate}
          token={token || ''}
          viewerRole="DISPATCHER"
          onClose={() => setViewingDocuments(false)}
        />
      )}
    </div>
  )
}
