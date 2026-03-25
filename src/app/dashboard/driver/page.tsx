'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { OrderCard, Order } from '@/components/driver/OrderCard'
import { format, parseISO } from 'date-fns'
import { UserCheck, ClipboardList, FileText, Wallet, LogOut, Plane, Zap, TrendingUp, Radio } from 'lucide-react'
import Link from 'next/link'

type Tab = 'available' | 'myorders' | 'balance'

export default function DriverDashboard() {
  const { user, token, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('available')
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [balance, setBalance] = useState<{ balance: number; transactions: unknown[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [todayCompleted, setTodayCompleted] = useState(0)

  // Redirect if not driver
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'DRIVER')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  const fetchOrders = useCallback(async () => {
    if (!token) return

    try {
      const [availableRes, myRes] = await Promise.all([
        fetch('/api/orders', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/orders?myOrders=true', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const availableData = await availableRes.json()
      const myData = await myRes.json()

      if (availableData.success) setAvailableOrders(availableData.data)
      if (myData.success) setMyOrders(myData.data)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchBalance = useCallback(async () => {
    if (!token) return

    try {
      const res = await fetch('/api/drivers/balance', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setBalance(data.data)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchOrders()
      fetchBalance()
      // Simulate today's completed count
      setTodayCompleted(Math.floor(Math.random() * 8) + 3)
    }
  }, [token, fetchOrders, fetchBalance])

  const handleAcceptOrder = async (orderId: string) => {
    if (!token) return
    setActionLoading(orderId)

    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (data.success) {
        await fetchOrders()
        await fetchBalance()
      } else {
        alert(data.error || '接單失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStatusChange = async (orderId: string, status: string) => {
    if (!token) return
    setActionLoading(orderId)

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ _action: 'status', status }),
      })
      const data = await res.json()

      if (data.success) {
        await fetchOrders()
        await fetchBalance()
      } else {
        alert(data.error || '更新失敗')
      }
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#ff8c42] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[#666]">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#ff8c42]/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-[#ff8c42] flex items-center justify-center">
                <Plane className="w-4 h-4 text-black" />
              </div>
              <span className="text-[#ff8c42] font-semibold tracking-tight">
                司機專區
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs text-[#22c55e]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                </span>
                在線
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-[#ff8c42]">{user.driver?.balance ?? 0} 點</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="border-white/20 text-[#666] hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="relative z-10 bg-black/50 backdrop-blur-xl border-b border-white/5 sticky top-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <ClipboardList className="w-4 h-4" /> 可接訂單 ({availableOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('myorders')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'myorders'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <FileText className="w-4 h-4" /> 我的行程 ({myOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('balance')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'balance'
                  ? 'border-[#ff8c42] text-[#ff8c42]'
                  : 'border-transparent text-[#666] hover:text-[#a0a0a0]'
              }`}
            >
              <Wallet className="w-4 h-4" /> 帳務中心
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-6">
        {/* Quick Stats Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ff8c42]/10 border border-[#ff8c42]/20">
            <Radio className="w-3 h-3 text-[#ff8c42] animate-pulse" />
            <span className="text-xs text-[#ff8c42] font-medium">即時動態</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-[#ff8c42]/20 to-transparent" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20">
            <span className="text-xs text-[#22c55e] font-medium">今日成交 {todayCompleted} 單</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-2 border-[#ff8c42] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Available Orders - Card Wall */}
            {activeTab === 'available' && (
              <div>
                {availableOrders.length === 0 ? (
                  <div className="text-center py-24 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                    <p className="text-[#a0a0a0] mb-2 text-lg">目前沒有可接的訂單</p>
                    <p className="text-[#666] text-sm">請稍後再刷新頁面</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableOrders.map((order, index) => (
                      <div key={order.id} className="animate-cardEntry" style={{ animationDelay: `${index * 50}ms` }}>
                        <OrderCard
                          order={order}
                          onAccept={handleAcceptOrder}
                          showActions={true}
                          isNew={true}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Orders */}
            {activeTab === 'myorders' && (
              <div>
                {myOrders.length === 0 ? (
                  <div className="text-center py-24 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                    <p className="text-[#a0a0a0] mb-2 text-lg">還沒有行程</p>
                    <p className="text-[#666] text-sm">快去接單吧！</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        showActions={true}
                        compact={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Balance */}
            {activeTab === 'balance' && balance && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-[#ff8c42]/20 to-[#ff8c42]/5 border border-[#ff8c42]/20 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet className="w-4 h-4 text-[#ff8c42]" />
                      <span className="text-xs text-[#ff8c42] uppercase tracking-wider">帳戶餘額</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{balance.balance}</p>
                    <p className="text-xs text-[#666] mt-1">點</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                      </span>
                      <span className="text-xs text-[#22c55e] uppercase tracking-wider">待結算</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {balance.transactions?.filter((t: unknown) => {
                        const tx = t as { status: string }
                        return tx.status === 'PENDING'
                      }).length || 0}
                    </p>
                    <p className="text-xs text-[#666] mt-1">筆</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                      <span className="text-xs text-[#3b82f6] uppercase tracking-wider">總行程</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {balance.transactions?.filter((t: unknown) => {
                        const tx = t as { type: string }
                        return tx.type === 'RIDE_FARE'
                      }).length || 0}
                    </p>
                    <p className="text-xs text-[#666] mt-1">單</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-[#a855f7]" />
                      <span className="text-xs text-[#a855f7] uppercase tracking-wider">平台費率</span>
                    </div>
                    <p className="text-3xl font-bold text-white">5%</p>
                    <p className="text-xs text-[#666] mt-1">每單</p>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                  <div className="px-6 py-4 border-b border-white/5">
                    <h3 className="text-lg font-semibold text-white">最近交易</h3>
                  </div>
                  <div className="p-6">
                    {!balance.transactions || balance.transactions.length === 0 ? (
                      <p className="text-[#666] text-center py-8">暫無交易記錄</p>
                    ) : (
                      <div className="space-y-4">
                        {(balance.transactions as unknown[]).slice(0, 10).map((tx: unknown) => {
                          const transaction = tx as {
                            id: string
                            amount: number
                            type: string
                            status: string
                            description?: string
                            createdAt: string
                          }
                          return (
                            <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                              <div>
                                <p className="text-sm font-medium text-[#e0e0e0]">
                                  {transaction.description || transaction.type}
                                </p>
                                <p className="text-xs text-[#666]">
                                  {format(typeof transaction.createdAt === 'string' ? parseISO(transaction.createdAt) : transaction.createdAt, 'yyyy/MM/dd HH:mm')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${transaction.amount >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                                  {transaction.amount >= 0 ? '+' : ''}{transaction.amount}
                                </p>
                                <Badge
                                  variant={transaction.status === 'PENDING' ? 'warning' : 'success'}
                                  className="text-xs"
                                >
                                  {transaction.status === 'PENDING' ? '待結算' : '已結算'}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
