'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { Plane, User, Building2, ArrowRight, Check } from 'lucide-react'
import { format } from 'date-fns'

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
  const [mounted, setMounted] = useState(false)
  const { register } = useAuth()

  useState(() => { setMounted(true) })

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
    <div className="min-h-screen bg-[#060608] text-[#f0ebe3] relative overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none grid-bg opacity-30" />

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#ff6b2b]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#ff6b2b]/4 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <nav className="relative z-10 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 group w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#ff6b2b] flex items-center justify-center">
            <Plane className="w-4 h-4 text-[#060608]" />
          </div>
          <span className="text-[#ff6b2b] font-semibold tracking-tight">
            機場接送派單平台
          </span>
        </Link>
      </nav>

      {/* Register Form */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12">
        <div className={`w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#f0ebe3] mb-2">建立帳戶</h1>
            <p className="text-[#6b6560]">加入我們的接送服務平台</p>
            <div className="mt-3 flex items-center justify-center gap-1 text-xs text-[#4a4a52] font-mono-nums">
              <span>{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-2xl p-8">
            {/* Top accent */}
            <div className="h-px bg-gradient-to-r from-transparent via-[#ff6b2b]/30 to-transparent mb-6 -mx-8 px-8" />

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-sm text-[#6b6560] font-medium">
                  身份類型
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'DRIVER' }))}
                    className={`p-4 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                      formData.role === 'DRIVER'
                        ? 'border-[#ff6b2b] bg-[#ff6b2b]/10 text-[#ff6b2b]'
                        : 'border-[#1e1e26] text-[#6b6560] hover:border-[#1e1e26]/80'
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
                        ? 'border-[#ff6b2b] bg-[#ff6b2b]/10 text-[#ff6b2b]'
                        : 'border-[#1e1e26] text-[#6b6560] hover:border-[#1e1e26]/80'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    車頭
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[#6b6560] font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="請輸入 Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-[#6b6560] font-medium">密碼</label>
                  <input
                    type="password"
                    name="password"
                    placeholder="請輸入密碼"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-[#6b6560] font-medium">確認密碼</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="請確認密碼"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[#6b6560] font-medium">姓名</label>
                <input
                  type="text"
                  name="name"
                  placeholder="請輸入姓名"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[#6b6560] font-medium">手機號碼</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="09xx-xxx-xxx"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                />
              </div>

              {/* Driver specific fields */}
              {formData.role === 'DRIVER' && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm text-[#6b6560] font-medium">車牌號碼</label>
                    <input
                      type="text"
                      name="licensePlate"
                      placeholder="例如：ABC-1234"
                      value={formData.licensePlate}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-[#6b6560] font-medium">車型</label>
                    <input
                      type="text"
                      name="carType"
                      placeholder="例如：轎車、SUV、福祉車"
                      value={formData.carType}
                      onChange={handleChange}
                      className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-[#6b6560] font-medium">車色</label>
                    <input
                      type="text"
                      name="carColor"
                      placeholder="例如：黑色、白色、銀色"
                      value={formData.carColor}
                      onChange={handleChange}
                      className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                    />
                  </div>
                </>
              )}

              {/* Dispatcher specific fields */}
              {formData.role === 'DISPATCHER' && (
                <div className="space-y-1">
                  <label className="text-sm text-[#6b6560] font-medium">公司/車隊名稱</label>
                  <input
                    type="text"
                    name="companyName"
                    placeholder="請輸入公司或車隊名稱"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full bg-[#0c0c10] border border-[#1e1e26] rounded-xl px-4 py-3 text-[#f0ebe3] placeholder-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20 transition-all"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#ff6b2b] hover:bg-[#e85a1a] text-[#060608] font-semibold h-12 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,107,43,0.3)]"
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
              </button>

              <div className="text-center text-sm text-[#6b6560]">
                已有帳戶？{' '}
                <Link href="/login" className="text-[#ff6b2b] hover:text-[#e85a1a] transition-colors">
                  立即登入
                </Link>
              </div>
            </form>
          </div>

          {/* Benefits */}
          <div className="mt-4 bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-4">
            <p className="text-[10px] text-[#4a4a52] mb-3 uppercase tracking-wider">加入優勢</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#6b6560]">
                <Check className="w-3 h-3 text-[#22c55e]" />
                <span>新用戶首刷 NT$500 點</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6b6560]">
                <Check className="w-3 h-3 text-[#22c55e]" />
                <span>每單僅收取 5% 平台服務費</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6b6560]">
                <Check className="w-3 h-3 text-[#22c55e]" />
                <span>即時訂單推播，抢单不遗漏</span>
              </div>
            </div>
          </div>

          {/* Back to home */}
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-[#4a4a52] hover:text-[#ff6b2b] transition-colors">
              返回首頁
            </Link>
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-[#3a3a40] mt-6">
            註冊即表示您同意我們的服務條款和隱私政策
          </p>
        </div>
      </div>
    </div>
  )
}
