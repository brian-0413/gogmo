'use client'

import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Sparkles, CheckCircle, AlertTriangle, XCircle, ArrowRight, X, CalendarDays, Clock } from 'lucide-react'
import { PLATFORM_FEE_RATE } from '@/lib/constants'
import type { Order } from '@/types'

interface SmartScheduleRecommendation {
  id: string
  orderDate: string
  orderSeq: number
  type: string
  vehicle: string
  scheduledTime: string
  price: number
  pickupLocation: string
  dropoffLocation: string
  passengerName: string
  passengerCount: number
  luggageCount: number
  flightNumber: string
  kenichiRequired: boolean
  reason: string
  tightnessLabel: string
  tightnessLevel: string
  recommendType: 'pickup' | 'dropoff'
  waitMinutes?: number
  bufferMinutes?: number
  emptyDriveMinutes?: number
}

interface SmartSchedulePanelProps {
  // 起始訂單（從行程卡片點擊而來）
  startOrder: Order | null
  // API 查詢結果
  scheduleResult: {
    driverStatus?: {
      dailyOrderCount: number
      dailyOrderLimit: number
      canAcceptMore: boolean
    }
    currentOrders: Array<{ id: string; scheduledTime: string; type: string; status: string; pickupLocation: string; dropoffLocation: string; price: number }>
    currentOrder: { id: string; scheduledTime: string; type: string; pickupLocation: string; dropoffLocation: string; price: number } | null
    arriveTime?: string | null
    availableCount: number
    recommendations: SmartScheduleRecommendation[]
    mainRecommendations?: SmartScheduleRecommendation[]
    standbyRecommendations?: SmartScheduleRecommendation[]
    nextRecommendations?: SmartScheduleRecommendation[]
    timeline: Array<{ time: string; label: string; orderId?: string; price?: number; isTrigger?: boolean; waitMinutes?: number; travelMinutes?: number }>
    totalIncome: number
  } | null
  filteredScheduleRecs: {
    recs: SmartScheduleRecommendation[]
    label: string
    sortHint: string
  }
  selectedScheduleOrders: string[]
  onToggleOrder: (orderId: string) => void
  onConfirmSchedule: () => void
  onClear: () => void
  scheduleConfirming: boolean
}

