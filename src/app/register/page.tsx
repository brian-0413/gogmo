'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">✈️ 機場接送派單平台</h1>
          <p className="text-slate-600 mt-2">建立您的帳戶</p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-center">會員註冊</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  身份類型
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'DRIVER' }))}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.role === 'DRIVER'
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    👨‍✈️ 司機
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'DISPATCHER' }))}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.role === 'DISPATCHER'
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    🏢 車頭
                  </button>
                </div>
              </div>

              <Input
                type="email"
                name="email"
                label="Email"
                placeholder="請輸入 Email"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="password"
                  name="password"
                  label="密碼"
                  placeholder="請輸入密碼"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <Input
                  type="password"
                  name="confirmPassword"
                  label="確認密碼"
                  placeholder="請確認密碼"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <Input
                type="text"
                name="name"
                label="姓名"
                placeholder="請輸入姓名"
                value={formData.name}
                onChange={handleChange}
                required
              />

              <Input
                type="tel"
                name="phone"
                label="手機號碼"
                placeholder="09xx-xxx-xxx"
                value={formData.phone}
                onChange={handleChange}
                required
              />

              {/* Driver specific fields */}
              {formData.role === 'DRIVER' && (
                <>
                  <Input
                    type="text"
                    name="licensePlate"
                    label="車牌號碼"
                    placeholder="例如：ABC-1234"
                    value={formData.licensePlate}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    type="text"
                    name="carType"
                    label="車型"
                    placeholder="例如：轎車、SUV、福祉車"
                    value={formData.carType}
                    onChange={handleChange}
                  />
                  <Input
                    type="text"
                    name="carColor"
                    label="車色"
                    placeholder="例如：黑色、白色、銀色"
                    value={formData.carColor}
                    onChange={handleChange}
                  />
                </>
              )}

              {/* Dispatcher specific fields */}
              {formData.role === 'DISPATCHER' && (
                <Input
                  type="text"
                  name="companyName"
                  label="公司/車隊名稱"
                  placeholder="請輸入公司或車隊名稱"
                  value={formData.companyName}
                  onChange={handleChange}
                />
              )}

              <Button type="submit" className="w-full" loading={loading}>
                註冊
              </Button>

              <div className="text-center text-sm text-slate-600">
                已有帳戶？{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  立即登入
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          註冊即表示您同意我們的服務條款和隱私政策
        </p>
      </div>
    </div>
  )
}
