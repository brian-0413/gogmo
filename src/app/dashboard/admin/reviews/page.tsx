'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { FileText, Check, X, Loader2 } from 'lucide-react'

export default function AdminReviewsPage() {
  const { user, token, isLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'DRIVER' | 'DISPATCHER'>('DRIVER')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectingUser, setRejectingUser] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!token) return
    fetch(`/api/admin/reviews?role=${activeTab}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data.users); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token, activeTab])

  const handleAction = async (userId: string, action: 'approve' | 'reject', note?: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/reviews/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, note }),
      })
      const data = await res.json()
      if (data.success) {
        setUsers(prev => prev.filter(u => u.id !== userId))
        setRejectingUser(null)
        setRejectNote('')
      } else {
        alert(data.error || '操作失敗')
      }
    } catch { alert('網路錯誤') }
    setActionLoading(null)
  }

  if (isLoading || !user) return <div className="p-8 text-center">載入中...</div>

  return (
    <div className="min-h-screen bg-[#FAF7F5] p-6">
      <h1 className="text-2xl font-bold text-[#222222] mb-6">帳號審核管理</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('DRIVER')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'DRIVER' ? 'bg-[#0C447C] text-white' : 'bg-white border text-[#717171]'}`}>
          司機待審核 ({users.length})
        </button>
        <button onClick={() => setActiveTab('DISPATCHER')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'DISPATCHER' ? 'bg-[#FF385C] text-white' : 'bg-white border text-[#717171]'}`}>
          派單方待審核 ({users.length})
        </button>
      </div>

      {/* User list */}
      {loading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#717171]" /></div>
       : users.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border">
          <p className="text-[#717171]">目前沒有待審核的{activeTab === 'DRIVER' ? '司機' : '派單方'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map(u => (
            <div key={u.id} className="bg-white border border-[#DDDDDD] rounded-xl p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-[#222222]">{u.name}</p>
                  <p className="text-sm text-[#717171]">{u.email} | {u.phone}</p>
                  <p className="text-xs text-[#A8A29E] mt-1">申請時間: {new Date(u.createdAt).toLocaleDateString('zh-TW')}</p>
                </div>
                <Badge className={u.role === 'DRIVER' ? 'bg-[#E6F1FB] text-[#0C447C]' : 'bg-[#FFF3E0] text-[#B45309]'}>
                  {u.role === 'DRIVER' ? '司機' : '派單方'}
                </Badge>
              </div>

              {/* Details */}
              {u.role === 'DRIVER' && u.driver ? (
                <div className="grid grid-cols-2 gap-2 text-sm mb-3 bg-[#F7F7F7] rounded-lg p-3">
                  <div>車牌：<span className="font-mono font-bold">{u.driver.licensePlate}</span></div>
                  <div>車廠：<span className="font-bold">{u.driver.carBrand}</span></div>
                  <div>車型：<span className="font-bold">{u.driver.carModel}</span></div>
                  <div>車色：<span className="font-bold">{u.driver.carColor}</span></div>
                  <div>車型：<span className="font-bold">{u.driver.carType}</span></div>
                </div>
              ) : u.dispatcher ? (
                <div className="grid grid-cols-2 gap-2 text-sm mb-3 bg-[#F7F7F7] rounded-lg p-3">
                  <div>公司：<span className="font-bold">{u.dispatcher.companyName}</span></div>
                  <div>統編：<span className="font-mono font-bold">{u.dispatcher.taxId}</span></div>
                  <div>電話：<span className="font-bold">{u.dispatcher.contactPhone}</span></div>
                </div>
              ) : null}

              {/* Documents */}
              {u.documents && u.documents.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[#717171] mb-1">文件：</p>
                  <div className="flex flex-wrap gap-2">
                    {u.documents.map((doc: any) => (
                      <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-[#F4EFE9] border border-[#DDDDDD] rounded-lg text-xs text-[#717171] hover:text-[#222222] hover:border-[#222222] transition-colors">
                        {doc.type === 'DRIVER_LICENSE' ? '駕照' :
                         doc.type === 'VEHICLE_REGISTRATION' ? '行照' :
                         doc.type === 'INSURANCE' ? '保險證' :
                         doc.type === 'ID_CARD' ? '身分證' : '商業登記'}: {doc.fileName}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {rejectingUser === u.id ? (
                <div className="flex flex-col gap-2">
                  <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                    placeholder="請輸入拒絕原因（選填）"
                    className="w-full border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm resize-none" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(u.id, 'reject', rejectNote)}
                      disabled={actionLoading === u.id}
                      className="px-4 py-2 bg-[#E24B4A] text-white rounded-lg text-sm font-medium hover:bg-[#D73835] disabled:opacity-50">
                      {actionLoading === u.id ? '處理中...' : '確認拒絕'}
                    </button>
                    <button onClick={() => setRejectingUser(null)} className="px-4 py-2 border text-sm text-[#717171] rounded-lg">
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(u.id, 'approve')}
                    disabled={actionLoading === u.id}
                    className="px-4 py-2 bg-[#22C55E] text-white rounded-lg text-sm font-medium hover:bg-[#16A34A] disabled:opacity-50 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    通過
                  </button>
                  <button onClick={() => setRejectingUser(u.id)}
                    className="px-4 py-2 bg-white border border-[#E24B4A] text-[#E24B4A] rounded-lg text-sm font-medium hover:bg-[#FCEBEB] flex items-center gap-1">
                    <X className="w-4 h-4" />
                    拒絕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
