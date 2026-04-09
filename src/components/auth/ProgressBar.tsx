'use client'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  labels?: string[]
}

const DEFAULT_LABELS = ['身份選擇', '基本資料', '車輛資料', '文件上傳', '完成設定']

export function ProgressBar({ currentStep, totalSteps, labels = DEFAULT_LABELS }: ProgressBarProps) {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting lines */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#DDDDDD] -z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-[#22C55E] -z-0 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />

        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          const isFuture = step > currentStep

          return (
            <div key={step} className="flex flex-col items-center z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  isCompleted
                    ? 'bg-[#22C55E] border-[#22C55E] text-white'
                    : isCurrent
                    ? 'bg-[#FF385C] border-[#FF385C] text-white'
                    : 'bg-white border-[#DDDDDD] text-[#B0B0B0]'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={`mt-2 text-[11px] text-center leading-tight ${
                  isCurrent ? 'text-[#222222] font-medium' : isFuture ? 'text-[#B0B0B0]' : 'text-[#717171]'
                }`}
              >
                {labels[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
