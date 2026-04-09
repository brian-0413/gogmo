'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { FeeConfigPanel } from '@/components/admin/FeeConfigPanel'
import { Shield, LogOut, Plane, Settings, FileText } from 'lucide-react'
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
      {/* Header */}
      <header className="bg-[#FAF8F5] border-b border-[#DDDDDD] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1C1917] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-[18px] font-medium text-[#222222]">管理員後台</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#717171]">{user.name}</span>
              <Button variant="outline" size="sm" onClick={logout} className="text-[13px]">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-[#FAF8F5] border-b border-[#DDDDDD]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 py-3">
            <Link href="/dashboard/admin" onClick={() => setActiveTab('config')}
              className={`px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 ${
                activeTab === 'config'
                  ? 'bg-[#222222] text-white'
                  : 'bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              費率設定
            </Link>
            <Link href="/dashboard/admin/reviews"
              className="px-4 py-2 text-sm rounded-full transition-colors flex items-center gap-2 bg-transparent text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]">
              <FileText className="w-3.5 h-3.5" />
              帳號審核
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'config' && token && (
          <FeeConfigPanel token={token} />
        )}
      </main>
    </div>
  )
}
