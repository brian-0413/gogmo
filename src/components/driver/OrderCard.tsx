'use client'

import { OrderStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TripProgressTracker } from './TripProgressTracker'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { User, Package, FileText, ChevronDown, ChevronUp, Send, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
import { formatOrderNo } from '@/lib/utils'
import { VEHICLE_LABELS, TYPE_COLORS, TYPE_LABELS, TRANSFER_FEE_RATE } from '@/lib/vehicle-compat'
import type { OrderType, Order } from '@/types'
import type { VehicleType } from '@/lib/vehicle'

export type { Order } from '@/types'

interface OrderCardProps {
  order: Order
  onAccept?: (orderId: string) => void
  onView?: (orderId: string) => void
  onTransferRequest?: (orderId: string, reason: string) => void
  onCancel?: (orderId: string) => void
  onDispatchToHall?: (orderId: string, cashCollected: number, commissionReturn: number) => Promise<boolean>
  onSmartSchedule?: (orderId: string) => void
  showActions?: boolean
  compact?: boolean
  isNew?: boolean
  transferLoading?: string | null
  /** 銜接提示：來自 smart-sort API */
  matchReason?: string
  connectsTo?: string
  /** 此訂單是否正在等待審核（申請中） */
  isApplying?: boolean
}

function getTimeUrgency(scheduledTime: string | Date): "urgent" | "soon" | "normal" {
  const now = new Date()
  const time = typeof scheduledTime === 'string' ? parseISO(scheduledTime) : new Date(scheduledTime)
  const diff = differenceInMinutes(time, now)
  if (diff <= 30) return "urgent"
  if (diff <= 60) return "soon"
  return "normal"
}

function OrderCard({ order, onAccept, onView, onTransferRequest, onCancel, onDispatchToHall, onSmartSchedule, showActions = true, compact = false, isNew = false, transferLoading = null, matchReason, connectsTo, isApplying }: OrderCardProps) {
  const scheduledDate = typeof order.scheduledTime === 'string' ? parseISO(order.scheduledTime) : order.scheduledTime
  const orderType: OrderType = order.type || 'pending'
  const vehicle: VehicleType = order.vehicle as VehicleType || 'SEDAN_5'
  const urgency = getTimeUrgency(order.scheduledTime)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [compactNotesExpanded, setCompactNotesExpanded] = useState(false)
  // Trip progress tracker state
  const [showTripTracker, setShowTripTracker] = useState(false)
  const [tripStep, setTripStep] = useState(-1)
  // Urgent countdown
  const [countdown, setCountdown] = useState('')
  useEffect(() => {
    if (urgency !== 'urgent') return
    const update = () => {
      const diff = differenceInMinutes(scheduledDate, new Date())
      if (diff <= 0) { setCountdown('已超时'); return }
      const h = Math.floor(diff / 60)
      const m = diff % 60
      setCountdown(h > 0 ? `距 ${h}小時${m}分` : `距 ${m}分`)
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [scheduledDate, urgency])
  const notes = order.notes || order.note || order.rawText
  const orderNo = formatOrderNo(scheduledDate, order.orderSeq)
  const typeBadgeColor = TYPE_COLORS[orderType]
  // Dispatch-to-hall state
  const [showDispatchForm, setShowDispatchForm] = useState(false)
  const [dispatchCashCollected, setDispatchCashCollected] = useState('')
  const [dispatchCommissionReturn, setDispatchCommissionReturn] = useState('')
  const [dispatching, setDispatching] = useState(false)

  const isPickup = orderType === 'pickup'
  const isBoat = orderType === 'pickup_boat' || orderType === 'dropoff_boat'
  const pickupLabel = isBoat ? '出發港' : isPickup ? '桃園機場' : '上車'
  const dropoffLabel = isBoat ? '目的地港' : isPickup ? '目的地' : '桃園機場'

  if (compact) {
    return (
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-3 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-all duration-200 relative">
        {order.status === 'ACCEPTED' && onSmartSchedule && (
          <button
            onClick={(e) => { e.stopPropagation(); onSmartSchedule(order.id) }}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-[11px] font-bold rounded-lg hover:from-[#EA580C] hover:to-[#C2410C] transition-colors shadow-sm z-10"
            title="智慧排單"
          >
            <Sparkles className="w-3 h-3" />
            智慧排單
          </button>
        )}
        {/* 顯眼單號標籤 */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center px-2 py-1 bg-[#FF385C] text-white text-[13px] font-bold font-mono-nums rounded tracking-wider select-all">
              #{orderNo}
            </span>
            {order.isQROrder && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-bold font-mono-nums rounded bg-[#1C1917] text-[#E8A855]">
                QR
              </span>
            )}
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#222222]">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-sm font-bold font-mono-nums text-[#222222]">
            {format(scheduledDate, 'HH:mm')}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[18px] sm:text-lg font-bold font-mono-nums text-[#FF385C]">
            NT${order.price}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}>
            {TYPE_LABELS[orderType]}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-[#717171] mb-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: typeBadgeColor.bg === '#F4EFE9' ? '#DDDDDD' : typeBadgeColor.bg }} />
            <span className="truncate min-w-0 text-[13px]">{order.pickupLocation}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#DDDDDD] mt-0.5 flex-shrink-0" />
            <span className="truncate min-w-0 text-[13px]">{order.dropoffLocation}</span>
          </div>
        </div>
        {notes && (
          compactNotesExpanded ? (
            <button
              onClick={() => setCompactNotesExpanded(false)}
              className="w-full text-left text-xs text-[#717171] italic bg-[#F4EFE9] p-1.5 rounded leading-relaxed"
            >
              {notes}
              <span className="ml-1 text-[#B45309] not-italic font-medium">▲</span>
            </button>
          ) : (
            <button
              onClick={() => setCompactNotesExpanded(true)}
              className="w-full text-left text-xs text-[#717171] italic bg-[#F4EFE9] p-1.5 rounded truncate"
              aria-label="展開備註"
            >
              {notes}
            </button>
          )
        )}
        {matchReason && (
          <div className="flex items-center gap-1.5 mt-2 text-[12px] text-[#B45309] bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-3 py-2">
            <span>💡</span>
            <span className="font-medium">{matchReason}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${isNew ? 'animate-cardEntry' : ''} ${order.isPremium ? 'border-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.3)]' : 'border-[#DDDDDD]'}`}>
      {/* Premium gold top stripe */}
      {order.isPremium && (
        <div className="h-0.5 bg-gradient-to-r from-[#FFD700] via-[#FFF8DC] to-[#FFD700]" />
      )}
      {/* Urgent red top stripe */}
      {!order.isPremium && isNew && (
        <div className="h-0.5 bg-gradient-to-r from-[#FF385C] via-[#FF385C]/50 to-[#FF385C]" />
      )}

      <div className="p-3 sm:p-4">
        {/* 第一行：單號 + 種類 + 車型 + 肯驛 | 倒數 + 狀態 */}
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-3 py-1.5 bg-[#FF385C] text-white text-[15px] font-bold font-mono-nums rounded select-all">
              #{orderNo}
            </span>
            <span
              className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded"
              style={{ backgroundColor: typeBadgeColor.bg, color: typeBadgeColor.text }}
            >
              {TYPE_LABELS[orderType]}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
              {VEHICLE_LABELS[vehicle as keyof typeof VEHICLE_LABELS]}
              {order.plateType && order.plateType !== 'any' ? ` (${order.plateType}牌)` : ''}
            </span>
            {order.kenichiRequired && (
              <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">
                肯驛
              </span>
            )}
            {order.isQROrder && (
              <span className="inline-flex items-center px-3 py-1.5 text-[15px] font-bold font-mono-nums rounded bg-[#1C1917] text-[#E8A855]">
                QR 貴賓單
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <OrderStatusBadge status={order.status} />
            {urgency === 'urgent' && (
              <span className="inline-flex items-center px-2 py-1 text-[11px] font-bold rounded bg-[#EF4444] text-white animate-pulse">
                {countdown}
              </span>
            )}
            {order.status === 'ACCEPTED' && order.transferStatus && order.transferStatus !== 'pending' && (
              <span className="inline-flex items-center px-2 py-1 text-[11px] font-bold rounded bg-[#FFF3E0] text-[#B45309]">
                等待小隊支援
              </span>
            )}
          </div>
        </div>

        {/* 第二行：日期 / 時間 / 航班 */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-base font-bold text-[#222222] font-mono-nums">
            {format(scheduledDate, 'M/dd (E)', { locale: zhTW })}
          </span>
          <span className="text-[18px] sm:text-[20px] md:text-[22px] font-bold font-mono-nums text-[#222222] leading-none">
            {format(scheduledDate, 'HH:mm')}
          </span>
          {order.flightNumber && (
            <span className="bg-[#F4EFE9] px-2 py-1 rounded font-mono-nums text-[13px] text-[#717171] font-bold">
              {order.flightNumber}
            </span>
          )}
        </div>

        {/* 第三行：金額 */}
        <div className="mb-3">
          <span className="text-[24px] sm:text-[28px] md:text-[32px] font-bold font-mono-nums text-[#FF385C] leading-none">
            NT${order.price.toLocaleString()}
          </span>
        </div>

        {/* 第四行：起點 → 終點 */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: typeBadgeColor.bg === '#F4EFE9' ? '#FF385C' : typeBadgeColor.bg === '#E6F1FB' ? '#0C447C' : typeBadgeColor.bg === '#FFF3E0' ? '#92400E' : typeBadgeColor.bg === '#F3E8FF' ? '#6B21A8' : '#717171' }} />
            <div>
              <p className="text-[11px] text-[#717171] uppercase tracking-wider">{pickupLabel}</p>
              <p className="text-[14px] sm:text-[16px] font-bold text-[#222222]">{order.pickupLocation}</p>
            </div>
          </div>
          <span className="text-[20px] font-bold text-[#DDDDDD] mt-1 flex-shrink-0">→</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#DDDDDD] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-[#717171] uppercase tracking-wider">{dropoffLabel}</p>
              <p className="text-[14px] sm:text-[16px] font-bold text-[#222222]">{order.dropoffLocation}</p>
            </div>
          </div>
        </div>

        {/* 備註 — 可折疊 */}
        {notes && (
          <div className="mb-3">
            {notesExpanded ? (
              <div className="text-[13px] text-[#717171] bg-[#FFF3E0] border border-[#FFE0B2] p-2.5 rounded-lg flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#B45309]" />
                <span className="leading-relaxed flex-1">{notes}</span>
                <button
                  onClick={() => setNotesExpanded(false)}
                  className="flex-shrink-0 p-0.5 text-[#B45309] hover:text-[#92400E] transition-colors"
                  aria-label="收合備註"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNotesExpanded(true)}
                className="flex items-center gap-1.5 text-[13px] text-[#B45309] hover:text-[#92400E] transition-colors font-medium"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>查看備註</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* 乘客附屬資訊 */}
        <div className="flex items-center gap-4 text-[13px] text-[#717171] mb-3">
          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {order.passengerName}</span>
          <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {order.passengerCount}人 / {order.luggageCount}行李</span>
        </div>

        {/* Trip Progress Tracker */}
        {showTripTracker && (
          <div className="mt-3">
            <TripProgressTracker
              currentStep={tripStep}
              onAdvance={() => setTripStep(s => Math.min(s + 1, 3))}
            />
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[#EBEBEB]">
            {/* 第一列：PUBLISHED 接單 / ASSIGNED QR 單派到接單大廳 / 查看詳情 */}
            <div className="flex gap-2">
              {onView && (
                <Button variant="outline" size="sm" onClick={() => onView(order.id)}
                  className="hidden sm:flex-1 border-[#DDDDDD] text-[#717171] hover:border-[#222222] hover:text-[#222222] hover:bg-[#F4EFE9]">
                  查看詳情
                </Button>
              )}
              {onAccept && order.status === 'PUBLISHED' && !isApplying && (
                <Button variant="primary" size="sm" onClick={() => onAccept(order.id)}
                  className="flex-1 py-3 font-bold tracking-wide text-[15px]">
                  申請接單
                </Button>
              )}
              {isApplying && (
                <Button variant="primary" size="sm" disabled
                  className="flex-1 py-3 font-bold tracking-wide text-[15px] bg-gray-200 text-gray-500 cursor-wait">
                  等待審核中
                </Button>
              )}
            </div>

            {/* ASSIGNED QR 單：派到接單大廳 */}
            {order.isQROrder && order.status === 'ASSIGNED' && onDispatchToHall && (
              <div className="mt-1">
                {!showDispatchForm ? (
                  <button
                    onClick={() => setShowDispatchForm(true)}
                    className="w-full py-2.5 bg-[#0C447C] text-white text-[14px] font-bold rounded-lg hover:bg-[#0a3a6e] transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    派到接單大廳
                  </button>
                ) : (
                  <div className="bg-[#FFF3E0] border border-[#F59E0B]/30 rounded-xl p-4 space-y-3">
                    <p className="text-[12px] font-bold text-[#B45309]">派到接單大廳</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-[#717171] whitespace-nowrap">實收金額</span>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[13px] text-[#717171]">NT$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={dispatchCashCollected}
                          onChange={e => {
                            const digits = e.target.value.replace(/[^\d]/g, '')
                            setDispatchCashCollected(digits)
                          }}
                          placeholder={String(order.qrPrice ?? order.price)}
                          className="flex-1 px-2 py-1.5 border-2 border-[#DDDDDD] rounded-lg text-[13px] outline-none focus:border-[#F59E0B] bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-[#717171] whitespace-nowrap">回金金額</span>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[13px] text-[#717171]">NT$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={dispatchCommissionReturn}
                          onChange={e => {
                            const digits = e.target.value.replace(/[^\d]/g, '')
                            setDispatchCommissionReturn(digits)
                          }}
                          placeholder="0"
                          className="flex-1 px-2 py-1.5 border-2 border-[#DDDDDD] rounded-lg text-[13px] outline-none focus:border-[#F59E0B] bg-white"
                        />
                      </div>
                    </div>
                    {dispatchCashCollected && (
                      <div className="px-3 py-2 bg-[#0C447C] text-white rounded-lg text-center">
                        <span className="text-[12px] font-bold">外派後您實拿：</span>
                        <span className="text-[18px] font-extrabold ml-1">
                          NT$ {Math.max(0, parseInt(dispatchCashCollected || '0') - parseInt(dispatchCommissionReturn || '0')).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowDispatchForm(false)
                          setDispatchCashCollected('')
                          setDispatchCommissionReturn('')
                        }}
                        className="flex-1 py-2 bg-white border border-[#DDDDDD] text-[#717171] text-[13px] font-bold rounded-lg hover:border-[#FF385C] hover:text-[#FF385C] transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={async () => {
                          const cash = parseInt(dispatchCashCollected || '0')
                          const commission = parseInt(dispatchCommissionReturn || '0')
                          if (cash <= 0) { alert('請填寫實收金額'); return }
                          setDispatching(true)
                          const ok = await onDispatchToHall(order.id, cash, commission)
                          setDispatching(false)
                          if (ok) {
                            setShowDispatchForm(false)
                            setDispatchCashCollected('')
                            setDispatchCommissionReturn('')
                          }
                        }}
                        disabled={dispatching}
                        className="flex-1 py-2 bg-[#FF385C] text-white text-[13px] font-bold rounded-lg hover:bg-[#E83355] disabled:opacity-60 transition-colors"
                      >
                        {dispatching ? '送出中...' : '確認外派'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* ACCEPTED 狀態：執行行程 / 小隊支援 / 退單 */}
            {order.status === 'ACCEPTED' && (
              <>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setShowTripTracker(true)}
                    className="flex-1 py-2.5 sm:py-auto text-[14px] sm:text-[13px] font-bold bg-[#0C447C] text-white hover:bg-[#0a3a6e] transition-colors"
                  >
                    執行行程
                  </Button>
                  {onTransferRequest && (
                    <Button
                      size="sm"
                      onClick={() => onTransferRequest(order.id, '')}
                      disabled={!!transferLoading}
                      className="flex-1 py-2.5 sm:py-auto text-[14px] sm:text-[13px] font-bold bg-[#0C447C] text-white hover:bg-[#0a3a6e] transition-colors disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {transferLoading === order.id ? '等待隊友回應...' : '請求小隊支援'}
                    </Button>
                  )}
                  {onSmartSchedule && (
                    <Button
                      size="sm"
                      onClick={() => onSmartSchedule(order.id)}
                      className="py-2.5 sm:py-auto px-3 text-[13px] font-bold bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white hover:from-[#EA580C] hover:to-[#C2410C] transition-colors shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      智慧排單
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={onCancel ? () => onCancel(order.id) : undefined}
                    className="py-2.5 sm:py-auto px-3 text-[13px] font-bold border border-[#E24B4A] text-[#E24B4A] hover:bg-[#FCEBEB] transition-colors bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    退單
                  </Button>
                </div>
                {/* 費用說明 */}
                <div className="text-[11px] text-[#717171] px-1">
                  <span className="text-[#0C447C]">請求支援</span>
                  <span className="mx-1">：</span>
                  轉單費 5%（約 NT${Math.floor(order.price * TRANSFER_FEE_RATE).toLocaleString()}）
                  <span className="mx-2 text-[#DDDDDD]">|</span>
                  <span className="text-[#E24B4A]">直接退單</span>
                  <span className="mx-1">：</span>
                  退單費 10%
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export { OrderCard }
