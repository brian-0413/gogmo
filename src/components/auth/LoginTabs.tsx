'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plane, Car, Building2, Shield } from 'lucide-react'
import { DriverLoginForm } from './DriverLoginForm'
import { DispatcherLoginForm } from './DispatcherLoginForm'
import { AdminLoginForm } from './AdminLoginForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export function LoginTabs() {
  const [activeTab, setActiveTab] = useState<'DRIVER' | 'DISPATCHER' | 'ADMIN'>('DRIVER')
  const [showForgot, setShowForgot] = useState(false)
  const [tabAnimKey, setTabAnimKey] = useState(0)

  const handleTabChange = (tab: 'DRIVER' | 'DISPATCHER' | 'ADMIN') => {
    setTabAnimKey(k => k + 1)
    setActiveTab(tab)
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
        <nav className="px-6 py-4 bg-[#FAF8F5]">
          <Link href="/" className="flex items-center gap-2 w-fit group">
            <div className="w-9 h-9 rounded-xl bg-[#FF385C] flex items-center justify-center shadow-lg shadow-[#FF385C]/20 transition-transform duration-200 group-hover:scale-105">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#222222] font-bold tracking-tight">goGMO</span>
          </Link>
        </nav>
        <div className="flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-reveal-up">
              <ForgotPasswordForm onBack={() => setShowForgot(false)} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Skip to content */}
      <a
        href="#main-login"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#FF385C] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
      >
        跳到主要內容
      </a>

      <nav className="px-6 py-4 bg-[#FAF8F5]">
        <Link href="/" className="flex items-center gap-2 w-fit group">
          <div className="w-9 h-9 rounded-xl bg-[#FF385C] flex items-center justify-center shadow-lg shadow-[#FF385C]/20 transition-transform duration-200 group-hover:scale-105">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#222222] font-bold tracking-tight">goGMO</span>
        </Link>
      </nav>

      <div id="main-login" className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6 animate-reveal-up">
            <h1 className="text-[22px] font-bold text-[#111] tracking-tight mb-1">登入</h1>
            <p className="text-[13px] text-[#717171]">選擇您的身份類型登入</p>
          </div>

          {/* Tab bar */}
          <div className="grid grid-cols-3 gap-2 mb-4 animate-reveal-up delay-100">
            {[
              { key: 'DRIVER' as const, icon: Car, label: '司機登入', shortLabel: '司機', accent: '#0C447C' },
              { key: 'DISPATCHER' as const, icon: Building2, label: '派單方登入', shortLabel: '派單', accent: '#FF385C' },
              { key: 'ADMIN' as const, icon: Shield, label: '管理員', shortLabel: '管理', accent: '#6B7280' },
            ].map(({ key, icon: Icon, label, shortLabel, accent }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`h-11 rounded-xl text-sm font-semibold border-2 transition-all duration-200 flex items-center justify-center gap-2 btn-physics ${
                  activeTab === key
                    ? 'text-white border-transparent shadow-lg'
                    : 'bg-white border-[#DDDDDD] text-[#717171] hover:border-[#888] active:scale-[0.97]'
                }`}
                style={activeTab === key ? { backgroundColor: accent, borderColor: accent } : {}}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
              </button>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-white border border-[#EAEAEA] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Active tab indicator bar */}
            <div className="h-0.5" style={{ backgroundColor: activeTab === 'DRIVER' ? '#0C447C' : activeTab === 'DISPATCHER' ? '#FF385C' : '#6B7280' }} />

            {/* Form content with crossfade */}
            <div className="p-6" key={tabAnimKey}>
              <div className="animate-reveal-up">
                {activeTab === 'DRIVER' ? <DriverLoginForm /> : activeTab === 'DISPATCHER' ? <DispatcherLoginForm /> : <AdminLoginForm />}
              </div>

              {activeTab !== 'ADMIN' && (
                <div className="mt-4 pt-4 border-t border-[#EEEEEE] flex justify-between items-center">
                  <button
                    onClick={() => setShowForgot(true)}
                    className="text-[13px] text-[#717171] hover:text-[#222222] transition-colors"
                  >
                    忘記密碼？
                  </button>
                  <Link href="/register" className="text-[13px] text-[#FF385C] hover:text-[#D70466] font-medium transition-colors">
                    還沒有帳戶？立即註冊
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-center animate-reveal-up delay-200">
            <Link href="/" className="text-[11px] text-[#717171] hover:text-[#222222] transition-colors">
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
