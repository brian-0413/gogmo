'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Plus, UserPlus, LogOut, Crown, Car, Phone, AlertTriangle, Loader2, ArrowRightLeft, Bell, Clock, CheckCircle, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { Squad, SquadMember } from '@/types'

interface SquadTabProps {
  token: string | null
  driverId: string
}

// 車型顯示名稱對照
const CAR_TYPE_LABELS: Record<string, string> = {
  small: '小車',
  suv: '休旅',
  van9: '9人座',
  any: '任意',
  any_r: '任意R',
  pending: '待確認',
}

// 訂單種類標籤
const TYPE_LABELS: Record<string, string> = {
  pickup: '接機', dropoff: '送機', pickup_boat: '接船',
  dropoff_boat: '送船', transfer: '接駁', charter: '包車', pending: '待確認',
}

// Pool transfer item type
interface PoolTransfer {
  id: string
  orderId: string
  fromDriverId: string
  status: string
  reason: string | null
  bonusPoints: number
  transferFee: number
  createdAt: Date | string
  order?: {
    id: string
    scheduledTime: Date | string
    price: number
    pickupLocation: string
    dropoffLocation: string
    type: string
    vehicle: string
    passengerCount: number
    passengerName: string
    passengerPhone: string
    flightNumber: string
  }
  fromDriver?: {
    user?: { name: string; phone: string }
  }
}

// Pending invite type
interface PendingInvite {
  id: string
  squadId: string
  squad?: { name: string }
  founder?: { user?: { name: string } }
}

// SSE invite event from /api/squads/events
interface SquadInviteEventData {
  type: 'SQUAD_INVITE' | 'SQUAD_INVITE_ACCEPTED' | 'SQUAD_INVITE_REJECTED'
  invite: {
    inviteId: string
    squadId: string
    squadName: string
    driverId: string
    founderName?: string
  }
}

