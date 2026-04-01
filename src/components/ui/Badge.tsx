import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info"
}

function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-[#141418] text-[#f0ebe3] border-[#1e1e26]",
    success: "bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30",
    warning: "bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30",
    danger: "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30",
    info: "bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border",
        variants[variant],
        className
      )}
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
  const statusMap: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    PENDING: { label: "待接單", variant: "warning" },
    PUBLISHED: { label: "待接單", variant: "success" },
    ASSIGNED: { label: "已指派", variant: "info" },
    ACCEPTED: { label: "已接單", variant: "info" },
    ARRIVED: { label: "已抵達", variant: "info" },
    IN_PROGRESS: { label: "進行中", variant: "success" },
    COMPLETED: { label: "已完成", variant: "success" },
    CANCELLED: { label: "已取消", variant: "danger" },
  }

  const config = statusMap[status] || { label: status, variant: "default" as const }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Driver status badge
interface DriverStatusBadgeProps {
  status: string
}

function DriverStatusBadge({ status }: DriverStatusBadgeProps) {
  const statusMap: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    ONLINE: { label: "在線", variant: "success" },
    OFFLINE: { label: "離線", variant: "default" },
    BUSY: { label: "忙碌中", variant: "warning" },
  }

  const config = statusMap[status] || { label: status, variant: "default" as const }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

export { Badge, OrderStatusBadge, DriverStatusBadge }
