'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { OrderCard, Order } from '@/components/driver/OrderCard'
import { format, parseISO } from 'date-fns'

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
        // Refresh orders
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">👨‍✈️ 司機專區</h1>
              <p className="text-sm text-slate-600">{user.name} • {user.driver?.balance ?? 0} 點</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={logout}>
                登出
              </Button>
            </div>
          </div>

        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-[80px] z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 可接訂單 ({availableOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('myorders')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'myorders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              📑 我的行程 ({myOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('balance')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'balance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              💰 帳務中心
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : (
          <>
            {/* Available Orders - Card Wall */}
            {activeTab === 'available' && (
              <div>
                {availableOrders.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <p className="text-slate-500">目前沒有可接的訂單</p>
                      <p className="text-sm text-slate-400 mt-2">請稍後再刷新頁面</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onAccept={handleAcceptOrder}
                        showActions={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Orders */}
            {activeTab === 'myorders' && (
              <div>
                {myOrders.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <p className="text-slate-500">還沒有行程</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card variant="elevated">
                    <CardContent className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{balance.balance}</p>
                      <p className="text-sm text-slate-600">帳戶餘額</p>
                    </CardContent>
                  </Card>
                  <Card variant="elevated">
                    <CardContent className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {balance.transactions?.filter((t: unknown) => {
                          const tx = t as { status: string }
                          return tx.status === 'PENDING'
                        }).length || 0}
                      </p>
                      <p className="text-sm text-slate-600">待結算</p>
                    </CardContent>
                  </Card>
                  <Card variant="elevated">
                    <CardContent className="text-center">
                      <p className="text-2xl font-bold text-slate-600">
                        {balance.transactions?.filter((t: unknown) => {
                          const tx = t as { type: string }
                          return tx.type === 'RIDE_FARE'
                        }).length || 0}
                      </p>
                      <p className="text-sm text-slate-600">總行程</p>
                    </CardContent>
                  </Card>
                  <Card variant="elevated">
                    <CardContent className="text-center">
                      <p className="text-2xl font-bold text-amber-600">5%</p>
                      <p className="text-sm text-slate-600">平台費率</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <CardTitle>最近交易</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!balance.transactions || balance.transactions.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">暫無交易記錄</p>
                    ) : (
                      <div className="space-y-3">
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
                            <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {transaction.description || transaction.type}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {format(parseISO(transaction.createdAt), 'yyyy/MM/dd HH:mm')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {transaction.amount >= 0 ? '+' : ''}{transaction.amount}
                                </p>
                                <Badge variant={transaction.status === 'PENDING' ? 'warning' : 'success'} className="text-xs">
                                  {transaction.status === 'PENDING' ? '待結算' : '已結算'}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
