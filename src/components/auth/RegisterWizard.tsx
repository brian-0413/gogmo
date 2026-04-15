'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plane } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { RegisterStep1 } from './RegisterStep1'
import { RegisterStep2, type Step2Data } from './RegisterStep2'
import { RegisterStep3, type Step3Data } from './RegisterStep3'
import { RegisterStep4Bank, type Step4BankData } from './RegisterStep4Bank'
import { RegisterStep5, type UploadedFile } from './RegisterStep5'
import { RegisterStep6, type Step6Data } from './RegisterStep6'

export function RegisterWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [role, setRole] = useState<'DRIVER' | 'DISPATCHER' | null>(null)
  const [step2Data, setStep2Data] = useState<Step2Data>({
    name: '',
    phone: '',
    email: '',
    companyName: '',
    taxId: '',
    contactPhone: '',
  })
  const [step3Data, setStep3Data] = useState<Step3Data>({
    licensePlate: '',
    carBrand: '',
    carModel: '',
    carColor: '',
    vehicleSize: '',
  })
  const [step4BankData, setStep4BankData] = useState<Step4BankData>({
    bankCode: '',
    bankAccount: '',
  })
  const [step5Files, setStep5Files] = useState<UploadedFile[]>([])
  const [step6Data, setStep6Data] = useState<Step6Data>({
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // 統一 6 步流程，Step 3/4 對派單方顯示文件上傳/密碼
  const totalSteps = 6
  const driverLabels = ['身份選擇', '基本資料', '車輛資料', '銀行資料', '文件上傳', '密碼設定']
  const dispatcherLabels = ['身份選擇', '基本資料', '文件上傳', '密碼設定', '', '']
  const progressLabels = role === 'DISPATCHER' ? dispatcherLabels : driverLabels

  const handleRoleSelect = (selectedRole: 'DRIVER' | 'DISPATCHER') => {
    setRole(selectedRole)
    setStep5Files([])
    setStep(2)
  }

  const handleStep2Next = () => setStep(3)

  const handleStep3Next = () => setStep(4)

  const handleStep4BankNext = () => setStep(5)
  const handleStep5Next = () => setStep(6)

  const handleBack = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) setStep(role === 'DISPATCHER' ? 3 : 3)
    else if (step === 5) setStep(role === 'DISPATCHER' ? 3 : 4)
    else if (step === 6) setStep(role === 'DISPATCHER' ? 3 : 5)
  }

  const handleSubmit = async () => {
    if (!role) return
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('email', step2Data.email)
      fd.append('password', step6Data.password)
      fd.append('name', step2Data.name)
      fd.append('phone', step2Data.phone)
      fd.append('role', role)
      if (role === 'DRIVER') {
        fd.append('licensePlate', step3Data.licensePlate)
        fd.append('carType', step3Data.vehicleSize || '轎車')
        fd.append('carColor', step3Data.carColor)
        fd.append('carBrand', step3Data.carBrand)
        fd.append('carModel', step3Data.carModel)
        fd.append('bankCode', step4BankData.bankCode)
        fd.append('bankAccount', step4BankData.bankAccount)
      } else {
        fd.append('name', step2Data.name)
        fd.append('phone', step2Data.phone)
        fd.append('companyName', step2Data.companyName || '')
        fd.append('taxId', step2Data.taxId || '')
        fd.append('contactPhone', step2Data.contactPhone || '')
      }
      for (const { type, file } of step5Files) {
        fd.append(type, file)
      }
      const res = await fetch('/api/auth', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '註冊失敗')
        setSubmitting(false)
        return
      }
      setSuccess(true)
    } catch { setError('網路錯誤') }
    setSubmitting(false)
  }

  if (success) {
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
            <div className="bg-white border border-[#DDDDDD] rounded-xl p-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#E8F5E9] border-2 border-[#4CAF50] flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#4CAF50]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-[20px] font-medium text-[#222222]">註冊成功！</h3>
                <p className="text-[13px] text-[#717171] text-center leading-relaxed">
                  請至 Email 收取驗證連結，<br />完成帳號驗證
                </p>
                <Link href="/login" className="mt-2 w-full text-center bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors">
                  前往登入
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      <nav className="px-6 py-4 bg-[#FAF8F5]">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#222222] font-medium">機場接送派單平台</span>
          </Link>
          <Link href="/login" className="text-[13px] text-[#717171] hover:text-[#222222] transition-colors">
            已有帳戶？
          </Link>
        </div>
      </nav>

      <div className="flex items-center justify-center px-6 py-4">
        <div className="w-full max-w-md">
          <ProgressBar currentStep={step} totalSteps={totalSteps} labels={progressLabels} />

          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6 mt-2">
            {error && (
              <div className="mb-4 bg-[#FCEBEB] border border-[#F5C6C6] text-[#E24B4A] px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            {step === 1 && <RegisterStep1 onSelect={handleRoleSelect} />}
            {step === 2 && role && (
              <RegisterStep2
                role={role}
                data={step2Data}
                onChange={setStep2Data}
                onNext={handleStep2Next}
              />
            )}
            {step === 3 && role === 'DRIVER' && (
              <RegisterStep3
                data={step3Data}
                onChange={setStep3Data}
                onNext={handleStep3Next}
                onBack={handleBack}
              />
            )}
            {step === 3 && role === 'DISPATCHER' && (
              <RegisterStep5
                role={role}
                uploadedFiles={step5Files}
                onChange={setStep5Files}
                onNext={handleStep5Next}
                onBack={handleBack}
              />
            )}
            {step === 4 && role === 'DRIVER' && (
              <RegisterStep4Bank
                data={step4BankData}
                onChange={setStep4BankData}
                onNext={handleStep4BankNext}
                onBack={handleBack}
              />
            )}
            {step === 5 && role === 'DRIVER' && (
              <RegisterStep5
                role={role}
                uploadedFiles={step5Files}
                onChange={setStep5Files}
                onNext={handleStep5Next}
                onBack={handleBack}
              />
            )}
            {step === 6 && (
              <RegisterStep6
                data={step6Data}
                onChange={setStep6Data}
                onSubmit={handleSubmit}
                onBack={handleBack}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}