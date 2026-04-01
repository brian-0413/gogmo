import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { format, parseISO, differenceInMinutes } from "date-fns"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import {
  Plane,
  MapPin,
  Clock,
  Car,
  Users,
  Wallet,
  ArrowRight,
  ChevronRight,
  Zap,
  TrendingUp,
  Eye,
  UserCheck,
} from "lucide-react"
import { FlipboardGrid } from "@/components/FlipboardGrid"
import { LiveTicker } from "@/components/LiveTicker"
import { DriverStatusCarousel } from "@/components/DriverStatusCarousel"

// Fetch published orders
async function getPublishedOrders() {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: "PUBLISHED",
      },
      orderBy: {
        scheduledTime: "asc",
      },
      take: 100,
    })
    return orders
  } catch (error) {
    console.error("Failed to fetch orders:", error)
    return []
  }
}

// Fetch stats
async function getStats() {
  try {
    const [totalOrders, drivers] = await Promise.all([
      prisma.order.count({ where: { status: "PUBLISHED" } }),
      prisma.driver.count(),
    ])

    // Published orders for display
    const publishedOrders: { pickupLocation: string; price: number; scheduledTime: Date }[] = await prisma.order.findMany({
      where: { status: "PUBLISHED" },
      select: { pickupLocation: true, price: true, scheduledTime: true },
    })

    // All orders for total amount calculation
    const allOrders: { price: number }[] = await prisma.order.findMany({
      select: { price: true },
    })

    // Today's completed orders
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCompleted = await prisma.order.count({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: today },
      },
    })

    const now = new Date()
    const recentOrders = publishedOrders.filter(o => {
      const time = typeof o.scheduledTime === 'string' ? parseISO(o.scheduledTime) : o.scheduledTime
      const diff = differenceInMinutes(time, now)
      return diff > 0 && diff <= 60
    })

    const pickupCount = publishedOrders.filter(o =>
      o.pickupLocation.includes("桃園機場") || o.pickupLocation.includes("機場")
    ).length

    // Sum ALL orders' prices
    const totalAmount = allOrders.reduce((sum, o) => sum + o.price, 0)

    return {
      pickupCount,
      dropoffCount: publishedOrders.length - pickupCount,
      driverCount: drivers,
      totalAmount,
      recentCount: recentOrders.length,
      todayCompleted,
    }
  } catch (error) {
    console.error("Failed to fetch stats:", error)
    return {
      pickupCount: 0,
      dropoffCount: 0,
      driverCount: 0,
      totalAmount: 0,
      recentCount: 0,
      todayCompleted: 0,
    }
  }
}

// Determine order type
function getOrderType(pickupLocation: string, dropoffLocation: string): "pickup" | "dropoff" {
  if (pickupLocation.includes("桃園機場") || pickupLocation.includes("機場")) {
    return "pickup"
  }
  if (dropoffLocation.includes("桃園機場") || dropoffLocation.includes("機場")) {
    return "dropoff"
  }
  return "dropoff"
}

// Get time urgency level
function getTimeUrgency(scheduledTime: string | Date): "urgent" | "soon" | "normal" {
  const now = new Date()
  const time = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : new Date(scheduledTime)
  const diff = differenceInMinutes(time, now)
  if (diff <= 30) return "urgent"
  if (diff <= 60) return "soon"
  return "normal"
}

// Get card glow level based on price
function getPriceGlow(price: number): "high" | "medium" | "low" {
  if (price >= 1500) return "high"
  if (price >= 1000) return "medium"
  return "low"
}

// Format time
function formatTime(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === "string" ? parseISO(dateTime) : new Date(dateTime)
    return format(date, "HH:mm")
  } catch {
    return "--:--"
  }
}

// Format date for display
function formatDate(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === "string" ? parseISO(dateTime) : new Date(dateTime)
    return format(date, "M/d")
  } catch {
    return "--"
  }
}

