import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

type ProgressStep = 'start' | 'arrive' | 'pickup' | 'complete'
type CurrentStatus = 'ACCEPTED' | 'IN_PROGRESS' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED'

const STEPS: { key: ProgressStep; label: string; num: number }[] = [
  { key: 'start', label: '開始', num: 1 },
  { key: 'arrive', label: '抵達', num: 2 },
  { key: 'pickup', label: '客上', num: 3 },
  { key: 'complete', label: '客下', num: 4 },
]

function statusToStepIndex(status: CurrentStatus): number {
  const order: ProgressStep[] = ['start', 'arrive', 'pickup', 'complete']
  const map: Record<string, ProgressStep> = {
    ACCEPTED: 'start',
    IN_PROGRESS: 'start',
    ARRIVED: 'arrive',
    PICKED_UP: 'pickup',
    COMPLETED: 'complete',
  }
  return order.indexOf(map[status] ?? 'start')
}

function isStepLit(currentStatus: CurrentStatus, step: ProgressStep): boolean {
  const order: ProgressStep[] = ['start', 'arrive', 'pickup', 'complete']
  const currentIndex = statusToStepIndex(currentStatus)
  const stepIndex = order.indexOf(step)
  if (currentStatus === 'COMPLETED') return true
  return stepIndex <= currentIndex && currentIndex >= 0
}

function isStepNext(currentStatus: CurrentStatus, step: ProgressStep): boolean {
  const order: ProgressStep[] = ['start', 'arrive', 'pickup', 'complete']
  const currentIndex = statusToStepIndex(currentStatus)
  const stepIndex = order.indexOf(step)
  return stepIndex === currentIndex + 1
}

function isLitNext(step: ProgressStep | undefined, currentStatus: CurrentStatus): boolean {
  if (!step) return false
  return isStepLit(currentStatus, step)
}

interface ProgressBarProps {
  status: string
  size?: 'sm' | 'md'
  showLabel?: boolean
  animateNext?: boolean
}

export function ProgressBar({ status, size = 'md', showLabel = true, animateNext = false }: ProgressBarProps) {
  const currentStatus = (status === 'ACCEPTED' || status === 'IN_PROGRESS' || status === 'ARRIVED' || status === 'PICKED_UP' || status === 'COMPLETED')
    ? status
    : 'ACCEPTED'

  const dotSize = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-[11px]'

  return (
    <div className="flex items-center justify-center w-full">
      {STEPS.map((step, i) => {
        const lit = isStepLit(currentStatus, step.key)
        const next = animateNext && isStepNext(currentStatus, step.key)
        const completed = currentStatus === 'COMPLETED'
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              {/* Dot with number or check */}
              <div
                className={cn(
                  'rounded-full flex-shrink-0 transition-all duration-300 flex items-center justify-center',
                  dotSize,
                  lit
                    ? 'bg-[#0C447C] text-white'
                    : 'bg-[#EEEEEE] text-[#AAAAAA]',
                  next && 'animate-pulse ring-2 ring-[#0C447C]/40'
                )}
              >
                {completed && lit ? (
                  <Check className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
                ) : (
                  <span className={cn('font-bold', size === 'sm' ? 'text-[10px]' : 'text-[12px]')}>
                    {step.num}
                  </span>
                )}
              </div>
              {showLabel && (
                <span className={cn(textSize, 'font-medium', lit ? 'text-[#0C447C]' : 'text-[#AAAAAA]')}>
                  {step.label}
                </span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 mx-2 flex-shrink-0',
                  size === 'sm' ? 'h-px my-2' : 'h-0.5 my-2.5 rounded',
                  isLitNext(STEPS[i + 1]?.key, currentStatus) ? 'bg-[#0C447C]' : 'bg-[#EEEEEE]'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
