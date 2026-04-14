'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Shield, LogOut, FileText, Check, X, Loader2, Settings, Users, ExternalLink, AlertTriangle, Calendar, Save } from 'lucide-react'
import Link from 'next/link'

interface DocInfo {
  id: string
  type: string
  fileName: string
  fileUrl?: string | null
  driveFileId?: string | null
  status: string
  expiryDate?: string | null
  uploadFailed: boolean
}

interface UserInfo {
  id: string
  name: string
  email: string
  phone: string
  role: 'DRIVER' | 'DISPATCHER'
  accountStatus: string
  createdAt: string
  driver?: {
    id: string
    licensePlate: string
    carType: string
    carBrand?: string | null
    carModel?: string | null
    carColor: string
  } | null
  dispatcher?: {
    id: string
    companyName: string
    taxId?: string | null
    contactPhone?: string | null
  } | null
  documents: DocInfo[]
}

const DOC_TYPE_LABELS: Record<string, string> = {
  DRIVER_LICENSE: '駕照',
  VEHICLE_REGISTRATION: '行照',
  INSURANCE: '保險證',
  ID_CARD: '身分證',
  BUSINESS_REGISTRATION: '商業登記',
}

export default function AdminReviewsPage() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'DRIVER' | 'DISPATCHER'>('DRIVER')
  const [users, setUsers] = useState<UserInfo[]>([])
  const [pendingCounts, setPendingCounts] = useState({ DRIVER: 0, DISPATCHER: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectingUser, setRejectingUser] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  // 每個使用者的文件到期日編輯狀態
  const [docExpiryDates, setDocExpiryDates] = useState<Record<string, string>>({})
  const [docExpirySaving, setDocExpirySaving] = useState<Record<string, boolean>>({})

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
      .then(d => {
        if (d.success) {
          setUsers(d.data.users)
          // 更新另一個 tab 的待審核數（如果存在）
          setPendingCounts(prev => ({
            ...prev,
            [activeTab]: d.data.count ?? d.data.users.length,
          }))
          // 初始化到期日狀態
          const expiryMap: Record<string, string> = {}
          d.data.users.forEach((u: UserInfo) => {
            u.documents.forEach(doc => {
              if (doc.expiryDate) {
                expiryMap[doc.id] = doc.expiryDate.split('T')[0]
              }
            })
          })
          setDocExpiryDates(expiryMap)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [token, activeTab])

  const handleAction = async (userId: string, action: 'approve' | 'reject', note?: string) => {
    setActionLoading(userId)
    try {
      // 收集所有文件的到期日
      const docs = users.find(u => u.id === userId)?.documents.map(d => ({
        id: d.id,
        expiryDate: docExpiryDates[d.id] || null,
      })) || []

      const res = await fetch(`/api/admin/reviews/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, note, documents: docs }),
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

  // 儲存單一文件到期日
  const handleSaveExpiry = async (docId: string) => {
    if (!token) return
    setDocExpirySaving(prev => ({ ...prev, [docId]: true }))
    try {
      const res = await fetch(`/api/admin/reviews/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expiryDate: docExpiryDates[docId] || null }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || '儲存失敗')
      }
    } catch { alert('網路錯誤') }
    setDocExpirySaving(prev => ({ ...prev, [docId]: false }))
  }

  // 檢查是否過期
  const isExpired = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  if (isLoading || !user) return <div className="p-8 text-center">載入中...</div>

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Header */}
      <header className="bg-[#FAF8F5] border-b border-[#DDDDDD] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1C1917] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-[18px] font-medium text-[#222222]">管理員後台</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#717171]">{user.name}</span>
              <Button variant="outline" size="sm" onClick={logout} className="text-[13px]">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-[#FAF8F5] border-b border-[#DDDDDD]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 py-3">
            <Link href="/dashboard/admin"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              <Settings className="w-3.5 h-3.5" />
              費率設定
            </Link>
            <div className="px-4 py-2 text-sm rounded-full flex items-center gap-2 bg-[#222222] text-white">
              <FileText className="w-3.5 h-3.5" />
              帳號審核
            </div>
            <Link href="/dashboard/admin/users"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              <Users className="w-3.5 h-3.5" />
              使用者管理
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold text-[#222222] mb-6">帳號審核管理</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('DRIVER')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'DRIVER' ? 'bg-[#0C447C] text-white' : 'bg-white border border-[#DDDDDD] text-[#717171]'}`}>
            司機待審核 ({pendingCounts.DRIVER})
          </button>
          <button onClick={() => setActiveTab('DISPATCHER')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'DISPATCHER' ? 'bg-[#FF385C] text-white' : 'bg-white border border-[#DDDDDD] text-[#717171]'}`}>
            派單方待審核 ({pendingCounts.DISPATCHER})
          </button>
        </div>

        {/* User list */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#717171]" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-[#DDDDDD]">
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
                    <div>車廠：<span className="font-bold">{u.driver.carBrand || '—'}</span></div>
                    <div>車型：<span className="font-bold">{u.driver.carModel || '—'}</span></div>
                    <div>車色：<span className="font-bold">{u.driver.carColor}</span></div>
                    <div>車型：<span className="font-bold">{u.driver.carType}</span></div>
                  </div>
                ) : u.dispatcher ? (
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3 bg-[#F7F7F7] rounded-lg p-3">
                    <div>公司：<span className="font-bold">{u.dispatcher.companyName}</span></div>
                    <div>統編：<span className="font-mono font-bold">{u.dispatcher.taxId || '—'}</span></div>
                    <div>電話：<span className="font-bold">{u.dispatcher.contactPhone || '—'}</span></div>
                  </div>
                ) : null}

                {/* Documents with expiry dates */}
                {u.documents && u.documents.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-[#717171] mb-2 font-medium">文件審核</p>
                    <div className="space-y-2">
                      {u.documents.map(doc => {
                        const label = DOC_TYPE_LABELS[doc.type] || doc.type
                        const expiryVal = docExpiryDates[doc.id] || ''
                        const expired = isExpired(expiryVal)
                        const noExpiryYet = expiryVal && !doc.expiryDate

                        return (
                          <div key={doc.id} className={`border rounded-lg p-3 ${expired ? 'border-[#FECACA] bg-[#FEF2F2]' : doc.uploadFailed ? 'border-[#FEF3C7] bg-[#FFFBEB]' : 'border-[#EEEEEE] bg-[#FAFAFA]'}`}>
                            <div className="flex items-start justify-between gap-3">
                              {/* 左側：文件名 */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-[#222222]">{label}</span>
                                  <span className="text-xs text-[#717171] font-mono">{doc.fileName}</span>
                                  {doc.uploadFailed && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#FEF3C7] text-[#B45309] rounded text-[10px] font-medium">
                                      <AlertTriangle className="w-3 h-3" />
                                      Drive上傳失敗
                                    </span>
                                  )}
                                </div>

                                {/* 到期日輸入 */}
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-[#B0B0B0]" />
                                    <span className="text-xs text-[#717171]">到期日：</span>
                                  </div>
                                  <input
                                    type="date"
                                    value={expiryVal}
                                    onChange={e => setDocExpiryDates(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                    className={`text-sm border rounded-lg px-2 py-1 focus:outline-none focus:border-[#222222] ${expired ? 'border-[#FECACA] bg-white text-[#B91C1C]' : 'border-[#DDDDDD] bg-white'}`}
                                  />
                                  <button
                                    onClick={() => handleSaveExpiry(doc.id)}
                                    disabled={docExpirySaving[doc.id]}
                                    className="flex items-center gap-1 px-2 py-1 bg-white border border-[#DDDDDD] rounded-lg text-xs text-[#717171] hover:border-[#222222] hover:text-[#222222] disabled:opacity-50 transition-colors">
                                    <Save className="w-3 h-3" />
                                    {docExpirySaving[doc.id] ? '儲存中...' : '儲存'}
                                  </button>
                                </div>

                                {/* 過期警示 */}
                                {expired && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C]" />
                                    <span className="text-xs font-medium text-[#B91C1C]">已過期</span>
                                  </div>
                                )}
                              </div>

                              {/* 右側：查看連結 */}
                              <div className="flex-shrink-0">
                                {doc.fileUrl ? (
                                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#DDDDDD] rounded-lg text-xs text-[#0C447C] hover:border-[#0C447C] font-medium transition-colors">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    查閱
                                  </a>
                                ) : doc.uploadFailed ? (
                                  <span className="text-xs text-[#B91C1C]">無檔案</span>
                                ) : (
                                  <span className="text-xs text-[#717171]">—</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
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
                      <button onClick={() => setRejectingUser(null)} className="px-4 py-2 border border-[#DDDDDD] text-sm text-[#717171] rounded-lg hover:bg-[#F7F7F7]">
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
                      {actionLoading === u.id ? '處理中...' : '通過審核'}
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
    </div>
  )
}
