'use client'

import { Button } from '@/components/ui/Button'
import { Clock } from 'lucide-react'
import { TYPE_LABELS } from '@/lib/ai'

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

export interface ReviewItem {
  reviewId: string
  date?: string | null
  time?: string | null
  type: string
  vehicle?: string
  price?: number | null
  pickupLocation?: string
  dropoffLocation?: string
  rawText?: string
  notes?: string
  plateType?: string
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

export interface ReviewItemCardEditForm {
  scheduledTime?: string
  price?: number
  pickupLocation?: string
  dropoffLocation?: string
}

export interface ReviewItemCardProps {
  item: ReviewItem
  index: number
  editingId: string | null
  editForm: ReviewItemCardEditForm
  onEdit: (item: ReviewItem) => void
  onSave: (reviewId: string) => void
  onCancel: () => void
  onDelete: (reviewId: string) => void
  onEditFormChange: (form: ReviewItemCardEditForm) => void
}

export function ReviewItemCard({
  item, index, editingId, editForm,
  onEdit, onSave, onCancel, onDelete, onEditFormChange,
}: ReviewItemCardProps) {
  const isEditing = editingId === item.reviewId

  if (isEditing) {
    // 編輯模式
    return (
      <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 bg-[#FF385C] text-white text-[15px] font-bold font-mono-nums rounded select-all">
                #{index + 1}
              </span>
              <span className="text-[14px] font-medium text-[#222222]">編輯訂單</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[13px] text-[#717171] font-medium">時間</label>
              <input
                type="text"
                value={editForm.scheduledTime || ''}
                onChange={(e) => onEditFormChange({ ...editForm, scheduledTime: e.target.value })}
                className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] font-mono-nums focus:outline-none focus:border-[#222222]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] text-[#717171] font-medium">費用</label>
              <select
                value={editForm.price || ''}
                onChange={(e) => onEditFormChange({ ...editForm, price: parseInt(e.target.value) })}
                className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] font-mono-nums focus:outline-none focus:border-[#222222]"
              >
                {PRICE_OPTIONS.filter(p => p.value > 0).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[13px] text-[#717171] font-medium">上車地點</label>
            <input
              type="text"
              value={editForm.pickupLocation || ''}
              onChange={(e) => onEditFormChange({ ...editForm, pickupLocation: e.target.value })}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] focus:outline-none focus:border-[#222222]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[13px] text-[#717171] font-medium">下地點</label>
            <input
              type="text"
              value={editForm.dropoffLocation || ''}
              onChange={(e) => onEditFormChange({ ...editForm, dropoffLocation: e.target.value })}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-4 py-3 text-[#222222] text-[15px] focus:outline-none focus:border-[#222222]"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => onSave(item.reviewId)} className="text-[14px] px-6">儲存</Button>
            <Button variant="outline" onClick={onCancel} className="text-[14px] px-6">取消</Button>
          </div>
        </div>
      </div>
    )
  }

  // 顯示模式
  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="p-5">
        {/* 第一行：編號 + 種類 + 車型 + 肯驛 | 金額 | 編輯/刪除 */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-3 py-1.5 bg-[#FF385C] text-white text-[15px] font-bold font-mono-nums rounded select-all">
              #{index + 1}
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
              {TYPE_LABELS[item.type as keyof typeof TYPE_LABELS] || '待確認'}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
              {item.editedVehicle || '待確認'}
            </span>
            {item.editedKenichi && (
              <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">肯驛</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[28px] font-bold font-mono-nums text-[#FF385C] leading-none">
              NT${item.editedPrice ?? item.price ?? 800}
            </span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => onEdit(item)} className="text-[14px] py-1.5 px-3">編輯</Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(item.reviewId)} className="text-[#E24B4A] hover:bg-[#FCEBEB] text-[14px] py-1.5 px-3">刪除</Button>
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
    </div>
  )
}