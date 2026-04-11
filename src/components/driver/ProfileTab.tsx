'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Edit2, Check, X, Eye, Upload, FileText, CreditCard, Wallet } from 'lucide-react'

interface ProfileTabProps {
  token: string
}

interface ProfileData {
  user: {
    id: string
    name: string
    email: string
    phone: string
  }
  driver: {
    id: string
    licensePlate: string
    carBrand: string | null
    carModel: string | null
    carType: string
    carColor: string
    isPremium: boolean
    bankCode: string | null
    bankAccount: string | null
  } | null
  documents: Array<{
    id: string
    type: string
    fileName: string
    fileUrl: string | null
    expiryDate: string | null
    status: string
  }>
  balance: number
}

interface Transaction {
  id: string
  amount: number
  type: string
  status: string
  description?: string
  createdAt: string
}

const CAR_TYPE_LABELS: Record<string, string> = {
  small: '小車(5人座)',
  suv: '休旅(7人座)',
  van9: '9人座',
  any: '任意',
  any_r: '任意R牌',
  pending: '待確認',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  VEHICLE_REGISTRATION: '行照',
  DRIVER_LICENSE: '駕照',
  INSURANCE: '保險證',
}

const DOC_TYPES = ['VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'INSURANCE']

const BANK_OPTIONS = [
  { code: '700', label: '700 - 郵局' },
  { code: '052', label: '052 - 渣打銀行' },
]

type DocStatus = 'normal' | 'expiring' | 'expired' | 'none'

function getDocStatus(expiryDate: string | null | undefined): DocStatus {
  if (!expiryDate) return 'none'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const plus30 = new Date(today)
  plus30.setDate(plus30.getDate() + 30)

  if (expiry < today) return 'expired'
  if (expiry <= plus30) return 'expiring'
  return 'normal'
}

export function ProfileTab({ token }: ProfileTabProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  // Section 2: edit mode
  const [editMode, setEditMode] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const [editBankCode, setEditBankCode] = useState('700')
  const [editBankAccount, setEditBankAccount] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Section 3: document upload
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [uploadPreview, setUploadPreview] = useState<Record<string, { file: File; previewUrl: string }>>({})
  const [uploadSuccess, setUploadSuccess] = useState<Record<string, boolean>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Section 4: topup
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [showTransferInfo, setShowTransferInfo] = useState(false)
  const [recentTopups, setRecentTopups] = useState<Transaction[]>([])

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/drivers/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        const p = data.data as ProfileData
        setProfile(p)
        setEditPhone(p.user.phone || '')
        setEditBankCode(p.driver?.bankCode || '700')
        setEditBankAccount(p.driver?.bankAccount || '')
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/drivers/balance', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        const txs = (data.data.transactions as Transaction[])
          .filter(t => t.type === 'RECHARGE')
          .slice(0, 5)
        setRecentTopups(txs)
      }
    } catch {
      // silently ignore
    }
  }, [token])

  useEffect(() => {
    fetchProfile()
    fetchBalance()
  }, [fetchProfile, fetchBalance])

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/drivers/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: editPhone, bankCode: editBankCode, bankAccount: editBankAccount }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveSuccess(true)
        setEditMode(false)
        fetchProfile()
        setTimeout(() => setSaveSuccess(false), 2000)
      } else {
        setSaveError(data.error || '儲存失敗')
      }
    } catch {
      setSaveError('網路錯誤')
    }
    setSaving(false)
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setSaveError('')
    if (profile) {
      setEditPhone(profile.user.phone || '')
      setEditBankCode(profile.driver?.bankCode || '700')
      setEditBankAccount(profile.driver?.bankAccount || '')
    }
  }

  const handleFileSelect = (docType: string, file: File) => {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    setUploadPreview(prev => ({ ...prev, [docType]: { file, previewUrl } }))
  }

  const handleUpload = async (docType: string) => {
    const preview = uploadPreview[docType]
    if (!preview || !profile) return
    setUploadingDoc(docType)
    try {
      const fd = new FormData()
      fd.append('file', preview.file)
      fd.append('type', docType)
      fd.append('userId', profile.user.id)
      const res = await fetch('/api/drivers/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (data.success) {
        setUploadSuccess(prev => ({ ...prev, [docType]: true }))
        setUploadPreview(prev => {
          const next = { ...prev }
          delete next[docType]
          return next
        })
      } else {
        alert(data.error || '上傳失敗')
      }
    } catch {
      alert('網路錯誤')
    }
    setUploadingDoc(null)
  }

  const getTopupAmount = (): number | null => {
    if (selectedPreset !== null) return selectedPreset
    const parsed = parseInt(customAmount)
    if (!isNaN(parsed) && parsed >= 100) return parsed
    return null
  }

  const handleTopupCredit = async () => {
    const amount = getTopupAmount()
    if (!amount || amount < 100) { alert('加值金額最低 100 元'); return }
    setTopupLoading(true)
    try {
      const res = await fetch('/api/drivers/topup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, method: 'credit' }),
      })
      const data = await res.json()
      if (data.success) {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = data.data.payuniUrl
        Object.entries(data.data.formData as Record<string, string>).forEach(([k, v]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = k
          input.value = v
          form.appendChild(input)
        })
        document.body.appendChild(form)
        form.submit()
      } else {
        alert(data.error || '建立加值訂單失敗')
      }
    } catch {
      alert('網路錯誤')
    }
    setTopupLoading(false)
  }

  const handleTopupTransfer = async () => {
    const amount = getTopupAmount()
    if (!amount || amount < 100) { alert('加值金額最低 100 元'); return }
    setTopupLoading(true)
    try {
      const res = await fetch('/api/drivers/topup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, method: 'transfer' }),
      })
      const data = await res.json()
      if (data.success) {
        setShowTransferInfo(true)
      } else {
        alert(data.error || '建立加值訂單失敗')
      }
    } catch {
      alert('網路錯誤')
    }
    setTopupLoading(false)
  }

  const getDocForType = (docType: string) =>
    profile?.documents.find(d => d.type === docType) ?? null

  const getBannerStatus = (): 'expired' | 'expiring' | null => {
    if (!profile) return null
    let hasExpired = false
    let hasExpiring = false
    for (const dt of DOC_TYPES) {
      const doc = getDocForType(dt)
      const st = getDocStatus(doc?.expiryDate)
      if (st === 'expired') hasExpired = true
      if (st === 'expiring') hasExpiring = true
    }
    if (hasExpired) return 'expired'
    if (hasExpiring) return 'expiring'
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return <div className="text-center py-20 text-[#717171]">無法載入個人資料</div>
  }

  const bStatus = getBannerStatus()
  const finalTopupAmount = getTopupAmount()

  const carInfo = [
    profile.driver?.carBrand,
    profile.driver?.carModel,
    profile.driver?.carType ? CAR_TYPE_LABELS[profile.driver.carType] : '',
    profile.driver?.carColor,
  ].filter(Boolean).join(' ')

  return (
    <div className="space-y-5">
      {/* 頂部 Banner */}
      {bStatus === 'expired' && (
        <div className="bg-[#FCEBEB] border border-[#F5C6C6] rounded-xl px-5 py-3 text-[#A32D2D] text-sm font-medium">
          帳號已凍結，請重新上傳文件
        </div>
      )}
      {bStatus === 'expiring' && (
        <div className="bg-[#FFF3E0] border border-[#FFE0B2] rounded-xl px-5 py-3 text-[#B45309] text-sm font-medium">
          有文件即將到期，請重新上傳
        </div>
      )}

      {/* 區塊 1：個人資料（唯讀） */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1C1917] mb-4">個人資料</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#717171] mb-1">姓名</p>
            <p className="text-sm font-bold text-[#222222]">{profile.user.name}</p>
          </div>
          <div>
            <p className="text-xs text-[#717171] mb-1">Email</p>
            <p className="text-sm font-bold text-[#222222]">{profile.user.email}</p>
          </div>
          <div>
            <p className="text-xs text-[#717171] mb-1">會員等級</p>
            <Badge variant={profile.driver?.isPremium ? 'purple' : 'default'}>
              {profile.driver?.isPremium ? 'Premium' : '普通'}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-[#717171] mb-1">車輛資訊</p>
            {profile.driver?.licensePlate && (
              <p className="text-sm font-bold text-[#222222] font-mono">{profile.driver.licensePlate}</p>
            )}
            {carInfo && (
              <p className="text-xs text-[#717171] mt-0.5">{carInfo}</p>
            )}
          </div>
        </div>
      </div>

      {/* 區塊 2：聯絡方式與銀行資料（可編輯） */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1C1917]">聯絡方式與銀行資料</h3>
          {!editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              編輯
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                <X className="w-3.5 h-3.5 mr-1" />
                取消
              </Button>
              <Button size="sm" loading={saving} onClick={handleSaveProfile}>
                <Check className="w-3.5 h-3.5 mr-1" />
                儲存
              </Button>
            </div>
          )}
        </div>

        {saveSuccess && (
          <div className="mb-3 bg-[#E8F5E8] border border-[#C8E6C8] rounded-lg px-4 py-2 text-[#008A05] text-sm">
            儲存成功
          </div>
        )}
        {saveError && (
          <div className="mb-3 bg-[#FCEBEB] border border-[#F5C6C6] rounded-lg px-4 py-2 text-[#A32D2D] text-sm">
            {saveError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#717171] mb-1.5">聯絡電話</p>
            {editMode ? (
              <input
                type="text"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#222222]"
                placeholder="請輸入電話"
              />
            ) : (
              <p className="text-sm font-bold text-[#222222]">{profile.user.phone || '—'}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-[#717171] mb-1.5">銀行代碼</p>
            {editMode ? (
              <select
                value={editBankCode}
                onChange={e => setEditBankCode(e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#222222] bg-white"
              >
                {BANK_OPTIONS.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-bold text-[#222222]">
                {profile.driver?.bankCode
                  ? (BANK_OPTIONS.find(b => b.code === profile.driver?.bankCode)?.label ?? profile.driver.bankCode)
                  : '—'}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-[#717171] mb-1.5">銀行帳號</p>
            {editMode ? (
              <input
                type="text"
                value={editBankAccount}
                onChange={e => setEditBankAccount(e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#222222] font-mono"
                placeholder="請輸入帳號"
              />
            ) : (
              <p className="text-sm font-bold text-[#222222] font-mono">{profile.driver?.bankAccount || '—'}</p>
            )}
          </div>
        </div>
      </div>

      {/* 區塊 3：文件管理 */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1C1917] mb-4">文件管理</h3>
        <div className="space-y-3">
          {DOC_TYPES.map(docType => {
            const doc = getDocForType(docType)
            const label = DOC_TYPE_LABELS[docType]
            const status = getDocStatus(doc?.expiryDate)
            const preview = uploadPreview[docType]
            const isUploading = uploadingDoc === docType
            const wasUploaded = uploadSuccess[docType]

            const statusBadge: Record<DocStatus, React.ReactNode> = {
              normal: <Badge variant="success">正常</Badge>,
              expiring: <Badge variant="warning">即將到期</Badge>,
              expired: <Badge variant="danger">已過期</Badge>,
              none: <Badge variant="default">尚未上傳</Badge>,
            }

            const showUploadButton = status !== 'normal' && !wasUploaded

            return (
              <div key={docType} className="border border-[#DDDDDD] rounded-xl p-4">
                {/* 卡片標題 */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#222222]">{label}</p>
                  {statusBadge[status]}
                </div>
                <div className="h-px bg-[#EEEEEE] mb-3" />

                {/* 文件資訊 */}
                {doc ? (
                  <div className="text-xs text-[#717171] space-y-1 mb-3">
                    <p>檔案：{doc.fileName}</p>
                    {doc.expiryDate && (
                      <p>到期日：{doc.expiryDate.split('T')[0]}</p>
                    )}
                    {status === 'expired' && (
                      <p className="text-[#A32D2D] font-medium">已過期，請重新上傳</p>
                    )}
                    {status === 'expiring' && (
                      <p className="text-[#B45309] font-medium">即將到期，請盡快更新</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#717171] mb-3">尚未上傳任何文件</p>
                )}

                {/* 檔案預覽 */}
                {preview && (
                  <div className="mb-3">
                    {preview.previewUrl ? (
                      <img
                        src={preview.previewUrl}
                        alt="預覽"
                        className="w-20 h-20 object-cover rounded-lg border border-[#DDDDDD]"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-[#F7F7F7] rounded-lg border border-[#DDDDDD] flex items-center justify-center">
                        <FileText className="w-8 h-8 text-[#717171]" />
                      </div>
                    )}
                    <p className="text-xs text-[#717171] mt-1">{preview.file.name}</p>
                  </div>
                )}

                {/* 上傳成功提示 */}
                {wasUploaded && (
                  <p className="text-xs text-[#008A05] mb-3">上傳成功，等待管理員審核</p>
                )}

                {/* 操作按鈕 */}
                <div className="flex items-center gap-2 flex-wrap">
                  {doc?.fileUrl && !doc.fileUrl.startsWith('upload-failed') && (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        查看
                      </Button>
                    </a>
                  )}

                  {showUploadButton && (
                    <>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        ref={el => { fileInputRefs.current[docType] = el }}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleFileSelect(docType, file)
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[docType]?.click()}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        重新上傳
                      </Button>

                      {preview && (
                        <Button
                          size="sm"
                          loading={isUploading}
                          onClick={() => handleUpload(docType)}
                        >
                          確認上傳
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 區塊 4：存值點數 */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1C1917] mb-4">存值點數</h3>

        {/* 4a: 餘額顯示 */}
        <div className="bg-[#F7F7F7] rounded-xl p-5 mb-5 text-center">
          <p className="text-xs text-[#717171] mb-1">目前點數</p>
          <p className="text-4xl font-bold text-[#222222] font-mono-nums">{profile.balance.toLocaleString()}</p>
          <p className="text-xs text-[#717171] mt-1">約當 NT$ {profile.balance.toLocaleString()} 元</p>
        </div>

        {/* 4b: 快捷加值 */}
        <div className="mb-5">
          <p className="text-xs text-[#717171] mb-3">選擇加值金額</p>

          {/* 預設金額按鈕 */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {[500, 1000, 2000].map(amt => (
              <button
                key={amt}
                onClick={() => { setSelectedPreset(amt); setCustomAmount('') }}
                className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  selectedPreset === amt
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : 'bg-white text-[#3B82F6] border-[#3B82F6] hover:bg-[#EFF6FF]'
                }`}
              >
                +{amt.toLocaleString()}
              </button>
            ))}
          </div>

          {/* 自訂金額 */}
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              min={100}
              placeholder="自訂金額（最低 100）"
              value={customAmount}
              onChange={e => { setCustomAmount(e.target.value); setSelectedPreset(null) }}
              className="flex-1 border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#222222] font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const amt = parseInt(customAmount)
                if (!isNaN(amt) && amt >= 100) setSelectedPreset(null)
              }}
            >
              自訂加值
            </Button>
          </div>

          {/* 付款方式（選擇金額後才顯示） */}
          {finalTopupAmount !== null && finalTopupAmount >= 100 && (
            <div>
              <p className="text-xs text-[#717171] mb-2">
                選擇付款方式（加值 {finalTopupAmount.toLocaleString()} 元）
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  loading={topupLoading}
                  onClick={handleTopupCredit}
                  className="bg-[#3B82F6] hover:bg-[#2563EB]"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  信用卡付款（含 3% 手續費）
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={topupLoading}
                  onClick={handleTopupTransfer}
                >
                  <Wallet className="w-3.5 h-3.5 mr-1.5" />
                  銀行轉帳
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 銀行轉帳資訊 */}
        {showTransferInfo && (
          <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-[#0C447C] mb-3">銀行轉帳資訊</p>
            <div className="space-y-3 text-sm text-[#222222]">
              <div>
                <p className="font-semibold">郵局 (代號 700)</p>
                <p className="font-mono text-sm">帳號：00312040680923</p>
              </div>
              <div className="h-px bg-[#BAE6FD]" />
              <div>
                <p className="font-semibold">渣打銀行 (代號 052)</p>
                <p className="font-mono text-sm">帳號：12220000471580</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-[#717171]">
              <p>※ 轉帳時請在備註欄填寫您的車牌號碼</p>
              <p>※ 轉帳完成後請通知 LINE 客服入帳</p>
            </div>
          </div>
        )}

        {/* 4c: 近 5 筆加值紀錄 */}
        {recentTopups.length > 0 && (
          <div>
            <p className="text-xs text-[#717171] mb-3">近 5 筆加值紀錄</p>
            <div className="divide-y divide-[#EEEEEE]">
              {recentTopups.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-xs font-mono-nums text-[#717171]">
                      {new Date(tx.createdAt).toLocaleDateString('zh-TW')}
                    </p>
                    <p className="text-xs text-[#717171] mt-0.5">{tx.description || '加值'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#22C55E] font-mono-nums">
                      +{tx.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#717171] mt-0.5">已完成</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
