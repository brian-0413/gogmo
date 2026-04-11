'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('請填寫帳號和密碼'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: email, password, role: 'ADMIN' }),
      })
      const data = await res.json()
      if (data.success) {
        const userRes = await fetch('/api/auth', { headers: { Authorization: `Bearer ${data.data.token}` } })
        const userData = await userRes.json()
        login(data.data.token, userData.data)
      } else {
        setError(data.error || '登入失敗')
      }
    } catch { setError('網路錯誤') }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171] font-normal">帳號（Email）</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="請輸入管理員 Email"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171] font-normal">密碼</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="請輸入密碼"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-[#6B7280] hover:bg-[#4B5563] text-white font-medium h-11 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50">
        {loading ? '登入中...' : '管理員登入'}
      </button>
    </form>
  )
}
