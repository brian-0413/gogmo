'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plane } from 'lucide-react'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) { setError('無效的重設連結'); return }
    if (password.length < 6) { setError('密碼至少 6 個字元'); return }
    if (password !== confirmPassword) { setError('兩次輸入的密碼不符'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error || '重設失敗')
      }
    } catch { setError('網路錯誤') }
    setLoading(false)
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full bg-[#FCEBEB] border-2 border-[#E24B4A] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#E24B4A]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-[18px] font-medium text-[#222222]">無效的重設連結</h3>
          <p className="text-[13px] text-[#717171] mt-1 text-center">連結已過期或無效，請重新申請</p>
        </div>
        <Link href="/login" className="block w-full text-center bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-10 rounded-lg text-sm transition-colors">
          返回登入
        </Link>
      </div>
    )
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
          <h3 className="text-[18px] font-medium text-[#222222]">密碼已重設</h3>
          <p className="text-[13px] text-[#717171] mt-1 text-center">請使用新密碼登入</p>
        </div>
        <Link href="/login" className="block w-full text-center bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-10 rounded-lg text-sm transition-colors">
          前往登入
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-[18px] font-medium text-[#222222]">設定新密碼</h3>
      {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171] font-normal">新密碼</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="至少 6 個字元"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171] font-normal">確認密碼</label>
        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
          placeholder="再次輸入密碼"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-10 rounded-lg text-sm transition-colors disabled:opacity-50">
        {loading ? '儲存中...' : '儲存新密碼'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      <nav className="px-6 py-4 bg-[#FAF8F5]">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#222222] font-medium">機場接送派單平台</span>
        </Link>
      </nav>
      <div className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6">
            <Suspense fallback={<div className="text-center py-8 text-[#717171]">載入中...</div>}>
              <ResetPasswordForm />
            </Suspense>
          </div>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-[11px] text-[#717171] hover:text-[#222222] transition-colors">
              返回登入
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
