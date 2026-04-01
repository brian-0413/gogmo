'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    // Auto-redirect if already logged in
  }, [])

  const handleAutoLogin = async (role: 'DRIVER' | 'DISPATCHER') => {
    setLoading(true)
    setSelectedRole(role)
    await login(TEST_ACCOUNTS[role].email, TEST_ACCOUNTS[role].password)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white text-[#222222]">
      {/* Header */}
      <nav className="px-8 py-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#222222] font-medium text-base">機場接送派單平台</span>
        </Link>
      </nav>

      {/* Main content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] px-6">
        <div className="w-full max-w-md">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-[22px] font-medium text-[#222222] mb-1">
              選擇登入身份
            </h1>
            <p className="text-[13px] text-[#717171]">
              點擊下方按鈕快速登入測試系統
            </p>
          </div>

          {/* Role cards */}
          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6 space-y-3">
            {/* Driver card */}
            <button
              onClick={() => handleAutoLogin('DRIVER')}
              disabled={loading}
              className="group w-full flex items-center gap-4 p-4 rounded-xl border border-[#DDDDDD] bg-[#F7F7F7] hover:border-[#0C447C] hover:bg-[#E6F1FB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-lg bg-[#E6F1FB] border border-[#C2DBF5] flex items-center justify-center flex-shrink-0">
                <Car className="w-6 h-6 text-[#0C447C]" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#222222]">司機端</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-[#E6F1FB] text-[#0C447C] border border-[#C2DBF5]">DRIVER</span>
                </div>
                <div className="font-mono-nums text-[13px] text-[#717171] mt-0.5">{TEST_ACCOUNTS.DRIVER.email}</div>
              </div>
              {loading && selectedRole === 'DRIVER' ? (
                <Loader2 className="w-5 h-5 text-[#0C447C] animate-spin flex-shrink-0" />
              ) : (
                <ArrowRight className="w-5 h-5 text-[#717171] group-hover:text-[#0C447C] group-hover:translate-x-1 transition-all flex-shrink-0" />
              )}
            </button>

            {/* Dispatcher card */}
            <button
              onClick={() => handleAutoLogin('DISPATCHER')}
              disabled={loading}
              className="group w-full flex items-center gap-4 p-4 rounded-xl border border-[#DDDDDD] bg-[#F7F7F7] hover:border-[#FF385C] hover:bg-[#FFF3E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-lg bg-[#FFF3E0] border border-[#FFE0B2] flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-[#B45309]" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#222222]">車頭端</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-[#FFF3E0] text-[#B45309] border border-[#FFE0B2]">DISPATCHER</span>
                </div>
                <div className="font-mono-nums text-[13px] text-[#717171] mt-0.5">{TEST_ACCOUNTS.DISPATCHER.email}</div>
              </div>
              {loading && selectedRole === 'DISPATCHER' ? (
                <Loader2 className="w-5 h-5 text-[#B45309] animate-spin flex-shrink-0" />
              ) : (
                <ArrowRight className="w-5 h-5 text-[#717171] group-hover:text-[#B45309] group-hover:translate-x-1 transition-all flex-shrink-0" />
              )}
            </button>
          </div>

          {/* Back to home */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-[13px] text-[#717171] hover:text-[#222222] transition-colors">
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
