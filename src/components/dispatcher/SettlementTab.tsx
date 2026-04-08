'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { format, parseISO } from 'date-fns'
import * as XLSX from 'xlsx'
import {
  ClipboardList,
  Download,
  Clock,
  CheckCircle,
} from 'lucide-react'

interface SettlementOrder {
  id: string
  orderDate: string
  orderSeq: number
  price: number
  completedAt: string | null
  transferStatus: string
  driver: {
    user: { name: string }
    licensePlate: string
    bankCode: string | null
    bankAccount: string | null
  } | null
}

interface SettlementData {
  completedOrdersCount: number
  totalAmount: number
  pendingCount: number
  pendingAmount: number
  completedCount: number
  completedAmount: number
  orders: SettlementOrder[]
}

interface SettlementTabProps {
  token: string | null
}

export function SettlementTab({ token }: SettlementTabProps) {
  const [loading, setLoading] = useState(true)
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return format(d, 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [transferFilter, setTransferFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const fetchSettlement = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/dispatchers/settlement?startDate=${startDate}&endDate=${endDate}&transferFilter=${transferFilter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.success) {
        setSettlementData(data.data)
      } else {
        setError(data.error || '載入失敗')
      }
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }, [token, startDate, endDate, transferFilter])

  useEffect(() => {
    if (token) { fetchSettlement() }
  }, [token, fetchSettlement, transferFilter])

  const handleDatePreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  const handleMarkTransferred = async (orderId: string, driverName: string, price: number) => {
    if (!token) return
    const confirmed = window.confirm(
      `確定已轉帳 NT$${price.toLocaleString()} 給司機 ${driverName} 嗎？\n此操作無法撤銷。`
    )
    if (!confirmed) return

    setTogglingId(orderId)
    try {
      const res = await fetch('/api/dispatchers/settlement/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (data.success) {
        setSettlementData(prev => {
          if (!prev) return prev
          const updatedOrders = prev.orders.map(o =>
            o.id === orderId ? { ...o, transferStatus: 'completed' } : o
          )
          return { ...prev, orders: updatedOrders }
        })
      } else {
        alert(data.error || '標記失敗')
      }
    } catch {
      alert('網路錯誤')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDownloadExcel = () => {
    if (!settlementData) return
    const rows = settlementData.orders.map(order => {
      const completedAt = order.completedAt
        ? format(parseISO(order.completedAt), 'yyyy-MM-dd HH:mm')
        : '-'
      return {
        '單號': `#${order.orderDate}-${order.orderSeq.toString().padStart(4, '0')}`,
        '完成日期': completedAt,
        '司機': order.driver?.user.name || '-',
        '車牌': order.driver?.licensePlate || '-',
        '銀行代碼': order.driver?.bankCode || '-',
        '銀行帳號': order.driver?.bankAccount
          ? `${order.driver.bankAccount.slice(0, 3)}***${order.driver.bankAccount.slice(-3)}`
          : '-',
        '金額': order.price,
        '轉帳狀態': order.transferStatus === 'completed' ? '已轉帳' : '待轉帳',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '轉帳清單')
    XLSX.writeFile(wb, `轉帳清單_${startDate}_${endDate}.xlsx`)
  }

  if (!token) return null

  return (
    <div className="space-y-5">
      {/* Date Range Picker */}
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="block text-[11px] text-[#717171] mb-2 font-normal">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222] focus:ring-[1px] focus:ring-[#222222] font-mono-nums"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-[#717171] mb-2 font-normal">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222] focus:ring-[1px] focus:ring-[#222222] font-mono-nums"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={transferFilter}
              onChange={(e) => setTransferFilter(e.target.value as 'all' | 'pending' | 'completed')}
              className="bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[13px] text-[#222222] focus:outline-none focus:border-[#222222]"
            >
              <option value="all">全部</option>
              <option value="pending">待轉帳</option>
              <option value="completed">已轉帳</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(7)} className="text-[13px]">近7天</Button>
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(30)} className="text-[13px]">近30天</Button>
            <Button size="sm" onClick={fetchSettlement} loading={loading} className="text-[13px]">查詢</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-[#FCEBEB] border border-[#F5C6C6] rounded-xl p-6 text-center">
          <p className="text-[#E24B4A] text-sm">{error}</p>
        </div>
      ) : settlementData ? (
        <>
          {/* Stats - 6 格 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">完成行程</p>
              <p className="text-[22px] font-medium text-[#222222] font-mono-nums">
                {settlementData.completedOrdersCount}
              </p>
              <p className="text-[10px] text-[#A8A29E]">筆</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">總派車金額</p>
              <p className="text-[22px] font-medium text-[#222222] font-mono-nums">
                NT${settlementData.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">待轉帳筆數</p>
              <p className="text-[22px] font-medium text-[#E24B4A] font-mono-nums">
                {settlementData.pendingCount}
              </p>
              <p className="text-[10px] text-[#A8A29E]">筆</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">待轉帳金額</p>
              <p className="text-[22px] font-medium text-[#E24B4A] font-mono-nums">
                NT${settlementData.pendingAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">已轉帳筆數</p>
              <p className="text-[22px] font-medium text-[#008A05] font-mono-nums">
                {settlementData.completedCount}
              </p>
              <p className="text-[10px] text-[#A8A29E]">筆</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-[11px] text-[#717171] mb-1">已轉帳金額</p>
              <p className="text-[22px] font-medium text-[#008A05] font-mono-nums">
                NT${settlementData.completedAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Transfer table */}
          <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-[#DDDDDD]">
              <h3 className="text-sm font-medium text-[#222222]">司機轉帳清單</h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-[12px] sm:text-[13px] text-[#717171]">共 {settlementData.orders.length} 筆</span>
                <Button size="sm" onClick={handleDownloadExcel} className="text-[12px] sm:text-[13px]">
                  <Download className="w-3 h-3 mr-1" />
                  下載 Excel
                </Button>
              </div>
            </div>

            {settlementData.orders.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="w-8 h-8 text-[#B0B0B0] mx-auto mb-3" />
                <p className="text-[#717171] text-sm">此區間尚無完成的行程</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#DDDDDD]">
                      <th className="text-left text-[11px] text-[#717171] py-3 px-5 font-normal">單號</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">司機</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">車牌</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">銀行帳號</th>
                      <th className="text-left text-[11px] text-[#717171] py-3 px-4 font-normal">日期</th>
                      <th className="text-right text-[11px] text-[#717171] py-3 px-4 font-normal">金額</th>
                      <th className="text-center text-[11px] text-[#717171] py-3 px-4 font-normal">轉帳情形</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementData.orders.map((order) => {
                      const completedAt = order.completedAt
                        ? format(parseISO(order.completedAt), 'MM/dd HH:mm')
                        : '-'
                      return (
                        <tr key={order.id} className="border-b border-[#DDDDDD] last:border-0 hover:bg-[#F7F7F7] transition-colors">
                          <td className="py-3 px-5">
                            <span className="text-xs font-mono-nums font-bold text-[#222222]">
                              #{order.orderDate}-{order.orderSeq.toString().padStart(4, '0')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-normal text-[#222222]">{order.driver?.user.name || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#717171] font-mono-nums">{order.driver?.licensePlate || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            {order.driver?.bankCode && order.driver?.bankAccount ? (
                              <div className="text-[13px] text-[#717171]">
                                <div>{order.driver.bankCode}</div>
                                <div className="font-mono-nums text-[11px] text-[#A8A29E]">
                                  {order.driver.bankAccount.slice(0, 3)}***{order.driver.bankAccount.slice(-3)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[#B0B0B0] text-[13px]">未設定</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-[#717171] font-mono-nums">{completedAt}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-medium text-[#222222] font-mono-nums">NT${order.price.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {order.transferStatus === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] bg-[#E8F5E8] text-[#008A05] opacity-70">
                                <CheckCircle className="w-3 h-3" />
                                已轉帳
                              </span>
                            ) : (
                              <button
                                onClick={() => handleMarkTransferred(
                                  order.id,
                                  order.driver?.user.name || '司機',
                                  order.price
                                )}
                                disabled={togglingId === order.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] bg-[#FFF3E0] text-[#B45309] hover:bg-[#FFE0B2] transition-colors disabled:opacity-50"
                              >
                                <Clock className="w-3 h-3" />
                                待轉帳
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
