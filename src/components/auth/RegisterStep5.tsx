'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export interface Step5Data {
  password: string
  confirmPassword: string
  agreedToTerms: boolean
}

interface RegisterStep5Props {
  data: Step5Data
  onChange: (data: Step5Data) => void
  onSubmit: () => Promise<void>
  onBack: () => void
}

export function RegisterStep5({ data, onChange, onSubmit, onBack }: RegisterStep5Props) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset loading when data changes (e.g. user goes back and returns)
  useEffect(() => { setLoading(false) }, [])

  const passwordError = data.password.length > 0 && data.password.length < 6 ? '密碼至少 6 個字元' : ''
  const confirmError = data.confirmPassword.length > 0 && data.password !== data.confirmPassword ? '兩次密碼不符' : ''
  const canSubmit = data.password.length >= 6 && data.password === data.confirmPassword && data.agreedToTerms && !loading

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await onSubmit()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '提交失敗')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-medium text-[#222222] text-center">設定密碼</h2>
      <p className="text-[13px] text-[#717171] text-center">最後一步，設定您的登入密碼</p>

      {error && <div className="bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="space-y-3 pt-2">
        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">密碼</label>
          <input
            type="password"
            value={data.password}
            onChange={e => onChange({ ...data, password: e.target.value })}
            placeholder="至少 6 個字元"
            className={`w-full bg-white border rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none ${
              passwordError ? 'border-[#E24B4A]' : 'border-[#DDDDDD] focus:border-[#222222]'
            }`}
          />
          {passwordError && <span className="text-[11px] text-[#E24B4A]">{passwordError}</span>}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">確認密碼</label>
          <input
            type="password"
            value={data.confirmPassword}
            onChange={e => onChange({ ...data, confirmPassword: e.target.value })}
            placeholder="再次輸入密碼"
            className={`w-full bg-white border rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none ${
              confirmError ? 'border-[#E24B4A]' : 'border-[#DDDDDD] focus:border-[#222222]'
            }`}
          />
          {confirmError && <span className="text-[11px] text-[#E24B4A]">{confirmError}</span>}
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-2 pt-1">
          <input
            type="checkbox"
            id="terms"
            checked={data.agreedToTerms}
            onChange={e => onChange({ ...data, agreedToTerms: e.target.checked })}
            className="mt-0.5 w-4 h-4 rounded border-[#DDDDDD] text-[#FF385C] focus:ring-[#FF385C]"
          />
          <label htmlFor="terms" className="text-[12px] text-[#717171] leading-snug">
            我已閱讀並同意
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#FF385C] hover:text-[#D70466] mx-0.5">
              服務條款
            </a>
            與
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#FF385C] hover:text-[#D70466] mx-0.5">
              隱私權政策
            </a>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-11 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          上一步
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          {loading ? '提交中...' : '完成註冊'}
        </button>
      </div>
    </div>
  )
}