export default async function Home() {
  const orders = await getPublishedOrders()
  const stats = await getStats()

  return (
    <div className="min-h-screen bg-[#060608] text-[#f0ebe3] selection:bg-[#ff6b2b]/30">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#ff6b2b]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#ff6b2b]/4 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060608]/80 backdrop-blur-xl border-b border-[#1e1e26]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-[#ff6b2b] flex items-center justify-center">
                <Plane className="w-4 h-4 text-[#060608]" />
              </div>
              <span className="text-[#ff6b2b] font-semibold tracking-tight">
                機場接送派單平台
              </span>
            </Link>

            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 text-xs text-[#22c55e]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                </span>
                {stats.driverCount} 司機在線
              </div>
              <Link
                href="/login"
                className="text-sm text-[#6b6560] hover:text-[#f0ebe3] transition-colors"
              >
                司機登入
              </Link>
              <Link
                href="/login"
                className="text-sm text-[#6b6560] hover:text-[#f0ebe3] transition-colors"
              >
                車頭登入
              </Link>
              <Link href="/register">
                <Button size="sm" variant="primary" className="font-medium">
                  立即註冊
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-6 relative">
        <div className="max-w-7xl mx-auto">
          {/* Live Ticker */}
          <LiveTicker todayCompleted={stats.todayCompleted} />

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#f0ebe3] tracking-tight mb-6 leading-[1.1]">
                機場接送
                <br />
                <span className="text-[#ff6b2b]">派單平台</span>
              </h1>

              <p className="text-xl text-[#6b6560] mb-8 max-w-lg">
                為台灣接送產業而生的智能派單系統，讓司機快速掌握接單機會
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button size="lg" variant="primary" className="w-full font-semibold gap-2">
                    立即加入司機行列
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/login" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full font-medium">
                    登入系統
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-[#ff6b2b]/20 to-[#ff6b2b]/5 border border-[#ff6b2b]/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-[#ff6b2b]" />
                  <span className="text-xs text-[#ff6b2b] uppercase tracking-wider">最新訂單</span>
                </div>
                <p className="text-3xl font-bold text-[#f0ebe3] mb-1">{stats.pickupCount + stats.dropoffCount}</p>
                <p className="text-xs text-[#6b6560]">筆可接訂單</p>
              </div>

              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-xs text-[#22c55e] uppercase tracking-wider">一小時內</span>
                </div>
                <p className="text-3xl font-bold text-[#f0ebe3] mb-1">{stats.recentCount}</p>
                <p className="text-xs text-[#6b6560]">筆新訂單</p>
              </div>

              <DriverStatusCarousel />

              <div className="bg-[#0c0c10] border border-[#1e1e26] rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-[#a855f7]" />
                  <span className="text-xs text-[#a855f7] uppercase tracking-wider">案件總額</span>
                </div>
                <p className="text-3xl font-bold text-[#f0ebe3] mb-1">NT${stats.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-[#6b6560]">元</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Orders Section */}
      <section className="py-12 px-6 relative">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-[#f0ebe3]">
                  即刻可接行程
                </h2>
                <span className="px-3 py-1 rounded-full bg-[#ff6b2b]/20 text-[#ff6b2b] text-sm font-medium border border-[#ff6b2b]/30">
                  {orders.length} 筆
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#22c55e]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                </span>
                即時更新中
              </div>
            </div>
            <Link
              href="/register"
              className="flex items-center gap-2 text-sm text-[#ff6b2b] hover:text-[#e85a1a] transition-colors"
            >
              查看完整清單
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Flipboard Grid */}
          <FlipboardGrid orders={orders} gridSize={20} />

          {/* View More */}
          {orders.length > 20 && (
            <div className="mt-8 text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm text-[#6b6560] hover:text-[#ff6b2b] transition-colors"
              >
                查看全部 {orders.length} 筆訂單
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#f0ebe3] mb-4">
            準備好加入了嗎？
          </h2>
          <p className="text-[#6b6560] mb-8 text-lg">
            成為我們的司機，享受快速派單、智能帳務的便利
          </p>
          <Link href="/register">
            <Button size="lg" variant="primary" className="font-semibold gap-2 px-8">
              立即註冊
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-[#1e1e26]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#ff6b2b] flex items-center justify-center">
              <Plane className="w-3 h-3 text-black" />
            </div>
            <span className="text-sm text-[#6b6560]">
              機場接送派單平台
            </span>
          </div>
          <p className="text-xs text-[#3a3a40]">
            2026 Airport Dispatch Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
