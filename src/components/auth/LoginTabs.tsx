'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plane, Car, Building2 } from 'lucide-react'
import { DriverLoginForm } from './DriverLoginForm'
import { DispatcherLoginForm } from './DispatcherLoginForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export function LoginTabs() {
  const [activeTab, setActiveTab] = useState<'DRIVER' | 'DISPATCHER'>('DRIVER')
  const [showForgot, setShowForgot] = useState(false)

  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
        <nav className="px-6 py-4 bg-[#FAF8F5]">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#222222] font-medium">機場接送派單平台</span>
          </Link>
        </nav>
        <div className="flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white border border-[#DDDDDD] rounded-xl p-6">
              <ForgotPasswordForm onBack={() => setShowForgot(false)} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      <nav className="px-6 py-4 bg-[#FAF8F5]">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#222222] font-medium">機場接送派單平台</span>
        </Link>
      </nav>

      <div className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-[22px] font-medium text-[#222222] mb-1">登入</h1>
            <p className="text-[13px] text-[#717171]">選擇您的身份類型登入</p>
          </div>

          {/* Tab bar */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setActiveTab('DRIVER')}
              className={`h-11 rounded-lg text-sm font-medium border-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'DRIVER'
                  ? 'bg-[#0C447C] border-[#0C447C] text-white'
                  : 'bg-white border-[#DDDDDD] text-[#717171] hover:border-[#0C447C] hover:text-[#0C447C]'
              }`}
            >
              <Car className="w-4 h-4" />
              司機登入
            </button>
            <button
              onClick={() => setActiveTab('DISPATCHER')}
              className={`h-11 rounded-lg text-sm font-medium border-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'DISPATCHER'
                  ? 'bg-[#FF385C] border-[#FF385C] text-white'
                  : 'bg-white border-[#DDDDDD] text-[#717171] hover:border-[#FF385C] hover:text-[#FF385C]'
              }`}
            >
              <Building2 className="w-4 h-4" />
              派單方登入
            </button>
          </div>

          {/* Form card */}
          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6">
            {activeTab === 'DRIVER' ? <DriverLoginForm /> : <DispatcherLoginForm />}

            <div className="mt-4 pt-4 border-t border-[#EEEEEE] flex justify-between items-center">
              <button
                onClick={() => setShowForgot(true)}
                className="text-[13px] text-[#717171] hover:text-[#222222] transition-colors"
              >
                忘記密碼？
              </button>
              <Link href="/register" className="text-[13px] text-[#FF385C] hover:text-[#D70466] transition-colors">
                還沒有帳戶？立即註冊
              </Link>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="text-[11px] text-[#717171] hover:text-[#222222] transition-colors">
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
