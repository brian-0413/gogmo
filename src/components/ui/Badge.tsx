import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple"
}

function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-[#F7F7F7] text-[#717171] border border-[#DDDDDD]",
    success: "bg-[#E8F5E8] text-[#008A05] border border-[#C8E6C8]",
    warning: "bg-[#FFF3E0] text-[#B45309] border border-[#FFE0B2]",
    danger: "bg-[#FCEBEB] text-[#A32D2D] border border-[#F5C6C6]",
    info: "bg-[#E6F1FB] text-[#0C447C] border border-[#C2DBF5]",
    purple: "bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D5FF]",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

interface OrderStatusBadgeProps {
  status: string
}

function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const statusMap: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    PENDING: { label: "待接單", variant: "danger" },
    PUBLISHED: { label: "待接單", variant: "danger" },
    ASSIGNED: { label: "已指派", variant: "warning" },
    ACCEPTED: { label: "已接單", variant: "warning" },
    ARRIVED: { label: "已抵達", variant: "info" },
    IN_PROGRESS: { label: "進行中", variant: "info" },
    COMPLETED: { label: "已完成", variant: "success" },
    CANCELLED: { label: "已取消", variant: "danger" },
  }

  const config = statusMap[status] || { label: status, variant: "default" as const }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

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
