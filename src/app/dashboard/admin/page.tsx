'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { FeeConfigPanel } from '@/components/admin/FeeConfigPanel'
import { Shield, LogOut, Plane, Settings, FileText, Users, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function AdminDashboard() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'config' | 'stats'>('config')

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[#78716C] text-sm">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Skip to content */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#FF385C] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
      >
        跳到主要內容
      </a>

      {/* Header */}
      <header className="bg-[#FAF8F5]/90 backdrop-blur-xl border-b border-[#EAEAEA] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1C1917] flex items-center justify-center shadow-md">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-[18px] font-bold text-[#111] tracking-tight">管理員後台</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#717171]">{user.name}</span>
              <Button variant="outline" size="sm" onClick={logout} className="text-[13px] btn-physics">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-[#FAF8F5] border-b border-[#EAEAEA]" aria-label="管理功能導航">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 py-3">
            <Link href="/dashboard/admin" onClick={() => setActiveTab('config')}
              className={`px-4 py-2 text-sm rounded-full transition-all duration-200 flex items-center gap-2 btn-physics ${
                activeTab === 'config'
                  ? 'bg-[#222222] text-white shadow-md'
                  : 'bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7] hover:border-[#999]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              費率設定
            </Link>
            <Link href="/dashboard/admin/reviews"
              className="px-4 py-2 text-sm rounded-full transition-all duration-200 flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7] btn-physics">
              <FileText className="w-3.5 h-3.5" />
              帳號審核
            </Link>
            <Link href="/dashboard/admin/users"
              className="px-4 py-2 text-sm rounded-full transition-all duration-200 flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7] btn-physics">
              <Users className="w-3.5 h-3.5" />
              使用者管理
            </Link>
            <Link href="/dashboard/admin/drive-test"
              className="px-4 py-2 text-sm rounded-full transition-all duration-200 flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7] btn-physics">
              <FolderOpen className="w-3.5 h-3.5" />
              Drive 測試
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main id="admin-main" className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'config' && token && (
          <FeeConfigPanel token={token} />
        )}
      </main>
    </div>
  )
}
