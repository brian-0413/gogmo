'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Pencil, X, Check, Trash2, Phone, MapPin, Calendar } from 'lucide-react'
import { VehicleType, VEHICLE_LABELS } from '@/lib/vehicle'

interface Customer {
  id: string
  name: string
  phone: string
  commonPickup?: string | null
  commonDropoff?: string | null
  preferredVehicle?: string | null
  notes?: string | null
  createdAt: string
  lastOrderAt?: string | null
}

interface NewCustomerForm {
  name: string
  phone: string
  commonPickup: string
  commonDropoff: string
  preferredVehicle: string
  notes: string
}

interface DriverCustomersProps {
  token: string
}

// 客戶偏好車型下拉（使用新系統 VehicleType）
const VEHICLE_OPTIONS = [
  { value: '', label: '未指定' },
  { value: VehicleType.SEDAN_5, label: VEHICLE_LABELS[VehicleType.SEDAN_5] },
  { value: VehicleType.SUV_5, label: VEHICLE_LABELS[VehicleType.SUV_5] },
  { value: VehicleType.MPV_7, label: VEHICLE_LABELS[VehicleType.MPV_7] },
  { value: VehicleType.VAN_9, label: VEHICLE_LABELS[VehicleType.VAN_9] },
]

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function isValidTaiwanPhone(phone: string): boolean {
  return /^(?:(?:\+886|886)?0?9\d{8})$/.test(phone.replace(/-/g, ''))
}

