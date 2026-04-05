import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { format, parseISO, differenceInMinutes } from "date-fns"
import { Button } from "@/components/ui/Button"
import {
  Plane,
  MapPin,
  Clock,
  Car,
  Users,
  Wallet,
  ArrowRight,
  Zap,
  TrendingUp,
  Eye,
  UserCheck,
} from "lucide-react"
import { FlipboardGrid } from "@/components/FlipboardGrid"
import { LiveTicker } from "@/components/LiveTicker"
import { DriverStatusCarousel } from "@/components/DriverStatusCarousel"

async function getPublishedOrders() {
  try {
    const orders = await prisma.order.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { scheduledTime: "asc" },
      take: 100,
    })
    return orders
  } catch (error) {
    console.error("Failed to fetch orders:", error)
    return []
  }
}

async function getStats() {
  try {
    const [totalOrders, drivers] = await Promise.all([
      prisma.order.count({ where: { status: "PUBLISHED" } }),
      prisma.driver.count(),
    ])

    const publishedOrders = await prisma.order.findMany({
      where: { status: "PUBLISHED" },
      select: { pickupLocation: true, price: true, scheduledTime: true },
    })

    const allOrders = await prisma.order.findMany({
      select: { price: true },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCompleted = await prisma.order.count({
      where: { status: "COMPLETED", updatedAt: { gte: today } },
    })

    const now = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentOrders = (publishedOrders as any[]).filter((o: any) => {
      const time = typeof o.scheduledTime === 'string' ? parseISO(o.scheduledTime) : o.scheduledTime
      const diff = differenceInMinutes(time, now)
      return diff > 0 && diff <= 60
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pickupCount = (publishedOrders as any[]).filter((o: any) =>
      o.pickupLocation.includes("桃園機場") || o.pickupLocation.includes("機場")
    ).length

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalAmount = (allOrders as any[]).reduce((sum: any, o: any) => sum + o.price, 0)

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
      pickupCount: 0, dropoffCount: 0, driverCount: 0,
      totalAmount: 0, recentCount: 0, todayCompleted: 0,
    }
  }
}

function getTimeUrgency(scheduledTime: string | Date): "urgent" | "soon" | "normal" {
  const now = new Date()
  const time = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : new Date(scheduledTime)
  const diff = differenceInMinutes(time, now)
  if (diff <= 30) return "urgent"
  if (diff <= 60) return "soon"
  return "normal"
}

function formatTime(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === "string" ? parseISO(dateTime) : new Date(dateTime)
    return format(date, "HH:mm")
  } catch {
    return "--:--"
  }
}

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
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAF8F5] border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="text-[#222222] font-medium">機場接送派單平台</span>
            </Link>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5 text-xs text-[#008A05]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#008A05]" />
                {stats.driverCount} 司機在線
              </div>
              <Link href="/login" className="text-sm text-[#717171] hover:text-[#222222] transition-colors">司機登入</Link>
              <Link href="/login" className="text-sm text-[#717171] hover:text-[#222222] transition-colors">派單方登入</Link>
              <Link href="/register">
                <Button size="sm" className="text-[13px]">立即註冊</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Live Ticker */}
          <LiveTicker todayCompleted={stats.todayCompleted} />

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-medium text-[#222222] tracking-tight mb-6 leading-[1.1]">
                機場接送
                <br />
                <span className="text-[#FF385C]">派單平台</span>
              </h1>

              <p className="text-lg text-[#717171] mb-8 max-w-lg">
                為台灣接送產業而生的智能派單系統，讓司機快速掌握接單機會
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto text-[14px] gap-2">
                    立即加入司機行列
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-[14px]">
                    登入系統
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-[#FFF3E0] border border-[#FFE0B2] flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-[#B45309]" />
                  </div>
                  <span className="text-[11px] text-[#717171]">最新訂單</span>
                </div>
                <p className="text-3xl font-bold text-[#222222] mb-1 font-mono-nums">{stats.pickupCount + stats.dropoffCount}</p>
                <p className="text-[13px] text-[#717171]">筆可接訂單</p>
              </div>

              <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-[#E6F1FB] border border-[#C2DBF5] flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-[#0C447C]" />
                  </div>
                  <span className="text-[11px] text-[#717171]">一小時內</span>
                </div>
                <p className="text-3xl font-bold text-[#222222] mb-1 font-mono-nums">{stats.recentCount}</p>
                <p className="text-[13px] text-[#717171]">筆新訂單</p>
              </div>

              <DriverStatusCarousel />

              <div className="bg-white rounded-xl p-5 border border-[#DDDDDD]">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-[#F3E8FF] border border-[#E9D5FF] flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-[#6B21A8]" />
                  </div>
                  <span className="text-[11px] text-[#717171]">案件總額</span>
                </div>
                <p className="text-3xl font-bold text-[#222222] mb-1 font-mono-nums">NT${stats.totalAmount.toLocaleString()}</p>
                <p className="text-[13px] text-[#717171]">元</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Orders Section */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-medium text-[#222222]">即刻可接行程</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#F4EFE9] text-[#717171] text-[13px] border border-[#DDDDDD]">
                {orders.length} 筆
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#008A05]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#008A05]" />
              即時更新中
            </div>
          </div>

          {/* Flipboard Grid */}
          <FlipboardGrid orders={orders} gridSize={20} />

          {orders.length > 20 && (
            <div className="mt-6 text-center">
              <Link href="/register" className="inline-flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#222222] transition-colors">
                查看全部 {orders.length} 筆訂單
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[22px] font-medium text-[#222222] mb-2">準備好加入了嗎？</h2>
          <p className="text-[#717171] mb-6">成為我們的司機，享受快速派單、智能帳務的便利</p>
          <Link href="/register">
            <Button size="lg" className="gap-2 px-6 text-[14px]">
              立即註冊
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-5 px-6 border-t border-[#DDDDDD] bg-[#F4EFE9]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#FF385C] flex items-center justify-center">
              <Plane className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-[#717171]">機場接送派單平台</span>
          </div>
          <p className="text-[11px] text-[#B0B0B0]">
            2026 Airport Dispatch Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
