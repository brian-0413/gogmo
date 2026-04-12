'use client'
import { BANK_OPTIONS } from '@/lib/bank-codes'

export interface Step4BankData {
  bankCode: string
  bankAccount: string
}

interface RegisterStep4BankProps {
  data: Step4BankData
  onChange: (data: Step4BankData) => void
  onNext: () => void
  onBack: () => void
}

export function RegisterStep4Bank({ data, onChange, onNext, onBack }: RegisterStep4BankProps) {
  const canProceed = data.bankCode.trim() !== '' && data.bankAccount.trim().length >= 10

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-medium text-[#222222] text-center">填寫銀行帳號</h2>
      <p className="text-[13px] text-[#717171] text-center">做為收款用，請填寫真實帳號</p>

      <div className="space-y-3 pt-2">
        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">
            銀行代碼<span className="text-[#E24B4A] ml-0.5">*</span>
          </label>
          <select
            value={data.bankCode}
            onChange={e => onChange({ ...data, bankCode: e.target.value })}
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222]"
          >
            <option value="">請選擇銀行</option>
            {BANK_OPTIONS.map(bank => (
              <option key={bank.code} value={bank.code}>
                {bank.code} {bank.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">
            銀行帳號<span className="text-[#E24B4A] ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={data.bankAccount}
            onChange={e => {
              // 純數字，去除前置零
              const raw = e.target.value.replace(/\D/g, '')
              const normalized = raw.replace(/^0+/, '') || ''
              onChange({ ...data, bankAccount: normalized })
            }}
            placeholder="請輸入帳號（至少 10 碼）"
            maxLength={16}
            inputMode="numeric"
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] font-mono-nums"
          />
          <span className="text-[10px] text-[#B0B0B0]">請輸入數字，前置零將自動去除</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-11 rounded-lg text-sm transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          下一步
        </button>
      </div>
    </div>
  )
}