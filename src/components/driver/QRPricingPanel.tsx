'use client'

import { useState, useEffect } from 'react'
import { QrCode, Plus, Pencil, Check, X } from 'lucide-react'
import { VehicleType, VEHICLE_LABELS } from '@/lib/vehicle'

interface PricingItem {
  id: string
  vehicleType: string
  price: number
  enabled: boolean
}

interface QRPricingPanelProps {
  token: string
  driverId: string
  licensePlate: string
  qrCodeUrl?: string
}

// QR 落地頁車型顯示（只顯示前 4 種，CUSTOM 不在 QR 定價中）
const ALL_VEHICLE_TYPES: VehicleType[] = [
  VehicleType.SEDAN_5,
  VehicleType.SUV_5,
  VehicleType.MPV_7,
  VehicleType.VAN_9,
]

export function QRPricingPanel({ token, driverId, licensePlate, qrCodeUrl }: QRPricingPanelProps) {
  const [pricing, setPricing] = useState<PricingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addVehicleType, setAddVehicleType] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)

  const fetchPricing = async () => {
    try {
      const res = await fetch('/api/drivers/pricing', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setPricing(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [token])

  const startEdit = (item: PricingItem) => {
    setEditingId(item.id)
    setEditPrice(String(item.price))
    setEditEnabled(item.enabled)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditPrice('')
    setEditEnabled(true)
  }

  const saveEdit = async (id: string) => {
    const price = parseInt(editPrice, 10)
    if (isNaN(price) || price <= 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/drivers/pricing/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price, enabled: editEnabled }),
      })
      const data = await res.json()
      if (data.success) {
        setPricing(prev => prev.map(p => p.id === id ? { ...p, price, enabled: editEnabled } : p))
        setEditingId(null)
      } else {
        alert(data.error || '更新失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (item: PricingItem) => {
    try {
      const res = await fetch(`/api/drivers/pricing/${item.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price: item.price, enabled: !item.enabled }),
      })
      const data = await res.json()
      if (data.success) {
        setPricing(prev => prev.map(p => p.id === item.id ? { ...p, enabled: !p.enabled } : p))
      }
    } catch {
      alert('網路錯誤')
    }
  }

  const handleAdd = async () => {
    if (!addVehicleType || !addPrice) return
    const price = parseInt(addPrice, 10)
    if (isNaN(price) || price <= 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/drivers/pricing', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vehicleType: addVehicleType, price }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchPricing()
        setShowAddForm(false)
        setAddVehicleType('')
        setAddPrice('')
      } else {
        alert(data.error || '新增失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個車型報價嗎？')) return
    try {
      const res = await fetch(`/api/drivers/pricing/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setPricing(prev => prev.filter(p => p.id !== id))
      } else {
        alert(data.error || '刪除失敗')
      }
    } catch {
      alert('網路錯誤')
    }
  }

  const fetchQRCode = async () => {
    setQrLoading(true)
    try {
      const res = await fetch('/api/drivers/qrcode', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && data.data?.qrCodeUrl) {
        window.open(data.data.qrCodeUrl, '_blank')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setQrLoading(false)
    }
  }

  const bookUrl = `goGMO.com/book/${driverId}`

  // Fill in missing vehicle types with empty entries
  const pricingMap: Record<string, PricingItem | undefined> = {}
  for (const p of pricing) {
    pricingMap[p.vehicleType] = p
  }

  return (
    <div className="space-y-6">
      {/* QR Code Section */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="w-5 h-5 text-[#FF385C]" />
          <h3 className="text-[15px] font-bold text-[#222222]">我的 QR 貴賓單</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* QR placeholder */}
          <div className="w-24 h-24 bg-[#F4EFE9] rounded-xl flex items-center justify-center border-2 border-dashed border-[#DDDDDD] flex-shrink-0 mx-auto sm:mx-0">
            {qrCodeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodeUrl} alt="QR Code" className="w-full h-full rounded-xl object-contain" />
            ) : (
              <QrCode className="w-10 h-10 text-[#DDDDDD]" />
            )}
          </div>

          <div className="flex-1">
            <p className="text-[13px] text-[#717171] mb-2">
              分享連結給貴賓，掃描後直接填寫預訂
            </p>
            <div className="bg-[#F4EFE9] border border-[#DDDDDD] rounded-lg px-3 py-2 mb-3">
              <span className="text-[12px] text-[#717171]">預覽連結：</span>
              <span className="text-[13px] font-bold font-mono-nums text-[#FF385C]">{bookUrl}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchQRCode}
                disabled={qrLoading}
                className="px-4 py-2 bg-[#FF385C] text-white text-[13px] font-bold rounded-lg hover:bg-[#E83355] transition-colors disabled:opacity-60"
              >
                {qrLoading ? '產生中...' : '下載 QR Code'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing List */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-[#222222]">報價設定</h3>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#F59E0B] text-white text-[12px] font-bold rounded-lg hover:bg-[#D97706] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新增車型
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[#78716C]">載入中...</div>
        ) : (
          <div className="space-y-3">
            {ALL_VEHICLE_TYPES.map(vtype => {
              const item = pricingMap[vtype]
              const isEditing = editingId === item?.id

              if (showAddForm && addVehicleType === vtype) {
                return (
                  <div key={vtype} className="bg-[#FFF3E0] border border-[#F59E0B]/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-[#222222]">{VEHICLE_LABELS[vtype]}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-[#717171]">NT$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={addPrice}
                          onChange={e => {
                            const digits = e.target.value.replace(/[^\d]/g, '')
                            setAddPrice(digits)
                          }}
                          placeholder="填寫價格"
                          className="w-28 px-3 py-2 border-2 border-[#DDDDDD] rounded-lg text-[13px] outline-none focus:border-[#FF385C] bg-white"
                          autoFocus
                        />
                      </div>
                      <span className="text-[12px] text-[#717171]">元 / 趟</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAdd}
                        disabled={saving || !addPrice}
                        className="flex-1 py-2 bg-[#FF385C] text-white text-[13px] font-bold rounded-lg hover:bg-[#E83355] disabled:opacity-60 transition-colors"
                      >
                        {saving ? '儲存中...' : '儲存'}
                      </button>
                      <button
                        onClick={() => { setShowAddForm(false); setAddVehicleType(''); setAddPrice('') }}
                        className="px-4 py-2 bg-white border border-[#DDDDDD] text-[#717171] text-[13px] font-bold rounded-lg hover:border-[#FF385C] hover:text-[#FF385C] transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )
              }

              if (!item) {
                return (
                  <div key={vtype} className="flex items-center justify-between py-3 border-b border-[#F0EDE8] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-[#717171]">{VEHICLE_LABELS[vtype]}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#FFF3E0] text-[#B45309] border border-[#F59E0B]/20">
                        尚未設定
                      </span>
                    </div>
                    <button
                      onClick={() => { setShowAddForm(true); setAddVehicleType(vtype) }}
                      className="flex items-center gap-1 text-[12px] text-[#FF385C] font-bold hover:text-[#E83355] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      設定
                    </button>
                  </div>
                )
              }

              if (isEditing) {
                return (
                  <div key={item.id} className="bg-[#FFF3E0] border border-[#F59E0B]/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-[#222222]">{VEHICLE_LABELS[item.vehicleType as VehicleType]}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={saving}
                          className="w-7 h-7 rounded-lg bg-[#22C55E] text-white flex items-center justify-center hover:bg-[#16A34A] disabled:opacity-60 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="w-7 h-7 rounded-lg bg-white border border-[#DDDDDD] text-[#717171] flex items-center justify-center hover:border-[#FF385C] hover:text-[#FF385C] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-[#717171]">NT$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editPrice}
                          onChange={e => {
                            const digits = e.target.value.replace(/[^\d]/g, '')
                            setEditPrice(digits)
                          }}
                          className="w-28 px-3 py-2 border-2 border-[#DDDDDD] rounded-lg text-[13px] outline-none focus:border-[#FF385C] bg-white"
                        />
                      </div>
                      <span className="text-[12px] text-[#717171]">元 / 趟</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`w-9 h-5 rounded-full relative transition-colors ${editEnabled ? 'bg-[#22C55E]' : 'bg-[#DDDDDD]'}`}
                          onClick={() => setEditEnabled(!editEnabled)}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${editEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-[12px] text-[#717171]">{editEnabled ? '啟用' : '停用'}</span>
                      </label>
                    </div>
                  </div>
                )
              }

              return (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-[#F0EDE8] last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${item.enabled ? 'bg-[#22C55E]' : 'bg-[#DDDDDD]'}`}
                    />
                    <span className="text-[14px] font-medium text-[#222222]">{VEHICLE_LABELS[item.vehicleType as VehicleType]}</span>
                    <span className={`text-[14px] font-bold font-mono-nums ${item.enabled ? 'text-[#FF385C]' : 'text-[#A8A29E]'}`}>
                      NT$ {item.price.toLocaleString()}
                    </span>
                    {!item.enabled && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4EFE9] text-[#A8A29E]">已停用</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEnabled(item)}
                      className={`text-[11px] px-2 py-1 rounded-lg font-bold transition-colors ${
                        item.enabled
                          ? 'text-[#22C55E] bg-[#F0FDF4] border border-[#22C55E]/20 hover:bg-[#DCFCE7]'
                          : 'text-[#A8A29E] bg-[#F4EFE9] border border-[#DDDDDD] hover:bg-[#F0EDE8]'
                      }`}
                    >
                      {item.enabled ? '啟用中' : '已停用'}
                    </button>
                    <button
                      onClick={() => startEdit(item)}
                      className="text-[#717171] hover:text-[#FF385C] transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-[#A8A29E] hover:text-[#E24B4A] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}

            {pricing.length === 0 && !showAddForm && (
              <div className="text-center py-8 text-[#78716C]">
                <p className="text-[13px]">尚未設定任何車型報價</p>
                <p className="text-[12px] text-[#A8A29E] mt-1">點擊「新增車型」開始設定</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-3 bg-[#FFF3E0] border border-[#F59E0B]/20 rounded-lg">
          <p className="text-[12px] text-[#B45309]">
            至少需設定一個車型 + 價格，QR 單才會生效。修改報價不影響既有訂單。
          </p>
        </div>
      </div>
    </div>
  )
}
