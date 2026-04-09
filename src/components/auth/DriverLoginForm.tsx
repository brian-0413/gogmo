'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export function DriverLoginForm() {
  const [licensePlate, setLicensePlate] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicensePlate(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licensePlate || !password) { setError('請填寫車牌和密碼'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: licensePlate, password, role: 'DRIVER' }),
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
        <label className="text-[11px] text-[#717171] font-normal">車牌號碼</label>
        <input type="text" value={licensePlate} onChange={handlePlateChange}
          placeholder="ABC-1234" maxLength={10} autoComplete="off"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] font-mono-nums" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-[#717171] font-normal">密碼</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="請輸入密碼"
          className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-[#0C447C] hover:bg-[#0a3a6e] text-white font-medium h-11 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50">
        {loading ? '登入中...' : '司機登入'}
      </button>
    </form>
  )
}
