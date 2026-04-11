'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plane } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { RegisterStep1 } from './RegisterStep1'
import { RegisterStep2, type Step2Data } from './RegisterStep2'
import { RegisterStep3, type Step3Data } from './RegisterStep3'
import { RegisterStep4, type UploadedFile } from './RegisterStep4'
import { RegisterStep5, type Step5Data } from './RegisterStep5'

export function RegisterWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
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
  const [step5Data, setStep5Data] = useState<Step5Data>({
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  })
  const [step4Files, setStep4Files] = useState<UploadedFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleRoleSelect = (selectedRole: 'DRIVER' | 'DISPATCHER') => {
    setRole(selectedRole)
    setStep4Files([])
    setStep(2)
  }

  const handleStep2Next = () => setStep(3)
  const handleStep3Next = () => setStep(4)
  const handleStep4Next = () => setStep(5)
  const handleBack = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) {
      setStep4Files([])
      setStep(role === 'DISPATCHER' ? 2 : 3)
    }
    else if (step === 5) setStep(4)
  }

  const handleSubmit = async () => {
    if (!role) return
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('email', step2Data.email)
      fd.append('password', step5Data.password)
      fd.append('name', step2Data.name)
      fd.append('phone', step2Data.phone)
      fd.append('role', role)
      if (role === 'DRIVER') {
        fd.append('licensePlate', step3Data.licensePlate)
        fd.append('carType', step3Data.vehicleSize || '轎車')
        fd.append('carColor', step3Data.carColor)
        fd.append('carBrand', step3Data.carBrand)
        fd.append('carModel', step3Data.carModel)
      } else {
        fd.append('companyName', step2Data.companyName || '')
        fd.append('taxId', step2Data.taxId || '')
        fd.append('contactPhone', step2Data.contactPhone || '')
      }
      // Append uploaded files so auth route handles Drive upload directly
      for (const { type, file } of step4Files) {
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
          <ProgressBar currentStep={step} totalSteps={5} />

          <div className="bg-white border border-[#DDDDDD] rounded-xl p-6 mt-2">
            {step === 1 && <RegisterStep1 onSelect={handleRoleSelect} />}
            {step === 2 && role && (
              <RegisterStep2
                role={role}
                data={step2Data}
                onChange={setStep2Data}
                onNext={handleStep2Next}
              />
            )}
            {step === 3 && (
              <RegisterStep3
                data={step3Data}
                onChange={setStep3Data}
                onNext={handleStep3Next}
                onBack={handleBack}
              />
            )}
            {step === 4 && role && (
              <RegisterStep4
                role={role}
                uploadedFiles={step4Files}
                onChange={setStep4Files}
                onNext={handleStep4Next}
                onBack={handleBack}
              />
            )}
            {step === 5 && (
              <RegisterStep5
                data={step5Data}
                onChange={setStep5Data}
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
