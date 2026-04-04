'use client'

import { Button } from '@/components/ui/Button'
import { X, Play, MapPin, Users, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type ActionType = 'start' | 'arrive' | 'pickup' | 'complete'

interface OrderDetailActionsProps {
  status: string
  scheduledTime: Date | string
  onAction: (action: ActionType) => void
  onCancel: () => void
  loading?: boolean
}

function getHoursUntilScheduled(scheduledTime: Date | string): number {
  const now = new Date()
  const scheduled = new Date(scheduledTime)
  return (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60)
}

function getAvailableActions(status: string, hoursUntil: number): ActionType[] {
  if (status === 'ACCEPTED') {
    if (hoursUntil < 3) return ['start']
    return []
  }
  if (status === 'IN_PROGRESS') return ['arrive']
  if (status === 'ARRIVED') return ['pickup']
  if (status === 'PICKED_UP') return ['complete']
  return []
}

const ACTION_CONFIG: Record<ActionType, { label: string; icon: React.ReactNode; className: string }> = {
  start: {
    label: '開始',
    icon: <Play className="w-4 h-4" />,
    className: 'bg-[#0C447C] text-white hover:bg-[#0a3a6e]',
  },
  arrive: {
    label: '抵達',
    icon: <MapPin className="w-4 h-4" />,
    className: 'bg-[#0C447C] text-white hover:bg-[#0a3a6e]',
  },
  pickup: {
    label: '客上',
    icon: <Users className="w-4 h-4" />,
    className: 'bg-[#0C447C] text-white hover:bg-[#0a3a6e]',
  },
  complete: {
    label: '客下',
    icon: <Check className="w-4 h-4" />,
    className: 'bg-[#008A05] text-white hover:bg-[#006d04]',
  },
}

export function OrderDetailActions({
  status,
  scheduledTime,
  onAction,
  onCancel,
  loading = false,
}: OrderDetailActionsProps) {
  const hoursUntil = getHoursUntilScheduled(scheduledTime)
  const canCancel = status === 'ACCEPTED' && hoursUntil >= 3
  const availableActions = getAvailableActions(status, hoursUntil)

  const allActions: ActionType[] = ['start', 'arrive', 'pickup', 'complete']

  return (
    <div className="space-y-3 pt-4 border-t border-[#EBEBEB]">
      {/* 退單按鈕 */}
      {canCancel && (
        <div className="mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full border-[#E24B4A] text-[#E24B4A] hover:bg-[#FCEBEB] disabled:opacity-40"
            disabled={loading}
          >
            <X className="w-4 h-4 mr-1" />
            取消退單
          </Button>
        </div>
      )}

      {/* 4鍵按鈕列 */}
      <div className="grid grid-cols-2 gap-2">
        {allActions.map(action => {
          const config = ACTION_CONFIG[action]
          const isAvailable = availableActions.includes(action)
          return (
            <button
              key={action}
              onClick={() => isAvailable && onAction(action)}
              disabled={!isAvailable || loading}
              className={cn(
                'flex items-center justify-center gap-2 font-bold py-3 px-4 text-[14px] rounded-lg transition-all duration-200',
                config.className,
                !isAvailable && 'bg-[#EEEEEE] text-[#AAAAAA] cursor-not-allowed hover:bg-[#EEEEEE]',
                (loading || !isAvailable) && 'opacity-50 pointer-events-none'
              )}
            >
              {config.icon}
              {config.label}
            </button>
          )
        })}
      </div>

      {/* 提示文字 */}
      {status === 'ACCEPTED' && hoursUntil >= 3 && (
        <p className="text-center text-[12px] text-[#717171]">
          行程時間尚未接近，請在出發前 3 小時內再試
        </p>
      )}
    </div>
  )
}