export function SmartSchedulePanel({
  startOrder,
  scheduleResult,
  filteredScheduleRecs,
  selectedScheduleOrders,
  onToggleOrder,
  onConfirmSchedule,
  onClear,
  scheduleConfirming,
}: SmartSchedulePanelProps) {
  if (!scheduleResult) return null

  const driverStatus = scheduleResult.driverStatus
  const mainRecs = scheduleResult.mainRecommendations?.length
    ? scheduleResult.mainRecommendations
    : filteredScheduleRecs.recs
  const standbyRecs = scheduleResult.standbyRecommendations || []
  const nextRecs = scheduleResult.nextRecommendations || []

  // 銜接標籤顏色
  const getTightnessColor = (level: string) => {
    if (level === 'perfect' || level === 'comfortable') return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle }
    if (level === 'ok' || level === 'reasonable') return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: AlertTriangle }
    if (level === 'tight') return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle }
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle }
  }

  // 車型翻譯
  const vehicleLabel = (v: string) => {
    const labels: Record<string, string> = { small: '小車', suv: '休旅', van9: '9人座', any: '任意', any_r: '任意R' }
    return labels[v] || '待確認'
  }

  // 種類翻譯
  const typeLabel = (t: string) => {
    const labels: Record<string, string> = { pickup: '接機', dropoff: '送機', pickup_boat: '接機(港)', dropoff_boat: '送機(港)', transfer: '接駁', charter: '包車' }
    return labels[t] || t
  }

  // 顯示起始訂單的 helper
  const renderOrderBadge = (type: string) => {
    const isPickup = type === 'pickup' || type === 'pickup_boat'
    return {
      bg: isPickup ? '#E6F1FB' : '#FFF3E0',
      color: isPickup ? '#0C447C' : '#92400E',
      label: typeLabel(type),
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 面板標題 */}
        <div className="sticky top-0 bg-gradient-to-r from-[#FFF7ED] to-[#FFF3E0] border-b border-[#FFE0B2] px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="w-4 h-4 text-[#B45309]" />
              <h3 className="text-[16px] font-semibold text-[#222222]">智慧排單推薦</h3>
            </div>
            <p className="text-[12px] text-[#78716C]">
              {driverStatus
                ? `今日已接 ${driverStatus.dailyOrderCount} 單，${driverStatus.canAcceptMore ? `還可接 ${driverStatus.dailyOrderLimit - driverStatus.dailyOrderCount} 單` : '已達上限'}`
                : scheduleResult.currentOrder
                  ? `依您 ${format(parseISO(scheduleResult.currentOrder.scheduledTime), 'M/dd HH:mm', { locale: zhTW })} 的行程推薦`
                  : '依您目前的行程，推薦可銜接的訂單'}
            </p>
          </div>
          <button
            onClick={onClear}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="關閉"
          >
            <X className="w-5 h-5 text-[#717171]" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 你目前的行程 */}
          {startOrder && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-[#78716C]" />
                <p className="text-[11px] text-[#78716C] uppercase tracking-wider font-medium">你目前的行程</p>
              </div>
              <div className="bg-[#F4EFE9] rounded-xl p-4 border border-[#EBEBEB]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-bold font-mono-nums rounded" style={{ backgroundColor: renderOrderBadge(startOrder.type).bg, color: renderOrderBadge(startOrder.type).color }}>
                      {renderOrderBadge(startOrder.type).label}
                    </span>
                    <span className="text-[14px] font-medium text-[#222222]">
                      {startOrder.pickupLocation} → {startOrder.dropoffLocation}
                    </span>
                  </div>
                  <span className="text-[16px] font-bold font-mono-nums text-[#FF385C]">NT${startOrder.price.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[#717171]">
                  <span className="font-bold font-mono-nums">{format(parseISO(startOrder.scheduledTime as string), 'M/dd HH:mm', { locale: zhTW })}</span>
                  <span>{startOrder.passengerName}</span>
                  <span>{startOrder.passengerCount}人 / {startOrder.luggageCount}行李</span>
                  {startOrder.flightNumber && <span className="bg-[#F4EFE9] px-1.5 py-0.5 rounded font-mono-nums">{startOrder.flightNumber}</span>}
                </div>
              </div>
            </div>
          )}

          {/* 排班時間軸預覽 */}
          {scheduleResult.timeline.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-[#78716C]" />
                <p className="text-[11px] text-[#78716C] uppercase tracking-wider font-medium">排班預覽</p>
              </div>
              <div className="relative bg-[#FAFAFA] rounded-xl p-3 sm:p-4 border border-[#EBEBEB]">
                {scheduleResult.timeline.map((node, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 relative">
                    {idx > 0 && (
                      <div className="absolute left-[14px] top-0 bottom-0 w-px bg-[#DDDDDD]" style={{ height: 'calc(100% + 8px)', top: '-8px' }} />
                    )}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 z-10 ${
                      node.isTrigger ? 'bg-[#F59E0B]' : 'bg-[#0C447C]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${node.isTrigger ? 'text-[#222222]' : 'text-[#717171]'}`}>
                        {node.label}
                        {node.waitMinutes && <span className="ml-1 text-[#78716C]">（等候 {node.waitMinutes} 分）</span>}
                        {node.travelMinutes && <span className="ml-1 text-[#78716C]">（行車 {node.travelMinutes} 分）</span>}
                      </p>
                      <p className="text-[11px] text-[#A8A29E] font-mono-nums">
                        {format(parseISO(node.time), 'M/dd HH:mm', { locale: zhTW })}
                      </p>
                    </div>
                    {node.price && (
                      <span className="text-[12px] font-bold font-mono-nums text-[#FF385C] flex-shrink-0">
                        NT${node.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 銜接標籤說明 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '完美銜接', sub: '緩衝充足', color: 'green', level: 'perfect', icon: CheckCircle },
              { label: '需等候', sub: '30-90 分鐘', color: 'blue', level: 'ok', icon: AlertTriangle },
              { label: '時間較趕', sub: '請注意', color: 'red', level: 'tight', icon: XCircle },
            ].map(item => (
              <div key={item.level} className={`flex items-center gap-1.5 px-3 py-2 bg-${item.color}-50 border border-${item.color}-200 rounded-lg`}>
                <item.icon className={`w-3.5 h-3.5 text-${item.color}-600 flex-shrink-0`} />
                <div>
                  <p className={`text-[11px] font-bold text-${item.color}-700`}>{item.label}</p>
                  <p className={`text-[10px] text-${item.color}-600`}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 推薦接機 / 空車順路單（主推薦） */}
          {(mainRecs.length > 0 || nextRecs.length > 0) ? (
            <>
              {mainRecs.length > 0 && (
                <div>
                  <p className="text-[11px] text-[#78716C] uppercase tracking-wider mb-2 font-medium">推薦銜接</p>
                  <div className="space-y-2">
                    {mainRecs.map((rec) => {
                      const tc = getTightnessColor(rec.tightnessLevel)
                      const isSelected = selectedScheduleOrders.includes(rec.id)
                      const typeInfo = renderOrderBadge(rec.type)
                      return (
                        <div
                          key={rec.id}
                          className={`border rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-[#F59E0B] bg-[#FFF7ED] shadow-[0_2px_8px_rgba(245,158,11,0.15)]'
                              : 'border-[#DDDDDD] hover:border-[#F59E0B]/50 hover:bg-[#FAFAFA]'
                          }`}
                          onClick={() => onToggleOrder(rec.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${isSelected ? 'bg-[#F59E0B] border-[#F59E0B]' : 'border-[#DDDDDD]'}`}>
                                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 bg-[#1C1917] text-white text-[12px] font-bold font-mono-nums rounded">
                                #{rec.orderSeq.toString().padStart(4, '0')}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-bold font-mono-nums rounded" style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}>
                                {typeInfo.label}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
                                {vehicleLabel(rec.vehicle)}
                              </span>
                              {rec.kenichiRequired && (
                                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">肯驛</span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-[18px] font-bold font-mono-nums text-[#FF385C] leading-none">NT${rec.price.toLocaleString()}</p>
                              <p className="text-[10px] text-[#78716C] mt-0.5 font-mono-nums">平台費 -{Math.floor(rec.price * PLATFORM_FEE_RATE)} 點</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[14px] font-bold font-mono-nums text-[#222222]">
                              {format(parseISO(rec.scheduledTime), 'M/dd HH:mm', { locale: zhTW })}
                            </span>
                            {rec.flightNumber && (
                              <span className="px-1.5 py-0.5 rounded bg-[#F4EFE9] text-[11px] font-mono-nums text-[#717171]">{rec.flightNumber}</span>
                            )}
                            {rec.waitMinutes !== undefined && (
                              <span className="text-[11px] text-[#78716C]">等候 <span className="font-bold font-mono-nums text-[#222222]">{rec.waitMinutes}</span> 分</span>
                            )}
                          </div>
                          <div className="flex items-start gap-2 mb-2 text-[13px] text-[#717171]">
                            <span className="font-medium text-[#222222] truncate">{rec.pickupLocation}</span>
                            <span className="text-[#DDDDDD] flex-shrink-0 mt-0.5"><ArrowRight className="w-3 h-3" /></span>
                            <span className="font-medium text-[#222222] truncate">{rec.dropoffLocation}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded ${tc.bg} ${tc.text} border ${tc.border}`}>
                                <tc.icon className="w-3 h-3" />
                                {rec.tightnessLabel}
                              </span>
                              {rec.reason && <p className="text-[12px] text-[#B45309] italic">{rec.reason}</p>}
                            </div>
                            {isSelected && <span className="text-[12px] font-bold text-[#B45309]">已選擇</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 空車順路單（nextRecommendations） */}
              {nextRecs.length > 0 && (
                <div>
                  <p className="text-[11px] text-[#78716C] uppercase tracking-wider mb-2 font-medium">空車順路單</p>
                  <div className="space-y-2">
                    {nextRecs.map((rec) => {
                      const isSelected = selectedScheduleOrders.includes(rec.id)
                      return (
                        <div
                          key={rec.id}
                          className={`border rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                            isSelected ? 'border-[#F59E0B] bg-[#FFF7ED] shadow-[0_2px_8px_rgba(245,158,11,0.15)]' : 'border-[#DDDDDD] hover:border-[#F59E0B]/50'
                          }`}
                          onClick={() => onToggleOrder(rec.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-[#F59E0B] border-[#F59E0B]' : 'border-[#DDDDDD]'}`}>
                                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 bg-[#1C1917] text-white text-[12px] font-bold font-mono-nums rounded">
                                #{rec.orderSeq.toString().padStart(4, '0')}
                              </span>
                              <span className="text-[13px] font-bold font-mono-nums text-[#222222]">
                                {format(parseISO(rec.scheduledTime), 'M/dd HH:mm', { locale: zhTW })}
                              </span>
                            </div>
                            <span className="text-[16px] font-bold font-mono-nums text-[#FF385C]">NT${rec.price.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 ml-7">
                            <Clock className="w-3 h-3 text-[#78716C]" />
                            <span className="text-[12px] text-[#717171]">
                              {rec.emptyDriveMinutes !== undefined ? `空車回程 ${rec.emptyDriveMinutes} 分鐘` : '空車順路可接'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-[#F5F4F0] border border-[#DDDDDD] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-[#D6D3D1]" />
              </div>
              <p className="text-[14px] text-[#78716C] font-medium">目前沒有合適的{filteredScheduleRecs.label}</p>
              <p className="text-[12px] text-[#A8A29E] mt-1">
                {scheduleResult.availableCount > 0
                  ? `接單大廳有 ${scheduleResult.availableCount} 單，但${filteredScheduleRecs.label.replace('推薦', '')}時間無法銜接`
                  : '接單大廳目前沒有訂單'}
              </p>
            </div>
          )}

          {/* 總收入預估 + 確認排單按鈕 */}
          {mainRecs.length > 0 && (
            <div className="bg-[#FAFAFA] border border-[#EBEBEB] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[12px] text-[#717171]">已選訂單</p>
                  <p className="text-[18px] font-bold font-mono-nums text-[#222222]">{selectedScheduleOrders.length} 單</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-[#717171]">總收入預估</p>
                  <p className="text-[18px] font-bold font-mono-nums text-[#008A05]">
                    NT${((scheduleResult.currentOrder?.price ?? startOrder?.price ?? 0) +
                      mainRecs.filter(r => selectedScheduleOrders.includes(r.id)).reduce((sum, r) => sum + r.price, 0)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-[#78716C] space-y-0.5 mb-3">
                <p>每單扣除 5% 平台費</p>
                <p>接單成功後，可再次點「智慧排單」繼續推薦銜接訂單（最多 6 單）</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClear}
                  className="flex-1 py-3 border border-[#DDDDDD] text-[#717171] text-[14px] font-bold rounded-xl hover:border-[#222222] hover:text-[#222222] transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={onConfirmSchedule}
                  disabled={selectedScheduleOrders.length === 0 || scheduleConfirming}
                  className="flex-[2] py-3 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-[14px] font-bold rounded-xl hover:shadow-[0_2px_8px_rgba(245,158,11,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {scheduleConfirming ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {scheduleConfirming ? '確認中...' : `確認排單（${selectedScheduleOrders.length} 單）`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
