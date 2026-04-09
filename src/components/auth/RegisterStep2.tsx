'use client'
import { useState } from 'react'

export interface Step2Data {
  name: string
  phone: string
  email: string
  companyName?: string
  taxId?: string
  contactPhone?: string
}

interface RegisterStep2Props {
  role: 'DRIVER' | 'DISPATCHER'
  data: Step2Data
  onChange: (data: Step2Data) => void
  onNext: () => void
}

export function RegisterStep2({ role, data, onChange, onNext }: RegisterStep2Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (role === 'DRIVER') {
      if (!data.name.trim()) newErrors.name = '請填寫姓名'
      if (!data.phone.trim()) newErrors.phone = '請填寫手機號碼'
      if (!data.email.trim()) newErrors.email = '請填寫 Email'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) newErrors.email = 'Email 格式不正確'
    } else {
      if (!data.companyName?.trim()) newErrors.companyName = '請填寫公司名稱'
      if (!data.contactPhone?.trim()) newErrors.contactPhone = '請填寫聯絡電話'
      if (!data.email.trim()) newErrors.email = '請填寫 Email'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) newErrors.email = 'Email 格式不正確'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) onNext()
  }

  const field = (key: keyof Step2Data, label: string, type = 'text', placeholder = '') => (
    <div className="space-y-1" key={key}>
      <label className="text-[11px] text-[#717171] font-normal">{label}</label>
      <input
        type={type}
        value={(data[key] as string) || ''}
        onChange={e => onChange({ ...data, [key]: e.target.value })}
        placeholder={placeholder}
        className={`w-full bg-white border rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none ${
          errors[key] ? 'border-[#E24B4A]' : 'border-[#DDDDDD] focus:border-[#222222]'
        }`}
      />
      {errors[key] && <span className="text-[11px] text-[#E24B4A]">{errors[key]}</span>}
    </div>
  )

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-medium text-[#222222] text-center">填寫基本資料</h2>
      <p className="text-[13px] text-[#717171] text-center">
        {role === 'DRIVER' ? '請填寫您的個人資訊' : '請填寫公司基本資訊'}
      </p>

      <div className="space-y-3 pt-2">
        {role === 'DRIVER' ? (
          <>
            {field('name', '姓名', 'text', '請輸入姓名')}
            {field('phone', '手機號碼', 'tel', '09xx-xxx-xxx')}
            {field('email', 'Email', 'email', '請輸入 Email')}
          </>
        ) : (
          <>
            {field('companyName', '公司名稱', 'text', '請輸入公司或車隊名稱')}
            {field('contactPhone', '聯絡電話', 'tel', '例：02-xxxx-xxxx')}
            {field('email', 'Email', 'email', '請輸入 Email')}
            <div className="space-y-1">
              <label className="text-[11px] text-[#717171] font-normal">統一編號（選填）</label>
              <input
                type="text"
                value={data.taxId || ''}
                onChange={e => onChange({ ...data, taxId: e.target.value })}
                placeholder="8碼"
                maxLength={8}
                className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
              />
            </div>
          </>
        )}
      </div>

      <button
        onClick={handleNext}
        className="w-full bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors"
      >
        下一步
      </button>
    </div>
  )
}
