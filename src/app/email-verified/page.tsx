'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plane } from 'lucide-react'

function EmailVerifiedContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const errorMsg = searchParams.get('message')

  if (status === 'success') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full bg-[#E8F5E9] border-2 border-[#4CAF50] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#4CAF50]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-[18px] font-medium text-[#222222]">Email 驗證成功！</h3>
          <p className="text-[13px] text-[#717171] mt-2 text-center">
            您的資料已送出，我們將在 1-2 個工作天內完成審核。<br />
            審核通過後即可開始使用平台。
          </p>
        </div>
        <Link href="/login" className="block w-full text-center bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-10 rounded-lg text-sm transition-colors">
          前往登入
        </Link>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full bg-[#FCEBEB] border-2 border-[#E24B4A] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#E24B4A]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-[18px] font-medium text-[#222222]">無效的驗證連結</h3>
          <p className="text-[13px] text-[#717171] mt-1 text-center">請確認連結是否正確或已過期。</p>
        </div>
        <Link href="/login" className="block w-full text-center border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-10 rounded-lg text-sm transition-colors">
          返回登入
        </Link>
      </div>
    )
  }

  // error or default
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4">
        <div className="w-16 h-16 rounded-full bg-[#FCEBEB] border-2 border-[#E24B4A] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#E24B4A]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-[18px] font-medium text-[#222222]">驗證失敗</h3>
        <p className="text-[13px] text-[#717171] mt-1 text-center">{errorMsg || '發生未知錯誤，請重新嘗試。'}</p>
      </div>
      <Link href="/login" className="block w-full text-center border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-10 rounded-lg text-sm transition-colors">
        返回登入
      </Link>
    </div>
  )
}

export default function EmailVerifiedPage() {
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
            <Suspense fallback={<div className="text-center py-8 text-[#717171]">載入中...</div>}>
              <EmailVerifiedContent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
