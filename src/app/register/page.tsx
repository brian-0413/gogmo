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
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Header */}
      <nav className="px-6 py-4 bg-[#FAF8F5]">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#222222] font-medium">機場接送派單平台</span>
        </Link>
      </nav>

      {/* Register Form */}
      <div className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-[22px] font-medium text-[#222222] mb-1">建立帳戶</h1>
            <p className="text-[13px] text-[#717171]">加入我們的接送服務平台</p>
            <div className="mt-2 text-xs text-[#B0B0B0] font-mono-nums">
              {format(new Date(), 'yyyy/MM/dd HH:mm')}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-[11px] text-[#717171] font-normal">身份類型</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'DRIVER' }))}
                    className={`p-3 rounded-xl border text-sm font-normal flex flex-col items-center gap-1.5 transition-colors ${
                      formData.role === 'DRIVER'
                        ? 'border-[#FF385C] bg-[#FFF3E0] text-[#B45309]'
                        : 'border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    司機
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'DISPATCHER' }))}
                    className={`p-3 rounded-xl border text-sm font-normal flex flex-col items-center gap-1.5 transition-colors ${
                      formData.role === 'DISPATCHER'
                        ? 'border-[#FF385C] bg-[#FFF3E0] text-[#B45309]'
                        : 'border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    車頭
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#717171] font-normal">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="請輸入 Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#717171] font-normal">密碼</label>
                  <input
                    type="password"
                    name="password"
                    placeholder="請輸入密碼"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#717171] font-normal">確認密碼</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="請確認密碼"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#717171] font-normal">姓名</label>
                <input
                  type="text"
                  name="name"
                  placeholder="請輸入姓名"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#717171] font-normal">手機號碼</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="09xx-xxx-xxx"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                />
              </div>

              {/* Driver specific fields */}
              {formData.role === 'DRIVER' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#717171] font-normal">車牌號碼</label>
                    <input
                      type="text"
                      name="licensePlate"
                      placeholder="例如：ABC-1234"
                      value={formData.licensePlate}
                      onChange={handleChange}
                      required
                      className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#717171] font-normal">車型</label>
                    <input
                      type="text"
                      name="carType"
                      placeholder="例如：轎車、SUV、福祉車"
                      value={formData.carType}
                      onChange={handleChange}
                      className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#717171] font-normal">車色</label>
                    <input
                      type="text"
                      name="carColor"
                      placeholder="例如：黑色、白色、銀色"
                      value={formData.carColor}
                      onChange={handleChange}
                      className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                </>
              )}

              {/* Dispatcher specific fields */}
              {formData.role === 'DISPATCHER' && (
                <div className="space-y-1">
                  <label className="text-[11px] text-[#717171] font-normal">公司/車隊名稱</label>
                  <input
                    type="text"
                    name="companyName"
                    placeholder="請輸入公司或車隊名稱"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#FF385C] hover:bg-[#D70466] text-white font-normal h-10 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                disabled={loading}
              >
                {loading ? '註冊中...' : (
                  <>
                    註冊
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center text-sm text-[#717171]">
                已有帳戶？{' '}
                <Link href="/login" className="text-[#FF385C] hover:text-[#D70466] transition-colors">
                  立即登入
                </Link>
              </div>
            </form>
          </div>

          {/* Benefits */}
          <div className="mt-3 bg-[#F4EFE9] border border-[#DDDDDD] rounded-xl p-4">
            <p className="text-[11px] text-[#717171] mb-2">加入優勢</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-[#717171]">
                <Check className="w-3 h-3 text-[#008A05]" />
                <span>新用戶首刷 NT$500 點</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#717171]">
                <Check className="w-3 h-3 text-[#008A05]" />
                <span>每單僅收取 5% 平台服務費</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#717171]">
                <Check className="w-3 h-3 text-[#008A05]" />
                <span>即時訂單推播，抢单不遗漏</span>
              </div>
            </div>
          </div>

          {/* Back to home */}
          <div className="mt-3 text-center">
            <Link href="/" className="text-[11px] text-[#717171] hover:text-[#222222] transition-colors">
              返回首頁
            </Link>
          </div>

          <p className="text-center text-[11px] text-[#B0B0B0] mt-4">
            註冊即表示您同意我們的服務條款和隱私政策
          </p>
        </div>
      </div>
    </div>
  )
}
