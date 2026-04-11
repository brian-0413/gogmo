'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Settings, FileText, Users, Search, Loader2, X, Edit2, Trash2, RefreshCw, Ban, Play } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface UserRow {
  id: string
  name: string
  email: string
  phone: string
  role: 'DRIVER' | 'DISPATCHER' | 'ADMIN'
  accountStatus: 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'
  createdAt: string
  updatedAt: string
  rejectReason?: string | null
  driver: {
    id: string
    licensePlate: string
    carType: string
    carBrand: string | null
    carModel: string | null
    carColor: string
    balance: number
    status: string
  } | null
  dispatcher: {
    id: string
    companyName: string
    taxId: string | null
    contactPhone: string | null
  } | null
  _docCount: number
  _pendingDocCount: number
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: '正常', className: 'bg-[#DCFCE7] text-[#15803D]' },
  PENDING_REVIEW: { label: '待審核', className: 'bg-[#FEF3C7] text-[#B45309]' },
  REJECTED: { label: '已拒絕', className: 'bg-[#FEE2E2] text-[#B91C1C]' },
  PENDING_VERIFICATION: { label: '待驗證', className: 'bg-[#E0E7FF] text-[#3730A3]' },
}

const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  DRIVER: { label: '司機', className: 'bg-[#E6F1FB] text-[#0C447C]' },
  DISPATCHER: { label: '派單方', className: 'bg-[#FFF3E0] text-[#B45309]' },
  ADMIN: { label: '管理員', className: 'bg-[#F3F4F6] text-[#4B5563]' },
}

