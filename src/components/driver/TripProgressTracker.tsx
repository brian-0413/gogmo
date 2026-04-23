'use client'

import { Check } from 'lucide-react'

interface TripProgressTrackerProps {
  currentStep: number // -1=未開始, 0=start, 1=arrive, 2=onboard, 3=done
  onAdvance: () => void
}

const STEPS = [
  { label: '開始', color: '#2A6FAF' },
  { label: '抵達', color: '#B45309' },
  { label: '客上', color: '#FF385C' },
  { label: '客下', color: '#008A05' },
]

const BUTTON_LABELS = [
  '開始　前往上車地點',
  '抵達　回報已抵達',
  '客上　確認乘客上車',
  '客下　確認乘客下车',
]

export default function TripProgressTracker({ currentStep, onAdvance }: TripProgressTrackerProps) {
  const isCompleted = currentStep >= 3
  const isNotStarted = currentStep < 0
  const activeStep = isCompleted ? 3 : Math.max(0, currentStep)

  return (
    <div className="w-full">
      {/* Step dots + lines */}
      <div className="flex items-center mb-3">
        {STEPS.map((step, index) => {
          const isDone = activeStep > index
          const isCurrent = activeStep === index && !isCompleted

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              {/* Dot */}
              <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full"
                style={{
                  backgroundColor: isDone || isCurrent ? step.color : '#E5E5E5',
                  color: isDone ? '#fff' : isCurrent ? '#fff' : '#717171',
                }}
              >
                {isDone ? (
                  <Check size={16} strokeWidth={3} />
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>

              {/* Line to next dot */}
              {index < STEPS.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-1"
                  style={{
                    backgroundColor: activeStep > index ? step.color : '#E5E5E5',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step labels */}
      <div className="flex items-center mb-4">
        {STEPS.map((step, index) => {
          const isDone = activeStep > index
          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <span
                className="text-[10px] font-bold text-center w-8"
                style={{ color: isDone ? step.color : '#717171' }}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && <div className="flex-1 mx-1" />}
            </div>
          )
        })}
      </div>

      {/* Action button */}
      {isCompleted ? (
        <div className="w-full py-3 text-center text-white text-sm font-bold rounded-lg bg-[#008A05]">
          行程已完成
        </div>
      ) : (
        <button
          onClick={onAdvance}
          className="w-full py-3 text-white text-sm font-bold rounded-lg transition-colors"
          style={{ backgroundColor: STEPS[activeStep].color }}
        >
          {isNotStarted ? '開始行程' : BUTTON_LABELS[activeStep]}
        </button>
      )}
    </div>
  )
}
