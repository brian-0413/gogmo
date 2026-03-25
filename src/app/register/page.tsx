'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { Plane, User, Building2, ArrowRight, Check } from 'lucide-react'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    role: 'DRIVER' as 'DRIVER' | 'DISPATCHER',
    licensePlate: '',
    carType: '轎車',
    carColor: '',
    companyName: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('密碼確認不符')
      return
    }

    if (formData.password.length < 6) {
      setError('密碼至少需要 6 個字元')
      return
    }

    if (formData.role === 'DRIVER' && !formData.licensePlate) {
      setError('司機必須填寫車牌號碼')
      return
    }

    setLoading(true)

    const result = await register(formData)
    if (!result.success) {
      setError(result.error || '註冊失敗')
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

      {/* Register Form */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">建立帳戶</h1>
            <p className="text-[#666]">加入我們的接送服務平台</p>
          </div>

          {/* Form Card */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-sm text-[#a0a0a0] font-medium">
                  身份類型
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'DRIVER' }))}
                    className={`p-4 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                      formData.role === 'DRIVER'
                        ? 'border-[#ff8c42] bg-[#ff8c42]/10 text-[#ff8c42]'
                        : 'border-white/10 text-[#666] hover:border-white/20'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    司機
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'DISPATCHER' }))}
                    className={`p-4 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                      formData.role === 'DISPATCHER'
                        ? 'border-[#ff8c42] bg-[#ff8c42]/10 text-[#ff8c42]'
                        : 'border-white/10 text-[#666] hover:border-white/20'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    車頭
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[#a0a0a0] font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="請輸入 Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-[#a0a0a0] font-medium">密碼</label>
                  <input
                    type="password"
                    name="password"
                    placeholder="請輸入密碼"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-[#a0a0a0] font-medium">確認密碼</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="請確認密碼"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[#a0a0a0] font-medium">姓名</label>
                <input
                  type="text"
                  name="name"
                  placeholder="請輸入姓名"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[#a0a0a0] font-medium">手機號碼</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="09xx-xxx-xxx"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                />
              </div>

              {/* Driver specific fields */}
              {formData.role === 'DRIVER' && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm text-[#a0a0a0] font-medium">車牌號碼</label>
                    <input
                      type="text"
                      name="licensePlate"
                      placeholder="例如：ABC-1234"
                      value={formData.licensePlate}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-[#a0a0a0] font-medium">車型</label>
                    <input
                      type="text"
                      name="carType"
                      placeholder="例如：轎車、SUV、福祉車"
                      value={formData.carType}
                      onChange={handleChange}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-[#a0a0a0] font-medium">車色</label>
                    <input
                      type="text"
                      name="carColor"
                      placeholder="例如：黑色、白色、銀色"
                      value={formData.carColor}
                      onChange={handleChange}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                    />
                  </div>
                </>
              )}

              {/* Dispatcher specific fields */}
              {formData.role === 'DISPATCHER' && (
                <div className="space-y-1">
                  <label className="text-sm text-[#a0a0a0] font-medium">公司/車隊名稱</label>
                  <input
                    type="text"
                    name="companyName"
                    placeholder="請輸入公司或車隊名稱"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:ring-1 focus:ring-[#ff8c42]/20 transition-all"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#ff8c42] hover:bg-[#ff9d5c] text-black font-semibold h-12 rounded-xl flex items-center justify-center gap-2 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="animate-pulse">註冊中...</span>
                ) : (
                  <>
                    註冊
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-[#666]">
                已有帳戶？{' '}
                <Link href="/login" className="text-[#ff8c42] hover:text-[#ff9d5c] transition-colors">
                  立即登入
                </Link>
              </div>
            </form>
          </div>

          {/* Benefits */}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-xs text-[#666] mb-3 uppercase tracking-wider">加入優勢</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                <Check className="w-3 h-3 text-[#22c55e]" />
                <span>新用戶首刷 NT$500 點</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                <Check className="w-3 h-3 text-[#22c55e]" />
                <span>每單僅收取 5% 平台服務費</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                <Check className="w-3 h-3 text-[#22c55e]" />
                <span>即時訂單推播，抢单不遗漏</span>
              </div>
            </div>
          </div>

          {/* Back to home */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-[#666] hover:text-[#ff8c42] transition-colors">
              返回首頁
            </Link>
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-[#444] mt-6">
            註冊即表示您同意我們的服務條款和隱私政策
          </p>
        </div>
      </div>
    </div>
  )
}