export function DriverCustomers({ token }: DriverCustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewCustomerForm>({
    name: '',
    phone: '',
    commonPickup: '',
    commonDropoff: '',
    preferredVehicle: '',
    notes: '',
  })

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/drivers/customers', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setCustomers(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [token])

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    )
  }, [customers, search])

  const set = (patch: Partial<NewCustomerForm>) =>
    setForm(prev => ({ ...prev, ...patch }))

  const resetForm = () => {
    setForm({ name: '', phone: '', commonPickup: '', commonDropoff: '', preferredVehicle: '', notes: '' })
  }

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      alert('姓名和電話為必填欄位')
      return
    }
    if (!isValidTaiwanPhone(form.phone)) {
      alert('請輸入有效的手機號碼（例：0912345678）')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/drivers/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          commonPickup: form.commonPickup.trim() || undefined,
          commonDropoff: form.commonDropoff.trim() || undefined,
          preferredVehicle: form.preferredVehicle || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchCustomers()
        setShowAddModal(false)
        resetForm()
      } else {
        alert(data.error || '新增失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id: string) => {
    if (!form.name.trim() || !form.phone.trim()) {
      alert('姓名和電話為必填欄位')
      return
    }
    if (!isValidTaiwanPhone(form.phone)) {
      alert('請輸入有效的手機號碼')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/drivers/customers/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          commonPickup: form.commonPickup.trim() || undefined,
          commonDropoff: form.commonDropoff.trim() || undefined,
          preferredVehicle: form.preferredVehicle || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchCustomers()
        setEditingId(null)
        resetForm()
      } else {
        alert(data.error || '更新失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這位客戶嗎？\n此操作不會影響歷史訂單。')) return
    try {
      const res = await fetch(`/api/drivers/customers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setCustomers(prev => prev.filter(c => c.id !== id))
      } else {
        alert(data.error || '刪除失敗')
      }
    } catch {
      alert('網路錯誤')
    }
  }

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id)
    setForm({
      name: customer.name,
      phone: customer.phone,
      commonPickup: customer.commonPickup || '',
      commonDropoff: customer.commonDropoff || '',
      preferredVehicle: customer.preferredVehicle || '',
      notes: customer.notes || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名或電話..."
            className="w-full pl-9 pr-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#FF385C]"
          />
        </div>
        <button
          onClick={() => { setShowAddModal(true); resetForm() }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#FF385C] text-white text-[13px] font-bold rounded-lg hover:bg-[#E83355] transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增客戶
        </button>
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="text-center py-12 text-[#78716C]">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white border border-[#DDDDDD] rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-[#F4EFE9] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-3">
            <Phone className="w-5 h-5 text-[#D6D3D1]" />
          </div>
          <p className="text-[14px] text-[#717171]">
            {search ? '找不到符合的客戶' : '還沒有任何客戶'}
          </p>
          <p className="text-[12px] text-[#A8A29E] mt-1">
            {search ? '嘗試不同的關鍵字' : '旅客透過 QR 單下單後會自動加入'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2.5 bg-[#F4EFE9] border-b border-[#DDDDDD] text-[11px] font-bold text-[#717171] uppercase tracking-wider">
            <span>姓名</span>
            <span>電話</span>
            <span>常用上車地</span>
            <span>常用目的地</span>
            <span>最後下單</span>
            <span>操作</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#F0EDE8]">
            {filtered.map(customer => (
              <div key={customer.id}>
                {editingId === customer.id ? (
                  <div className="p-4 bg-[#FFF3E0]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">姓名 *</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => set({ name: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] focus:outline-none focus:border-[#FF385C] bg-white"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">電話 *</label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={e => set({ phone: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] focus:outline-none focus:border-[#FF385C] bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">常用上車地</label>
                        <input
                          type="text"
                          value={form.commonPickup}
                          onChange={e => set({ commonPickup: e.target.value })}
                          placeholder="例：新竹火車站"
                          className="mt-1 w-full px-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] focus:outline-none focus:border-[#FF385C] bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">常用目的地</label>
                        <input
                          type="text"
                          value={form.commonDropoff}
                          onChange={e => set({ commonDropoff: e.target.value })}
                          placeholder="例：桃園國際機場"
                          className="mt-1 w-full px-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] focus:outline-none focus:border-[#FF385C] bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">偏好車型</label>
                        <select
                          value={form.preferredVehicle}
                          onChange={e => set({ preferredVehicle: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] focus:outline-none focus:border-[#FF385C] bg-white"
                        >
                          {VEHICLE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#717171] uppercase tracking-wider">備註</label>
                        <input
                          type="text"
                          value={form.notes}
                          onChange={e => set({ notes: e.target.value })}
                          placeholder="例：容易暈車"
                          className="mt-1 w-full px-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] focus:outline-none focus:border-[#FF385C] bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleEdit(customer.id)}
                        disabled={saving}
                        className="flex-1 py-2 bg-[#22C55E] text-white text-[13px] font-bold rounded-lg hover:bg-[#16A34A] disabled:opacity-60 transition-colors"
                      >
                        {saving ? '儲存中...' : '儲存'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-white border border-[#DDDDDD] text-[#717171] text-[13px] font-bold rounded-lg hover:border-[#FF385C] hover:text-[#FF385C] transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 hover:bg-[#F9F7F4]/50 transition-colors">
                    {/* Mobile: stacked layout */}
                    <div className="flex items-start justify-between md:grid md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-2">
                      <div className="md:hidden font-bold text-[14px] text-[#222222]">{customer.name}</div>
                      <div className="hidden md:block text-[13px] font-medium text-[#222222]">{customer.name}</div>
                      <div className="hidden md:flex items-center gap-1.5 text-[13px] text-[#717171]">
                        <Phone className="w-3.5 h-3.5 text-[#A8A29E]" />
                        {customer.phone}
                      </div>
                      <div className="hidden md:flex items-center gap-1.5 text-[12px] text-[#717171]">
                        {customer.commonPickup ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-[#A8A29E]" />
                            <span className="truncate max-w-[100px]">{customer.commonPickup}</span>
                          </>
                        ) : <span className="text-[#A8A29E]">-</span>}
                      </div>
                      <div className="hidden md:flex items-center gap-1.5 text-[12px] text-[#717171]">
                        {customer.commonDropoff ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-[#A8A29E]" />
                            <span className="truncate max-w-[100px]">{customer.commonDropoff}</span>
                          </>
                        ) : <span className="text-[#A8A29E]">-</span>}
                      </div>
                      <div className="hidden md:flex items-center gap-1.5 text-[12px] text-[#717171]">
                        {customer.lastOrderAt ? (
                          <>
                            <Calendar className="w-3.5 h-3.5 text-[#A8A29E]" />
                            {formatDate(customer.lastOrderAt)}
                          </>
                        ) : <span className="text-[#A8A29E]">-</span>}
                      </div>

                      {/* Mobile info row */}
                      <div className="md:hidden flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#717171] mt-1">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>
                        {customer.commonPickup && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.commonPickup}</span>}
                        {customer.lastOrderAt && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(customer.lastOrderAt)}</span>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(customer)}
                          className="text-[#717171] hover:text-[#FF385C] transition-colors p-1"
                          title="編輯"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="text-[#A8A29E] hover:text-[#E24B4A] transition-colors p-1"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EDE8]">
              <h3 className="text-[16px] font-bold text-[#222222]">新增客戶</h3>
              <button
                onClick={() => { setShowAddModal(false); resetForm() }}
                className="text-[#A8A29E] hover:text-[#222222] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-[#717171] uppercase tracking-wider">
                  姓名 <span className="text-[#FF385C]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="例：王小明"
                  maxLength={50}
                  className="mt-1 w-full px-3 py-2.5 border border-[#DDDDDD] rounded-xl text-[14px] focus:outline-none focus:border-[#FF385C]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-[#717171] uppercase tracking-wider">
                  電話 <span className="text-[#FF385C]">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set({ phone: e.target.value })}
                  placeholder="例：0912345678"
                  maxLength={15}
                  className="mt-1 w-full px-3 py-2.5 border border-[#DDDDDD] rounded-xl text-[14px] focus:outline-none focus:border-[#FF385C]"
                />
                {!isValidTaiwanPhone(form.phone) && form.phone.length > 0 && (
                  <p className="text-[11px] text-[#E24B4A] mt-1">請輸入有效的手機號碼（例：0912345678）</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-[#717171] uppercase tracking-wider">常用上車地</label>
                  <input
                    type="text"
                    value={form.commonPickup}
                    onChange={e => set({ commonPickup: e.target.value })}
                    placeholder="例：新竹火車站"
                    className="mt-1 w-full px-3 py-2.5 border border-[#DDDDDD] rounded-xl text-[14px] focus:outline-none focus:border-[#FF385C]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#717171] uppercase tracking-wider">常用目的地</label>
                  <input
                    type="text"
                    value={form.commonDropoff}
                    onChange={e => set({ commonDropoff: e.target.value })}
                    placeholder="例：桃園國際機場"
                    className="mt-1 w-full px-3 py-2.5 border border-[#DDDDDD] rounded-xl text-[14px] focus:outline-none focus:border-[#FF385C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-[#717171] uppercase tracking-wider">偏好車型</label>
                <select
                  value={form.preferredVehicle}
                  onChange={e => set({ preferredVehicle: e.target.value })}
                  className="mt-1 w-full px-3 py-2.5 border border-[#DDDDDD] rounded-xl text-[14px] focus:outline-none focus:border-[#FF385C]"
                >
                  {VEHICLE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] font-bold text-[#717171] uppercase tracking-wider">備註</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => set({ notes: e.target.value })}
                  placeholder="例：容易暈車、有嬰兒"
                  maxLength={200}
                  className="mt-1 w-full px-3 py-2.5 border border-[#DDDDDD] rounded-xl text-[14px] focus:outline-none focus:border-[#FF385C]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-[#F0EDE8] flex gap-3">
              <button
                onClick={() => { setShowAddModal(false); resetForm() }}
                className="flex-1 py-2.5 bg-white border border-[#DDDDDD] text-[#717171] text-[14px] font-bold rounded-xl hover:border-[#FF385C] hover:text-[#FF385C] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#FF385C] text-white text-[14px] font-bold rounded-xl hover:bg-[#E83355] disabled:opacity-60 transition-colors"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