function MemberCard({ member, isFounder }: {
  member: SquadMember
  isFounder: boolean
}) {
  const carTypeLabel = CAR_TYPE_LABELS[member.driver?.carType || 'pending'] || member.driver?.carType || '待確認'
  const driverName = member.driver?.user?.name || '未知'
  const licensePlate = member.driver?.licensePlate || '未設定'
  const phone = member.driver?.user?.phone || ''

  return (
    <div className="flex items-center justify-between p-4 bg-white border border-[#DDDDDD] rounded-xl hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#F5F4F0] border border-[#DDDDDD] flex items-center justify-center">
          <Car className="w-5 h-5 text-[#717171]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-bold text-[#222222]">{driverName}</p>
            {isFounder && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#B45309] text-[11px] font-bold border border-[#F59E0B]/20">
                <Crown className="w-3 h-3" />
                建立者
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#717171] font-mono-nums">
            {licensePlate}
            <span className="mx-1.5 text-[#DDDDDD]">|</span>
            {carTypeLabel}
          </p>
          {phone && (
            <p className="text-[11px] text-[#A8A29E] flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" />
              {phone}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PoolCard({ transfer, token, onClaimed, onError }: {
  transfer: PoolTransfer
  token: string | null
  onClaimed: () => void
  onError: (msg: string) => void
}) {
  const [loading, setLoading] = useState(false)

  const scheduledDate = typeof transfer.order?.scheduledTime === 'string'
    ? parseISO(transfer.order.scheduledTime)
    : transfer.order?.scheduledTime as Date
  const typeLabel = TYPE_LABELS[transfer.order?.type || 'pending'] || '待確認'
  const fromName = transfer.fromDriver?.user?.name || '未知司機'
  const timeStr = scheduledDate
    ? format(scheduledDate, 'M/dd (E) HH:mm', { locale: zhTW })
    : '—'

  const handleClaim = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/squads/pool/${transfer.id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        onClaimed()
      } else {
        onError(data.error || '搶單失敗')
      }
    } catch {
      onError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded text-[12px] font-bold font-mono-nums bg-[#FFF3E0] text-[#B45309]">
            {typeLabel}
          </span>
          {transfer.bonusPoints > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F3E8FF] text-[#6B21A8] text-[12px] font-bold">
              +{transfer.bonusPoints.toLocaleString()} bonus
            </span>
          )}
        </div>
        <span className="text-[11px] text-[#A8A29E]">來自 {fromName}</span>
      </div>

      {/* Time */}
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="w-3.5 h-3.5 text-[#717171]" />
        <span className="text-[14px] font-bold font-mono-nums text-[#222222]">{timeStr}</span>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 text-[13px] text-[#717171] mb-2">
        <span className="font-medium text-[#222222] truncate">{transfer.order?.pickupLocation || '—'}</span>
        <span className="text-[#DDDDDD] flex-shrink-0">→</span>
        <span className="font-medium text-[#222222] truncate">{transfer.order?.dropoffLocation || '—'}</span>
      </div>

      {/* Price + reason */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[18px] font-bold font-mono-nums text-[#FF385C]">
          NT${transfer.order?.price?.toLocaleString() || '—'}
        </span>
        {transfer.reason && (
          <span className="text-[11px] text-[#717171] italic truncate max-w-[160px]">{transfer.reason}</span>
        )}
      </div>

      {/* Claim button */}
      <button
        onClick={handleClaim}
        disabled={loading}
        className="w-full py-2.5 bg-[#0C447C] text-white text-[14px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? '處理中...' : '我要支援'}
      </button>
    </div>
  )
}

function InviteCard({ invite, token, onResponded }: {
  invite: PendingInvite
  token: string | null
  onResponded: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const squadName = invite.squad?.name || '未知小隊'
  const founderName = invite.founder?.user?.name || '未知'

  const handleRespond = async (action: 'accept' | 'reject') => {
    if (!token) return
    setLoading(action)
    try {
      const res = await fetch('/api/squads/respond', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteId: invite.id, action }),
      })
      const data = await res.json()
      if (data.success) {
        onResponded()
      } else {
        alert(data.error || `${action === 'accept' ? '接受' : '拒絕'}失敗`)
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-[#FFF8E6] border border-[#D4A017] rounded-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-[#F59E0B]" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-[#222222]">{squadName}</p>
          <p className="text-[12px] text-[#717171]">
            小隊長：{founderName}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleRespond('accept')}
          disabled={loading !== null}
          className="px-4 py-2 bg-[#008A05] text-white text-[13px] font-bold rounded-lg hover:bg-[#007004] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {loading === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          接受
        </button>
        <button
          onClick={() => handleRespond('reject')}
          disabled={loading !== null}
          className="px-4 py-2 bg-white border border-[#DDDDDD] text-[#717171] text-[13px] font-bold rounded-lg hover:bg-[#F4EFE9] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {loading === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          拒絕
        </button>
      </div>
    </div>
  )
}

export function SquadTab({ token, driverId }: SquadTabProps) {
  const [squad, setSquad] = useState<Squad | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [invitePlate, setInvitePlate] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createName, setCreateName] = useState('')

  // 支援池狀態
  const [poolTransfers, setPoolTransfers] = useState<PoolTransfer[]>([])
  const [poolLoading, setPoolLoading] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [inviteNotification, setInviteNotification] = useState<string | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  const fetchInvites = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/squads/invites', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        const invites: PendingInvite[] = (data.data.invites || []).map((inv: any) => ({
          id: inv.id,
          squadId: inv.squadId,
          squad: inv.squad ? { name: inv.squad.name } : undefined,
          founder: inv.squad?.founder,
        }))
        setPendingInvites(invites)
      }
    } catch (error) {
      console.error('Failed to fetch invites:', error)
    }
  }, [token])

  const fetchSquad = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/squads', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setSquad(data.data.squad)
      }
    } catch (error) {
      console.error('Failed to fetch squad:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchPool = useCallback(async () => {
    if (!token || !squad) return
    setPoolLoading(true)
    try {
      const res = await fetch('/api/squads/pool', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setPoolTransfers(data.data.transfers || [])
      }
    } catch (error) {
      console.error('Failed to fetch pool:', error)
    } finally {
      setPoolLoading(false)
    }
  }, [token, squad])

  // SSE listener for squad events
  useEffect(() => {
    if (!token) return

    // 只在小隊存在時建立 SSE 連線
    if (!squad) return

    const es = new EventSource('/api/squads/events')
    sseRef.current = es

    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data)
        // Skip heartbeat
        if (raw.type === 'HEARTBEAT') return

        if (raw.type === 'SQUAD_POOL_NEW' || raw.type === 'TRANSFER_CREATED') {
          fetchPool()
        } else if (raw.type === 'TRANSFER_APPROVED' || raw.type === 'TRANSFER_EXPIRED' || raw.type === 'TRANSFER_WITHDRAWN' || raw.type === 'TRANSFER_CANCELLED' || raw.type === 'TRANSFER_REJECTED') {
          fetchPool()
          if (raw.type === 'TRANSFER_APPROVED') {
            alert('有隊友成功接手轉單！')
          }
        } else if (raw.type === 'SQUAD_INVITE') {
          const inviteData = raw.invite as SquadInviteEventData['invite']
          setInviteNotification(`${inviteData.squadName} 小隊邀請你加入！`)
          setTimeout(() => setInviteNotification(null), 5000)
          fetchInvites()
          fetchSquad()
        } else if (raw.type === 'SQUAD_INVITE_ACCEPTED') {
          fetchSquad()
          fetchPool()
        } else if (raw.type === 'SQUAD_INVITE_REJECTED') {
          alert(`邀請被拒絕`)
          fetchSquad()
        }
      } catch {}
    }

    es.onerror = () => es.close()

    return () => {
      es.close()
      sseRef.current = null
    }
  }, [token, squad, fetchPool, fetchSquad])

  useEffect(() => {
    fetchSquad()
    fetchInvites()
  }, [fetchSquad, fetchInvites])

  // Fetch pool when squad is loaded
  useEffect(() => {
    if (squad) {
      fetchPool()
    }
  }, [squad, fetchPool])

  const handleCreateSquad = async () => {
    if (!token || !createName.trim()) return
    setActionLoading('create')
    setInviteError('')
    try {
      const res = await fetch('/api/squads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: createName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setSquad(data.data.squad)
        setShowCreateForm(false)
        setCreateName('')
      } else {
        setInviteError(data.error || '建立失敗')
      }
    } catch {
      setInviteError('網路錯誤，請稍後再試')
    } finally {
      setActionLoading(null)
    }
  }

  const handleInvite = async () => {
    if (!token || !invitePlate.trim()) return
    setActionLoading('invite')
    setInviteError('')
    setInviteSuccess('')
    try {
      const res = await fetch('/api/squads/invite', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licensePlate: invitePlate.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setInviteSuccess(`已向車牌 ${invitePlate.trim().toUpperCase()} 發送邀請，等待對方回覆`)
        setInvitePlate('')
        await fetchSquad()
      } else {
        setInviteError(data.error || '邀請失敗')
      }
    } catch {
      setInviteError('網路錯誤，請稍後再試')
    } finally {
      setActionLoading(null)
    }
  }

  const handleLeave = async () => {
    if (!token) return
    const confirmed = window.confirm('確定要退出小隊嗎？退出後將重新成為自由司機。')
    if (!confirmed) return

    setActionLoading('leave')
    try {
      const res = await fetch('/api/squads/leave', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setSquad(null)
        alert(data.data.message || '已退出小隊')
      } else {
        alert(data.error || '退出失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisband = async () => {
    if (!token) return
    const confirmed = window.confirm('確定要解散小隊嗎？所有成員都會被退出，且此操作無法復原。')
    if (!confirmed) return

    setActionLoading('disband')
    try {
      const res = await fetch('/api/squads', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setSquad(null)
        alert('小隊已解散')
      } else {
        alert(data.error || '解散失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setActionLoading(null)
    }
  }

  // ===== 載入中 =====
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
      </div>
    )
  }

  // ===== 無小隊：顯示建立引導頁 =====
  if (!squad) {
    return (
      <div>
        {/* 建立小隊引導頁 */}
        <div className="bg-white border border-[#DDDDDD] rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden shadow-sm">
          <div className="absolute inset-0 dot-matrix opacity-30" />
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF3E0] border border-[#F59E0B]/20 flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-[#F59E0B]" />
            </div>
            <h2 className="text-[22px] font-bold text-[#222222] mb-2">加入或建立小隊</h2>
            <p className="text-[#717171] text-sm mb-8 max-w-md mx-auto">
              和信賴的司機夥伴組成小隊，可以互相支援轉單、查看彼此行程。
              小隊上限 10 人，建立者為預設小隊長。
            </p>

            {showCreateForm ? (
              <div className="max-w-sm mx-auto text-left bg-[#FAF7F2] border border-[#DDDDDD] rounded-xl p-5">
                <p className="text-[14px] font-bold text-[#222222] mb-3">建立新小隊</p>
                <div className="mb-3">
                  <label className="block text-[12px] text-[#717171] mb-1.5">小隊名稱</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="例如：桃機A組、松機兄弟隊"
                    className="w-full px-3 py-2.5 border border-[#DDDDDD] rounded-lg text-[14px] text-[#222222] bg-white placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30"
                    maxLength={30}
                  />
                </div>
                {inviteError && (
                  <p className="text-[13px] text-[#E24B4A] mb-3 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {inviteError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateSquad}
                    disabled={actionLoading === 'create' || !createName.trim()}
                    className="flex-1 py-2.5 px-4 bg-[#FF385C] text-white text-[14px] font-bold rounded-lg hover:bg-[#E83355] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading === 'create' ? '建立中...' : '建立小隊'}
                  </button>
                  <button
                    onClick={() => { setShowCreateForm(false); setCreateName(''); setInviteError('') }}
                    className="py-2.5 px-4 border border-[#DDDDDD] text-[#717171] text-[14px] font-medium rounded-lg hover:bg-[#F5F4F0] transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-[#FF385C] text-white text-[15px] font-bold rounded-xl hover:bg-[#E83355] transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  建立小隊
                </button>
                <p className="text-[13px] text-[#A8A29E] flex items-center justify-center">
                  或請小隊長用 Email 邀請你加入
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 說明卡片 */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: '邀請夥伴', desc: '輸入司機 Email 直接加入，最多 10 人' },
            { title: '互相支援', desc: '行程衝突時可請求小隊成員接手' },
            { title: '共同行控', desc: '成員可看到彼此的待執行行程' },
          ].map(item => (
            <div key={item.title} className="bg-white border border-[#DDDDDD] rounded-xl p-4">
              <p className="text-[14px] font-bold text-[#222222] mb-1">{item.title}</p>
              <p className="text-[12px] text-[#717171]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ===== 有小隊 =====
  const memberCount = squad.members?.length || 0
  const maxMembers = squad.maxMembers || 10
  const isFounder = squad.founderId === driverId
  const isFull = memberCount >= maxMembers

  return (
    <div className="space-y-4">
      {/* 小隊標題卡片 */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-[#F59E0B]" />
              <h2 className="text-[18px] font-bold text-[#222222]">{squad.name}</h2>
            </div>
            <p className="text-[13px] text-[#717171]">
              <span className="font-mono-nums font-bold text-[#F59E0B]">{memberCount}</span>
              <span className="text-[#A8A29E]"> / {maxMembers}</span>
              人成員
              {isFounder && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#B45309] text-[11px] font-bold border border-[#F59E0B]/20">
                  <Crown className="w-3 h-3" />
                  小隊長
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#A8A29E]">建立日期</p>
            <p className="text-[13px] text-[#717171] font-mono-nums">
              {squad.createdAt
                ? new Date(squad.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
                : '-'}
            </p>
          </div>
        </div>

        {/* 邀請成員區塊 */}
        {!isFull && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-4 h-4 text-[#717171]" />
              <p className="text-[13px] font-bold text-[#222222]">邀請成員</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={invitePlate}
                onChange={e => { setInvitePlate(e.target.value); setInviteError(''); setInviteSuccess('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleInvite() }}
                placeholder="輸入車牌號碼"
                className="flex-1 px-3 py-2 border border-[#DDDDDD] rounded-lg text-[13px] text-[#222222] bg-white placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30"
              />
              <button
                onClick={handleInvite}
                disabled={actionLoading === 'invite' || !invitePlate.trim()}
                className="px-4 py-2 bg-[#FF385C] text-white text-[13px] font-bold rounded-lg hover:bg-[#E83355] transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {actionLoading === 'invite' ? '發送中...' : '發送邀請'}
              </button>
            </div>
            {inviteError && (
              <p className="text-[12px] text-[#E24B4A] mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {inviteError}
              </p>
            )}
            {inviteSuccess && (
              <p className="text-[12px] text-[#008A05] mt-1.5 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#008A05] inline-block" />
                {inviteSuccess}
              </p>
            )}
          </div>
        )}

        {isFull && (
          <div className="mb-4 px-3 py-2.5 bg-[#FFF3E0] border border-[#F59E0B]/20 rounded-lg">
            <p className="text-[13px] text-[#B45309] font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              小隊已滿（{memberCount}/{maxMembers} 人），無法再邀請新成員
            </p>
          </div>
        )}

        {/* 邀請通知橫幅 */}
        {inviteNotification && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-[#FFF3E0] border border-[#F59E0B]/30 rounded-xl">
            <Bell className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-[13px] font-medium text-[#B45309]">{inviteNotification}</span>
            <button
              onClick={() => setInviteNotification(null)}
              className="ml-auto text-[#717171] hover:text-[#222222] transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 待回覆邀請 */}
        {pendingInvites.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[#F59E0B]" />
              <p className="text-[14px] font-bold text-[#222222]">待回覆邀請</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#B45309] text-[11px] font-bold">
                {pendingInvites.length}
              </span>
            </div>
            <div className="space-y-2">
              {pendingInvites.map(invite => (
                <InviteCard
                  key={invite.id}
                  invite={invite}
                  token={token}
                  onResponded={() => {
                    fetchInvites()
                    fetchSquad()
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 支援池 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#0C447C]" />
              <p className="text-[14px] font-bold text-[#222222]">支援池</p>
              {poolTransfers.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#0C447C]/10 text-[#0C447C] text-[11px] font-bold">
                  {poolTransfers.length}
                </span>
              )}
            </div>
            <button
              onClick={fetchPool}
              disabled={poolLoading}
              className="text-[11px] text-[#717171] hover:text-[#222222] transition-colors disabled:opacity-60"
            >
              {poolLoading ? '載入中...' : '重新整理'}
            </button>
          </div>

          {poolLoading && poolTransfers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#F59E0B] animate-spin" />
            </div>
          ) : poolTransfers.length === 0 ? (
            <div className="text-center py-8 bg-[#F4EFE9] border border-[#DDDDDD] rounded-xl">
              <ArrowRightLeft className="w-8 h-8 text-[#DDDDDD] mx-auto mb-2" />
              <p className="text-[13px] text-[#A8A29E]">目前沒有待支援的轉單</p>
              <p className="text-[11px] text-[#A8A29E]">隊友請求支援時會出現在這裡</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {poolTransfers.map(transfer => (
                <PoolCard
                  key={transfer.id}
                  transfer={transfer}
                  token={token}
                  onClaimed={() => {
                    fetchPool()
                    alert('搶單成功！請查看行程')
                  }}
                  onError={(msg) => alert(msg)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleLeave}
            disabled={actionLoading === 'leave'}
            className="px-4 py-2 bg-white border border-[#E24B4A] text-[#E24B4A] text-[13px] font-bold rounded-lg hover:bg-[#FCEBEB] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {actionLoading === 'leave' ? '退出中...' : '退出小隊'}
          </button>
          {isFounder && (
            <button
              onClick={handleDisband}
              disabled={actionLoading === 'disband'}
              className="px-4 py-2 bg-white border border-[#E24B4A] text-[#E24B4A] text-[13px] font-bold rounded-lg hover:bg-[#FCEBEB] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {actionLoading === 'disband' ? '解散中...' : '解散小隊'}
            </button>
          )}
        </div>
      </div>

      {/* 成員列表 */}
      <div>
        <p className="text-[11px] text-[#78716C] uppercase tracking-wider font-medium mb-2 px-1">
          成員列表
        </p>
        <div className="space-y-2">
          {squad.members?.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              isFounder={member.driverId === squad.founderId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
