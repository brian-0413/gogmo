'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Plane, Car, Building2, ArrowRight, Loader2, Radio } from 'lucide-react'

const TEST_ACCOUNTS = {
  DRIVER: { email: 'driver1@test.com', password: 'test123', role: '司機' },
  DISPATCHER: { email: 'dispatcher1@test.com', password: 'test123', role: '車頭' },
} as const

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'DRIVER' | 'DISPATCHER' | null>(null)
  const { login } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleAutoLogin = async (role: 'DRIVER' | 'DISPATCHER') => {
    setLoading(true)
    setSelectedRole(role)
    await login(TEST_ACCOUNTS[role].email, TEST_ACCOUNTS[role].password)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#060608] text-[#f0ebe3] relative overflow-hidden">
      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 scan-lines" />

        {/* Ambient glows */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(ellipse, rgba(255,107,43,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(255,107,43,0.2) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Header */}
      <nav className="relative z-10 px-8 py-6">
        <Link href="/" className="flex items-center gap-3 group w-fit">
          <div className="w-9 h-9 rounded-lg bg-[#ff6b2b] flex items-center justify-center shadow-[0_0_20px_rgba(255,107,43,0.4)]">
            <Plane className="w-4 h-4 text-[#060608]" />
          </div>
          <span className="text-[#ff6b2b] font-semibold tracking-tight text-lg">
            機場接送派單平台
          </span>
        </Link>
      </nav>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-100px)] px-6">
        <div className="w-full max-w-lg" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
          {/* Hero section */}
          <div className="text-center mb-10">
            {/* Live indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#ff6b2b]/20 bg-[#ff6b2b]/5 mb-6">
              <Radio className="w-3 h-3 text-[#ff6b2b] animate-pulse" />
              <span className="text-xs text-[#ff6b2b] font-medium tracking-wider uppercase">系統上線中</span>
            </div>

            {/* Title with gradient */}
            <h1 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">
              <span className="text-[#f0ebe3]">選擇你的</span>
              <br />
              <span className="gradient-text-ember">角色身份</span>
            </h1>

            <p className="text-[#6b6560] text-base max-w-sm mx-auto">
              點擊下方按鈕快速登入測試系統
            </p>

            {/* Decorative time display */}
            <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-[#0c0c10] border border-[#1e1e26]">
              <span className="font-mono-nums text-xs text-[#6b6560]">LOCAL</span>
              <span className="font-mono-nums text-sm text-[#ff6b2b] font-semibold">
                {new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Role Selection Card */}
          <div className="relative">
            {/* Decorative border glow */}
            <div className="absolute -inset-px rounded-[20px] bg-gradient-to-br from-[#ff6b2b]/20 via-transparent to-[#ff6b2b]/10 opacity-50 blur-sm" />

            <div className="relative bg-[#0c0c10] rounded-[20px] p-1 border border-[#1e1e26]">
              <div className="bg-[#0c0c10] rounded-[18px] p-8 space-y-3">

                {/* Driver card */}
                <button
                  onClick={() => handleAutoLogin('DRIVER')}
                  disabled={loading}
                  className="group w-full flex items-center gap-5 p-5 rounded-xl border border-[#1e1e26] bg-[#141418] hover:border-[#3b82f6]/40 hover:bg-[#141418]/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#3b82f6]/0 via-[#3b82f6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative flex items-center gap-5 w-full">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center flex-shrink-0 group-hover:border-[#3b82f6]/40 group-hover:bg-[#3b82f6]/15 transition-all duration-300">
                      <Car className="w-7 h-7 text-[#3b82f6]" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[#f0ebe3] font-semibold text-lg">司機端</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/20">DRIVER</span>
                      </div>
                      <div className="font-mono-nums text-[#6b6560] text-sm mt-0.5">{TEST_ACCOUNTS.DRIVER.email}</div>
                    </div>

                    {/* Arrow */}
                    {loading && selectedRole === 'DRIVER' ? (
                      <Loader2 className="w-5 h-5 text-[#3b82f6] animate-spin flex-shrink-0" />
                    ) : (
                      <ArrowRight className="w-5 h-5 text-[#3b82f6]/40 group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" />
                    )}
                  </div>
                </button>

                {/* Dispatcher card */}
                <button
                  onClick={() => handleAutoLogin('DISPATCHER')}
                  disabled={loading}
                  className="group w-full flex items-center gap-5 p-5 rounded-xl border border-[#1e1e26] bg-[#141418] hover:border-[#ff6b2b]/40 hover:bg-[#141418]/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#ff6b2b]/0 via-[#ff6b2b]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative flex items-center gap-5 w-full">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl bg-[#ff6b2b]/10 border border-[#ff6b2b]/20 flex items-center justify-center flex-shrink-0 group-hover:border-[#ff6b2b]/40 group-hover:bg-[#ff6b2b]/15 transition-all duration-300">
                      <Building2 className="w-7 h-7 text-[#ff6b2b]" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[#f0ebe3] font-semibold text-lg">車頭端</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#ff6b2b]/15 text-[#ff6b2b] border border-[#ff6b2b]/20">DISPATCHER</span>
                      </div>
                      <div className="font-mono-nums text-[#6b6560] text-sm mt-0.5">{TEST_ACCOUNTS.DISPATCHER.email}</div>
                    </div>

                    {/* Arrow */}
                    {loading && selectedRole === 'DISPATCHER' ? (
                      <Loader2 className="w-5 h-5 text-[#ff6b2b] animate-spin flex-shrink-0" />
                    ) : (
                      <ArrowRight className="w-5 h-5 text-[#ff6b2b]/40 group-hover:text-[#ff6b2b] group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#6b6560] hover:text-[#ff6b2b] transition-colors duration-200">
              <span>返回首頁</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>

          {/* Bottom decorative line */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#1e1e26]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#ff6b2b]/40" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#1e1e26]" />
          </div>
        </div>
      </div>
    </div>
  )
}
