import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { format, parseISO } from 'date-fns'

// Fetch published orders
async function getPublishedOrders() {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: 'PUBLISHED',
      },
      orderBy: {
        scheduledTime: 'asc',
      },
      take: 200, // Increased limit to show more orders
    })
    return orders
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    return []
  }
}

// Determine order type (pickup = 接機, dropoff = 送機)
function getOrderType(pickupLocation: string, dropoffLocation: string): 'pickup' | 'dropoff' {
  if (pickupLocation.includes('桃園機場') || pickupLocation.includes('機場')) {
    return 'pickup'
  }
  if (dropoffLocation.includes('桃園機場') || dropoffLocation.includes('機場')) {
    return 'dropoff'
  }
  return 'dropoff'
}

// Format time from datetime string
function formatTime(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime
    return format(date, 'HH:mm')
  } catch {
    return '--:--'
  }
}

// Format date from datetime string
function formatDate(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime
    return format(date, 'M/d')
  } catch {
    return '--'
  }
}

export default async function Home() {
  const orders = await getPublishedOrders()

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#0f0f1a]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-cyan-400">✈️ 機場接送派單平台</h1>
            <div className="flex gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                司機登入
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                車頭登入
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm bg-cyan-500 text-black font-medium rounded-lg hover:bg-cyan-400 transition-colors"
              >
                立即註冊
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            機場接送派單平台
          </h1>
          <p className="text-xl text-cyan-400 mb-2">
            接單不再等，單單都搶快
          </p>
          <p className="text-white/60 mb-8">
            立即查看最新行程，快速搶單
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="px-6 py-3 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
            >
              立即加入司機行列
            </Link>
          </div>
        </div>
      </div>

      {/* Orders Grid - 展示廳 */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">
            <span className="text-cyan-400">▶</span> 即刻可接行程 ({orders.length})
          </h2>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            即時更新
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl text-white/60 mb-4">目前沒有可接的行程</p>
            <p className="text-white/40">請稍後再回來查看，或聯繫車頭發布新行程</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const orderType = getOrderType(order.pickupLocation, order.dropoffLocation)
              const isPickup = orderType === 'pickup'

              return (
                <div
                  key={order.id}
                  className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {/* Order Type Badge */}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          isPickup
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {isPickup ? '🔼 接機' : '🔽 送機'}
                      </span>
                      <span className="text-xs text-white/40">
                        #{order.id.slice(0, 6)}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-cyan-400">
                      NT${order.price}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="mb-3">
                    <div className="text-2xl font-mono font-bold text-white">
                      {formatTime(order.scheduledTime)}
                    </div>
                    <div className="text-xs text-white/40">
                      {formatDate(order.scheduledTime)}
                    </div>
                  </div>

                  {/* Route */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm truncate">{order.pickupLocation}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-sm truncate">{order.dropoffLocation}</span>
                    </div>
                  </div>

                  {/* Car Type & Passengers */}
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>🚗 {order.note || '小車'}</span>
                    <span>👤 {order.passengerCount}人</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-[#1a1a2e] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">準備好加入了嗎？</h2>
          <p className="text-white/60 mb-8">
            成為我們的司機，享受快速派單、智能帳務的便利
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
            >
              立即註冊成為司機
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0f0f1a] border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-white/40 text-sm">
          <p>© 2026 機場接送派單平台. 為台灣接送產業而生。</p>
        </div>
      </footer>
    </div>
  )
}
