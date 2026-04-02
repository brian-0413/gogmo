'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil, Trash2, User, Clock, Check, X } from 'lucide-react'
import { formatOrderNo } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { OrderStatus } from '@/types'

interface DispatcherOrder {
  id: string
  status: OrderStatus
  type?: string
  vehicle?: string
  plateType?: string
  kenichiRequired?: boolean
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  dropoffLocation: string
  dropoffAddress: string
  passengerCount: number
  luggageCount: number
  scheduledTime: Date | string
  price: number
  note?: string | null
  notes?: string | null
  rawText?: string | null
  driver?: {
    user: { name: string }
    licensePlate: string
    carType: string
    carColor: string
  } | null
  createdAt: string
}

interface DispatcherOrderCardProps {
  order: DispatcherOrder
  token: string | null
  onUpdate: () => void
}

const TYPE_TAG_STYLE: Record<string, string> = {
  pickup: 'bg-[#E6F1FB] text-[#0C447C]',
  dropoff: 'bg-[#FFF3E0] text-[#92400E]',
  pickup_boat: 'bg-[#E0F7FA] text-[#006064]',
  dropoff_boat: 'bg-[#E0F7FA] text-[#006064]',
  transfer: 'bg-[#F4EFE9] text-[#717171]',
  charter: 'bg-[#F3E8FF] text-[#6B21A8]',
}

const STATUS_TAG_STYLE: Record<string, string> = {
  PENDING: 'bg-[#FCEBEB] text-[#A32D2D]',
  PUBLISHED: 'bg-[#FCEBEB] text-[#A32D2D]',
  ASSIGNED: 'bg-[#FFF3E0] text-[#B45309]',
  ACCEPTED: 'bg-[#FFF3E0] text-[#B45309]',
  ARRIVED: 'bg-[#E6F1FB] text-[#0C447C]',
  IN_PROGRESS: 'bg-[#E6F1FB] text-[#0C447C]',
  COMPLETED: 'bg-[#E8F5E8] text-[#008A05]',
  CANCELLED: 'bg-[#FCEBEB] text-[#A32D2D]',
}

const TYPE_LABELS: Record<string, string> = {
  pickup: '接機', dropoff: '送機', pickup_boat: '接船', dropoff_boat: '送船',
  transfer: '交通接駁', charter: '套裝', pending: '待確認',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待接單', PUBLISHED: '待接單', ASSIGNED: '已指派', ACCEPTED: '已接單',
  ARRIVED: '已抵達', IN_PROGRESS: '進行中', COMPLETED: '已完成', CANCELLED: '已取消',
}

