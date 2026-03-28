'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Plane } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()

  useEffect(() => {
    // Auto-login with test driver account on mount
    login('driver1@test.com', 'test123')
  }, [])

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

      {/* Loading State */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ff8c42]/10 border border-[#ff8c42]/20 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8c42] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff8c42]"></span>
            </span>
            <span className="text-xs text-[#ff8c42] font-medium">自動登入中...</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">司機端測試模式</h1>
          <p className="text-[#666] text-sm">使用 driver1@test.com / test123</p>
        </div>
      </div>
    </div>
  )
}
