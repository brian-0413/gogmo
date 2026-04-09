'use client'
import { useState } from 'react'

interface ForgotPasswordFormProps {
  onBack: () => void
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [role, setRole] = useState<'DRIVER' | 'DISPATCHER'>('DRIVER')
  const [account, setAccount] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) { setError('請填寫車牌/帳號'); return }
    if (role === 'DRIVER' && !email) { setError('請填寫 Email'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, role, ...(role === 'DRIVER' && { email }) }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error || '發送失敗')
      }
    } catch { setError('網路錯誤') }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full bg-[#E8F5E9] border-2 border-[#4CAF50] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#4CAF50]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-[18px] font-medium text-[#222222]">重設連結已寄出</h3>
          <p className="text-[13px] text-[#717171] mt-1 text-center">請至 Email 收取重設連結</p>
        </div>
        <button onClick={onBack} className="w-full border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-10 rounded-lg text-sm transition-colors">
          返回登入
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-[13px] text-[#717171] hover:text-[#222222] transition-colors flex items-center gap-1">
        <span>←</span> 返回
      </button>

      <div className="space-y-1">
        <h3 className="text-[18px] font-medium text-[#222222]">忘記密碼</h3>
        <p className="text-[13px] text-[#717171]">輸入您的帳戶資訊，我們會寄送重設連結</p>
      </div>

      {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Role toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setRole('DRIVER')}
          className={`h-9 rounded-lg text-sm font-normal border transition-colors ${role === 'DRIVER' ? 'bg-[#E6F1FB] border-[#0C447C] text-[#0C447C]' : 'bg-white border-[#DDDDDD] text-[#717171]'}`}>
          司機
        </button>
        <button type="button" onClick={() => setRole('DISPATCHER')}
          className={`h-9 rounded-lg text-sm font-normal border transition-colors ${role === 'DISPATCHER' ? 'bg-[#FFF3E0] border-[#FF385C] text-[#FF385C]' : 'bg-white border-[#DDDDDD] text-[#717171]'}`}>
          派單方
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">
            {role === 'DRIVER' ? '車牌號碼' : '帳號（Email）'}
          </label>
          <input type="text" value={account} onChange={e => setAccount(role === 'DRIVER' ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') : e.target.value)}
            placeholder={role === 'DRIVER' ? 'ABC-1234' : 'example@email.com'}
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
        </div>

        {role === 'DRIVER' && (
          <div className="space-y-1">
            <label className="text-[11px] text-[#717171] font-normal">註冊 Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="請輸入註冊時的 Email"
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-10 rounded-lg flex items-center justify-center transition-colors text-sm disabled:opacity-50">
          {loading ? '發送中...' : '發送重設連結'}
        </button>
      </form>
    </div>
  )
}