const VEHICLE_LABELS: Record<string, string> = {
  small: '小車', suv: '休旅', van9: '9人座', any: '任意車',
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

  const orderNo = formatOrderNo(scheduledDate, order.id)
  const hasDriver = !!order.driver
  const isPending = order.status === 'PENDING' || order.status === 'PUBLISHED'
  const isImmutable = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(order.status)

  const typeTagStyle = TYPE_TAG_STYLE[order.type || ''] || 'bg-[#F4EFE9] text-[#717171]'
  const statusTagStyle = STATUS_TAG_STYLE[order.status] || 'bg-[#F4EFE9] text-[#717171]'
  const vehicleLabel = VEHICLE_LABELS[order.vehicle || ''] || ''
  const typeLabel = TYPE_LABELS[order.type || ''] || '待確認'
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
      className={`bg-white border rounded-xl p-4 transition-shadow duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${
        isPending ? 'border-[2px] border-solid border-[#E24B4A]' : 'border-[#DDDDDD]'
      }`}
    >
      {/* Top row: Status badge + order number (prominent) + time */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusTagStyle}`}>
          {statusLabel}
        </span>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#717171]" />
          <span className="text-[12px] text-[#717171] font-mono-nums">{format(scheduledDate, 'MM/dd')}</span>
          <span className="text-[14px] font-bold text-[#222222] font-mono-nums">{format(scheduledDate, 'HH:mm')}</span>
        </div>
      </div>

      {/* Route — largest, most prominent */}
      {isEditing ? (
        <div className="mb-3 space-y-2">
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">起點</label>
            {order.type === 'pickup' ? (
              <select
                className={inputClass}
                value={editForm.pickupLocation}
                onChange={e => setEditForm(f => ({ ...f, pickupLocation: e.target.value }))}
              >
                {AIRPORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                className={inputClass}
                value={editForm.pickupLocation}
                onChange={e => setEditForm(f => ({ ...f, pickupLocation: e.target.value }))}
                placeholder="起點"
              />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">終點</label>
            {order.type === 'dropoff' ? (
              <select
                className={inputClass}
                value={editForm.dropoffLocation}
                onChange={e => setEditForm(f => ({ ...f, dropoffLocation: e.target.value }))}
              >
                {AIRPORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                className={inputClass}
                value={editForm.dropoffLocation}
                onChange={e => setEditForm(f => ({ ...f, dropoffLocation: e.target.value }))}
                placeholder="終點"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <p className="text-[18px] font-bold text-[#222222] leading-snug tracking-tight">
            {order.pickupLocation} → {order.dropoffLocation}
          </p>
        </div>
      )}

      {/* Tags + order number */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${typeTagStyle}`}>
          {typeLabel}
        </span>
        {vehicleLabel && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#F4EFE9] text-[#717171]">
            {vehicleLabel}
          </span>
        )}
        {order.kenichiRequired && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#F3E8FF] text-[#6B21A8]">
            肯驛
          </span>
        )}
        <span className="ml-auto text-[14px] font-bold text-[#717171] font-mono-nums tracking-wider">#{orderNo}</span>
      </div>

      {/* Editable fields or display */}
      {isEditing ? (
        <div className="space-y-2 mb-3">
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">時間</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={editForm.scheduledTime}
              onChange={e => setEditForm(f => ({ ...f, scheduledTime: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">金額</label>
              <input
                type="number"
                className={inputClass}
                value={editForm.price}
                onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">人數</label>
              <input
                type="number"
                className={inputClass}
                value={editForm.passengerCount}
                onChange={e => setEditForm(f => ({ ...f, passengerCount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-medium">行李</label>
              <input
                type="number"
                className={inputClass}
                value={editForm.luggageCount}
                onChange={e => setEditForm(f => ({ ...f, luggageCount: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-medium">備註</label>
            <input
              type="text"
              className={inputClass}
              value={editForm.note}
              onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
              placeholder="填寫備註"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-3 text-[14px] text-[#717171]">
            <span className="font-medium">NT$<span className="text-[#FF385C] font-bold text-[20px]">{order.price.toLocaleString()}</span></span>
            <span>{order.passengerCount}人</span>
            <span>{order.luggageCount}行李</span>
          </div>
          {(order.note || order.notes) && (
            <div className="mb-3 text-[13px] text-[#B0B0B0] italic leading-snug">
              {order.note || order.notes}
            </div>
          )}
        </>
      )}

      {/* Bottom row: Price + Driver + Actions */}
      <div className="border-t border-[#DDDDDD] pt-3 flex items-center justify-between">
        {isImmutable && (
          <span className="text-[11px] text-[#B0B0B0] italic">司機已接單，無法修改</span>
        )}
        {!isImmutable && (
          <div />
        )}
        {hasDriver && !isEditing ? (
          <div className="text-right">
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#717171]" />
              <span className="text-[14px] font-bold text-[#222222]">{order.driver!.user.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[12px] font-bold px-1.5 py-0.5 bg-[#F4EFE9] text-[#717171] rounded font-mono-nums">{order.driver!.licensePlate}</span>
              <span className="text-[12px] text-[#717171]">{order.driver!.carColor} {order.driver!.carType}</span>
            </div>
          </div>
        ) : !isEditing ? (
          <span className="text-[14px] font-bold text-[#E24B4A]">等待司機接單</span>
        ) : (
          <div />
        )}
      </div>

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
    </div>
  )
}
