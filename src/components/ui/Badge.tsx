import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

// Order status badge
interface OrderStatusBadgeProps {
  status: string
}

function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const statusMap: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    PENDING: { label: '待審核', variant: 'warning' },
    PUBLISHED: { label: '已發布', variant: 'success' },
    ASSIGNED: { label: '已指派', variant: 'info' },
    ACCEPTED: { label: '已接單', variant: 'info' },
    ARRIVED: { label: '已抵達', variant: 'info' },
    IN_PROGRESS: { label: '進行中', variant: 'success' },
    COMPLETED: { label: '已完成', variant: 'success' },
    CANCELLED: { label: '已取消', variant: 'danger' },
  }

  const config = statusMap[status] || { label: status, variant: 'default' as const }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Driver status badge
interface DriverStatusBadgeProps {
  status: string
}

function DriverStatusBadge({ status }: DriverStatusBadgeProps) {
  const statusMap: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    ONLINE: { label: '在線', variant: 'success' },
    OFFLINE: { label: '離線', variant: 'default' },
    BUSY: { label: '忙碌中', variant: 'warning' },
  }

  const config = statusMap[status] || { label: status, variant: 'default' as const }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

export { Badge, OrderStatusBadge, DriverStatusBadge }
