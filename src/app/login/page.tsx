'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Plane, Car, Building2, ArrowRight, Loader2 } from 'lucide-react'

const TEST_ACCOUNTS = {
  DRIVER: { email: 'driver1@test.com', password: 'test123', role: '司機' },
  DISPATCHER: { email: 'dispatcher1@test.com', password: 'test123', role: '車頭' },
} as const

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'DRIVER' | 'DISPATCHER' | null>(null)
  const { login } = useAuth()

  const handleAutoLogin = async (role: 'DRIVER' | 'DISPATCHER') => {
    setLoading(true)
    setSelectedRole(role)
    await login(TEST_ACCOUNTS[role].email, TEST_ACCOUNTS[role].password)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#ff8c42]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#ff8c42]/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <nav className="relative z-10 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 group w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#ff8c42] flex items-center justify-center">
            <Plane className="w-4 h-4 text-black" />
          </div>
          <span className="text-[#ff8c42] font-semibold tracking-tight">
            機場接送派單平台
          </span>
        </Link>
      </nav>

      {/* Login Selection */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ff8c42]/10 border border-[#ff8c42]/20 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8c42] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff8c42]"></span>
              </span>
              <span className="text-xs text-[#ff8c42] font-medium">測試模式</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">選擇測試身份</h1>
            <p className="text-[#666]">點擊下方按鈕快速登入</p>
          </div>

          {/* Role Selection */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 backdrop-blur-sm space-y-4">
            <button
              onClick={() => handleAutoLogin('DRIVER')}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 bg-[#0a0a0a] border border-white/10 rounded-xl hover:border-[#3b82f6]/50 hover:bg-[#0a0a0a]/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center">
                <Car className="w-6 h-6 text-[#3b82f6]" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-semibold">司機端</div>
                <div className="text-[#666] text-sm">{TEST_ACCOUNTS.DRIVER.email}</div>
              </div>
              {loading && selectedRole === 'DRIVER' ? (
                <Loader2 className="w-5 h-5 text-[#3b82f6] animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5 text-[#666]" />
              )}
            </button>

            <button
              onClick={() => handleAutoLogin('DISPATCHER')}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 bg-[#0a0a0a] border border-white/10 rounded-xl hover:border-[#22c55e]/50 hover:bg-[#0a0a0a]/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#22c55e]" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-semibold">車頭端</div>
                <div className="text-[#666] text-sm">{TEST_ACCOUNTS.DISPATCHER.email}</div>
              </div>
              {loading && selectedRole === 'DISPATCHER' ? (
                <Loader2 className="w-5 h-5 text-[#22c55e] animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5 text-[#666]" />
              )}
            </button>
          </div>

          {/* Back to home */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-[#666] hover:text-[#ff8c42] transition-colors">
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
