'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Order {
  id: string
  status: string
  passengerName: string
  passengerPhone: string
  flightNumber: string
  pickupLocation: string
  pickupAddress: string
  dropoffLocation: string
  dropoffAddress: string
  passengerCount: number
  luggageCount: number
  scheduledTime: string
  price: number
  note?: string
  dispatcher?: {
    companyName: string
  }
}

interface OrderCardProps {
  order: Order
  onAccept?: (orderId: string) => void
  onView?: (orderId: string) => void
  showActions?: boolean
  compact?: boolean
}

function OrderCard({ order, onAccept, onView, showActions = true, compact = false }: OrderCardProps) {
  const scheduledDate = parseISO(order.scheduledTime)

  return (
    <Card className="card-hover" variant="elevated">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-600">
              NT${order.price}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <span className="text-xs text-slate-500">
            #{order.id.slice(0, 8)}
          </span>
        </div>

        {/* Flight Info */}
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="bg-slate-100 px-2 py-1 rounded font-mono">
            {order.flightNumber}
          </span>
          <span className="text-slate-600">
            {format(scheduledDate, 'MM/dd (E)', { locale: zhTW })} • {format(scheduledDate, 'HH:mm')}
          </span>
        </div>

        {/* Locations */}
        <div className="space-y-2 mb-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {order.pickupLocation}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {order.pickupAddress}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 mt-2" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {order.dropoffLocation}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {order.dropoffAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Passenger Info */}
        <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
          <span>👤 {order.passengerName}</span>
          <span>📦 {order.passengerCount}人 / {order.luggageCount}行李</span>
        </div>

        {/* Note */}
        {order.note && (
          <div className="text-xs text-slate-500 italic mb-3 bg-slate-50 p-2 rounded">
            📝 {order.note}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(order.id)}
                className="flex-1"
              >
                查看詳情
              </Button>
            )}
            {onAccept && order.status === 'PENDING' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onAccept(order.id)}
                className="flex-1"
              >
                立即接單
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { OrderCard }
export type { Order }
