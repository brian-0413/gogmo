import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

type ProgressStep = 'start' | 'arrive' | 'pickup' | 'complete'

const STEPS: { key: ProgressStep; label: string; num: number }[] = [
  { key: 'start', label: '開始', num: 1 },
  { key: 'arrive', label: '抵達', num: 2 },
  { key: 'pickup', label: '客上', num: 3 },
  { key: 'complete', label: '客下', num: 4 },
]

interface TripProgressTrackerProps {
  currentStep: number // -1 = not started, 0-3 = step index
  onAdvance: () => void
}

export function TripProgressTracker({ currentStep, onAdvance }: TripProgressTrackerProps) {
  const completed = currentStep >= 3

  return (
    <div className="bg-[#FFF9F0] border border-[#FFE0B2] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-[#92400E]">行程進度</h3>
        {completed && (
          <span className="text-[12px] font-bold text-[#059669] bg-[#D1FAE5] px-2 py-1 rounded">
            行程已完成
          </span>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center w-full">
        {STEPS.map((step, i) => {
          const lit = currentStep >= i
          const isNext = currentStep === i - 1
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className={cn(
                    'rounded-full flex-shrink-0 transition-all duration-300 flex items-center justify-center w-8 h-8',
                    lit
                      ? 'bg-[#0C447C] text-white'
                      : 'bg-[#EEEEEE] text-[#AAAAAA]',
                    isNext && 'animate-pulse ring-2 ring-[#0C447C]/40'
                  )}
                >
                  {completed ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-[12px] font-bold">{step.num}</span>
                  )}
                </div>
                <span className={cn('text-[11px] font-medium', lit ? 'text-[#0C447C]' : 'text-[#AAAAAA]')}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 mx-2 h-0.5 rounded',
                    currentStep >= i + 1 ? 'bg-[#0C447C]' : 'bg-[#EEEEEE]'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Advance Button */}
      {!completed && currentStep >= 0 && (
        <div className="mt-4">
          <button
            onClick={onAdvance}
            className="w-full py-2.5 bg-[#0C447C] text-white text-[14px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors"
          >
            確認 {STEPS[currentStep + 1]?.label}
          </button>
        </div>
      )}

      {/* Start Button */}
      {currentStep < 0 && (
        <div className="mt-4">
          <button
            onClick={onAdvance}
            className="w-full py-2.5 bg-[#0C447C] text-white text-[14px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors"
          >
            開始行程
          </button>
        </div>
      )}
    </div>
  )
}