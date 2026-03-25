'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">✈️ 機場接送派單平台</h1>
          <p className="text-slate-600 mt-2">登入您的帳戶</p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-center">會員登入</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                type="email"
                label="Email"
                placeholder="請輸入 Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                type="password"
                label="密碼"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button type="submit" className="w-full" loading={loading}>
                登入
              </Button>

              <div className="text-center text-sm text-slate-600">
                還沒有帳戶？{' '}
                <Link href="/register" className="text-blue-600 hover:underline">
                  立即註冊
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Demo accounts */}
        <Card className="mt-6" variant="outline">
          <CardContent className="text-xs text-slate-600">
            <p className="font-medium mb-2">測試帳號：</p>
            <p>司機：driver@test.com / password123</p>
            <p>車頭：dispatcher@test.com / password123</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