export default function AdminUsersPage() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // 編輯 modal state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', accountStatus: '', rejectReason: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // 重設密碼 modal state
  const [resetUser, setResetUser] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  // 刪除 modal state
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 動作中
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  const fetchUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (roleFilter) params.set('role', roleFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (search) params.set('search', search)
    params.set('page', String(page))

    const res = await fetch(`/api/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success) {
      setUsers(data.data.users)
      setTotal(data.data.total)
    }
    setLoading(false)
  }, [token, roleFilter, statusFilter, search, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchUsers()
  }

  // 開啟編輯 modal
  const openEdit = (u: UserRow) => {
    setEditingUser(u)
    setEditForm({
      name: u.name,
      phone: u.phone,
      accountStatus: u.accountStatus,
      rejectReason: u.rejectReason || '',
    })
    setEditError('')
  }

  // 儲存編輯
  const handleEdit = async () => {
    if (!editingUser || !token) return
    setEditLoading(true)
    setEditError('')
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        phone: editForm.phone,
        accountStatus: editForm.accountStatus,
        rejectReason: editForm.accountStatus === 'REJECTED' ? editForm.rejectReason : null,
      }
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setEditingUser(null)
        fetchUsers()
      } else {
        setEditError(data.error || '更新失敗')
      }
    } catch { setEditError('網路錯誤') }
    setEditLoading(false)
  }

  // 快速動作：停用/啟用
  const handleStatusChange = async (u: UserRow, newStatus: 'ACTIVE' | 'REJECTED') => {
    if (!token) return
    setActionLoading(u.id)
    try {
      const reason = newStatus === 'REJECTED' ? prompt('請輸入停用原因（選填）：') || '' : ''
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountStatus: newStatus, rejectReason: reason }),
      })
      const data = await res.json()
      if (data.success) {
        fetchUsers()
      } else {
        alert(data.error || '操作失敗')
      }
    } catch { alert('網路錯誤') }
    setActionLoading(null)
  }

  // 重設密碼
  const handleResetPassword = async () => {
    if (!resetUser || !token) return
    setResetLoading(true)
    setResetError('')
    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setResetUser(null)
        setNewPassword('')
        alert(`${resetUser.name} 的密碼已重設`)
      } else {
        setResetError(data.error || '重設失敗')
      }
    } catch { setResetError('網路錯誤') }
    setResetLoading(false)
  }

  // 刪除
  const handleDelete = async () => {
    if (!deleteUser || !token) return
    if (!confirm(`確定要刪除使用者「${deleteUser.name}」嗎？此操作無法復原。`)) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setDeleteUser(null)
        fetchUsers()
      } else {
        alert(data.error || '刪除失敗')
      }
    } catch { alert('網路錯誤') }
    setDeleteLoading(false)
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[#78716C] text-sm">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Header */}
      <header className="bg-[#FAF8F5] border-b border-[#DDDDDD] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 py-3">
            <Link href="/dashboard/admin"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              <Settings className="w-3.5 h-3.5" />
              費率設定
            </Link>
            <Link href="/dashboard/admin/reviews"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              <FileText className="w-3.5 h-3.5" />
              帳號審核
            </Link>
            <div className="px-4 py-2 text-sm rounded-full flex items-center gap-2 bg-[#222222] text-white">
              <Users className="w-3.5 h-3.5" />
              使用者管理
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#222222]">使用者管理</h1>
            <p className="text-sm text-[#717171] mt-0.5">共 {total} 位使用者</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 mb-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
            {/* 搜尋 */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-[#717171] mb-1 block">關鍵字搜尋</label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#B0B0B0] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="姓名、Email、車牌、公司名"
                  className="w-full bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]"
                />
              </div>
            </div>

            {/* 角色篩選 */}
            <div>
              <label className="text-xs text-[#717171] mb-1 block">身份</label>
              <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
                className="bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]">
                <option value="">全部</option>
                <option value="DRIVER">司機</option>
                <option value="DISPATCHER">派單方</option>
                <option value="ADMIN">管理員</option>
              </select>
            </div>

            {/* 狀態篩選 */}
            <div>
              <label className="text-xs text-[#717171] mb-1 block">狀態</label>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                className="bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]">
                <option value="">全部</option>
                <option value="ACTIVE">正常</option>
                <option value="PENDING_REVIEW">待審核</option>
                <option value="REJECTED">已拒絕</option>
              </select>
            </div>

            <Button type="submit" variant="outline" size="sm" className="text-[13px]">
              <Search className="w-3.5 h-3.5" />
              搜尋
            </Button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#717171]" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[#717171]">找不到符合條件的使用者</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EEEEEE] bg-[#FAFAFA]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#717171]">姓名 / 帳號</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#717171]">身份</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#717171]">狀態</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#717171]">詳情</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#717171]">文件</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#717171]">註冊時間</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#717171]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const status = STATUS_LABELS[u.accountStatus] || { label: u.accountStatus, className: 'bg-gray-100 text-gray-600' }
                    const role = ROLE_LABELS[u.role] || { label: u.role, className: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={u.id} className="border-b border-[#EEEEEE] hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#222222]">{u.name}</div>
                          <div className="text-xs text-[#717171]">{u.email}</div>
                          <div className="text-xs text-[#717171]">{u.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${role.className}`}>
                            {role.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                          {u.rejectReason && (
                            <div className="text-xs text-[#B91C1C] mt-0.5 max-w-[150px] truncate" title={u.rejectReason}>
                              {u.rejectReason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {u.role === 'DRIVER' && u.driver && (
                            <div>
                              <div className="font-mono font-medium">{u.driver.licensePlate}</div>
                              <div className="text-[#717171]">{u.driver.carBrand} {u.driver.carModel} {u.driver.carColor}</div>
                              <div className="text-[#717171]">餘額：{u.driver.balance} 點</div>
                            </div>
                          )}
                          {u.role === 'DISPATCHER' && u.dispatcher && (
                            <div>
                              <div>{u.dispatcher.companyName}</div>
                              {u.dispatcher.taxId && <div className="text-[#717171] font-mono">統編：{u.dispatcher.taxId}</div>}
                            </div>
                          )}
                          {u.role === 'ADMIN' && <span className="text-[#717171]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={u._pendingDocCount > 0 ? 'text-[#B45309]' : 'text-[#15803D]'}>
                            {u._docCount} 份
                          </span>
                          {u._pendingDocCount > 0 && (
                            <span className="ml-1 text-[#B45309]">({u._pendingDocCount} 待審)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#717171]">
                          {new Date(u.createdAt).toLocaleDateString('zh-TW')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#717171] hover:text-[#222222] transition-colors"
                              title="編輯">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {u.accountStatus === 'ACTIVE' && u.role !== 'ADMIN' && (
                              <button
                                onClick={() => handleStatusChange(u, 'REJECTED')}
                                disabled={actionLoading === u.id}
                                className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#717171] hover:text-[#B91C1C] transition-colors"
                                title="停用帳號">
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {u.accountStatus === 'REJECTED' && u.role !== 'ADMIN' && (
                              <button
                                onClick={() => handleStatusChange(u, 'ACTIVE')}
                                disabled={actionLoading === u.id}
                                className="p-1.5 rounded-lg hover:bg-[#DCFCE7] text-[#717171] hover:text-[#15803D] transition-colors"
                                title="啟用帳號">
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {u.role !== 'ADMIN' && (
                              <>
                                <button onClick={() => setResetUser(u)}
                                  className="p-1.5 rounded-lg hover:bg-[#FEF3C7] text-[#717171] hover:text-[#B45309] transition-colors"
                                  title="重設密碼">
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteUser(u)}
                                  className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#717171] hover:text-[#B91C1C] transition-colors"
                                  title="刪除">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              上一頁
            </Button>
            <span className="text-sm text-[#717171]">
              第 {page} 頁，共 {Math.ceil(total / pageSize)} 頁
            </span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)}>
              下一頁
            </Button>
          </div>
        )}
      </main>

      {/* 編輯 Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">編輯使用者</h2>
              <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
                <X className="w-5 h-5 text-[#717171]" />
              </button>
            </div>

            {editError && (
              <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm mb-4">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#717171] mb-1 block">姓名</label>
                <input type="text" value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]" />
              </div>
              <div>
                <label className="text-xs text-[#717171] mb-1 block">電話</label>
                <input type="text" value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]" />
              </div>
              <div>
                <label className="text-xs text-[#717171] mb-1 block">帳號狀態</label>
                <select value={editForm.accountStatus}
                  onChange={e => setEditForm(f => ({ ...f, accountStatus: e.target.value }))}
                  className="w-full bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]">
                  <option value="ACTIVE">正常</option>
                  <option value="PENDING_REVIEW">待審核</option>
                  <option value="REJECTED">已拒絕</option>
                </select>
              </div>
              {editForm.accountStatus === 'REJECTED' && (
                <div>
                  <label className="text-xs text-[#717171] mb-1 block">拒絕原因</label>
                  <input type="text" value={editForm.rejectReason}
                    onChange={e => setEditForm(f => ({ ...f, rejectReason: e.target.value }))}
                    placeholder="選填"
                    className="w-full bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]" />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleEdit} disabled={editLoading} className="flex-1">
                {editLoading ? '儲存中...' : '儲存'}
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* 重設密碼 Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">重設密碼</h2>
              <button onClick={() => { setResetUser(null); setNewPassword('') }}
                className="p-1 hover:bg-[#F3F4F6] rounded-lg">
                <X className="w-5 h-5 text-[#717171]" />
              </button>
            </div>
            <p className="text-sm text-[#717171] mb-4">
              為「{resetUser.name}」({resetUser.email}) 重設密碼
            </p>

            {resetError && (
              <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm mb-4">
                {resetError}
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs text-[#717171] mb-1 block">新密碼（至少 6 個字元）</label>
              <input type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="輸入新密碼"
                className="w-full bg-[#FAF8F5] border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#222222]" />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleResetPassword} disabled={resetLoading || newPassword.length < 6}
                className="flex-1">
                {resetLoading ? '重設中...' : '確認重設'}
              </Button>
              <Button variant="outline" onClick={() => { setResetUser(null); setNewPassword('') }}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">確認刪除</h2>
              <button onClick={() => setDeleteUser(null)} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
                <X className="w-5 h-5 text-[#717171]" />
              </button>
            </div>
            <p className="text-sm text-[#717171] mb-2">
              確定要刪除以下使用者嗎？
            </p>
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3 mb-4">
              <div className="font-medium text-[#B91C1C]">{deleteUser.name}</div>
              <div className="text-sm text-[#DC2626]">{deleteUser.email}</div>
            </div>
            <p className="text-xs text-[#EF4444] mb-4">此操作無法復原，所有相關資料將一併刪除。</p>
            <div className="flex gap-2">
              <Button onClick={handleDelete} disabled={deleteLoading}
                className="flex-1 bg-[#B91C1C] hover:bg-[#991B1B]">
                {deleteLoading ? '刪除中...' : '確認刪除'}
              </Button>
              <Button variant="outline" onClick={() => setDeleteUser(null)}>取消</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
