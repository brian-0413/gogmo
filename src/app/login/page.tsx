'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'
import { Plane, ArrowRight, User, Lock, Radio } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(email, password)
    if (!result.success) {
      setError(result.error || '登入失敗')
    }
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

      {/* Login Form */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ff8c42]/10 border border-[#ff8c42]/20 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8c42] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff8c42]"></span>
              </span>
              <span className="text-xs text-[#ff8c42] font-medium">系統登入</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">歡迎回來</h1>
            <p className="text-[#666]">登入您的帳戶以開始接單</p>
          </div>

          {/* Form Card */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm text-[#a0a0a0] font-medium">Email</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                  <input
                    type="email"
                    placeholder="請輸入 Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 pl-12 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-[#a0a0a0] font-medium">密碼</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                  <input
                    type="password"
                    placeholder="請輸入密碼"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 pl-12 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-semibold h-12 rounded-xl flex items-center justify-center gap-2 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="animate-pulse">登入中...</span>
                ) : (
                  <>
                    登入
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-[#666]">
                還沒有帳戶？{' '}
                <Link href="/register" className="text-[#ff8c42] hover:text-[#ff9d5c] transition-colors">
                  立即註冊
                </Link>
              </div>
            </form>
          </div>

          {/* Demo accounts */}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-3 h-3 text-[#22c55e]" />
              <span className="text-xs text-[#22c55e] uppercase tracking-wider">測試帳號</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#666]">司機：</span>
                <span className="font-mono text-[#3b82f6]">driver1@test.com</span>
                <span className="text-[#444]">/ password123</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#666]">車頭：</span>
                <span className="font-mono text-[#22c55e]">dispatcher1@test.com</span>
                <span className="text-[#444]">/ password123</span>
              </div>
            </div>
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
