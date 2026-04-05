'use client'

import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Sparkles, CheckCircle, AlertTriangle, XCircle, ChevronRight, ArrowRight } from 'lucide-react'

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
}

interface SmartSchedulePanelProps {
  scheduleResult: {
    currentOrders: Array<{ id: string; scheduledTime: string; type: string; status: string; pickupLocation: string; dropoffLocation: string; price: number }>
    currentOrder: { id: string; scheduledTime: string; type: string; pickupLocation: string; dropoffLocation: string; price: number } | null
    availableCount: number
    recommendations: SmartScheduleRecommendation[]
    timeline: Array<{ time: string; label: string; orderId?: string; price?: number; isTrigger?: boolean }>
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
  scheduleResult,
  filteredScheduleRecs,
  selectedScheduleOrders,
  onToggleOrder,
  onConfirmSchedule,
  onClear,
  scheduleConfirming,
}: SmartSchedulePanelProps) {
  if (!scheduleResult) return null

  return (
    <div className="mb-6 bg-white border border-[#DDDDDD] rounded-2xl overflow-hidden shadow-sm">
      {/* 面板標題 */}
      <div className="px-5 py-4 bg-gradient-to-r from-[#FFF7ED] to-[#FFF3E0] border-b border-[#FFE0B2]">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#B45309]" />
          <h3 className="text-[15px] font-semibold text-[#222222]">智慧排班推薦</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#B45309] font-medium">
            最多 6 單
          </span>
        </div>
        <p className="text-[12px] text-[#78716C]">
          {scheduleResult.currentOrder
            ? `依您 ${format(parseISO(scheduleResult.currentOrder.scheduledTime), 'M/dd HH:mm', { locale: zhTW })} 的行程推薦`
            : '依您目前的行程，推薦可銜接的訂單組合'}
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* 當前行程 */}
        {scheduleResult.currentOrder && (
          <div>
            <p className="text-[11px] text-[#78716C] uppercase tracking-wider mb-2 font-medium">觸發行程</p>
            <div className="bg-[#FAFAFA] rounded-xl p-4 border border-[#EBEBEB]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono-nums" style={{
                    backgroundColor: scheduleResult.currentOrder.type === 'pickup' || scheduleResult.currentOrder.type === 'pickup_boat' ? '#E6F1FB' : '#FFF3E0',
                    color: scheduleResult.currentOrder.type === 'pickup' || scheduleResult.currentOrder.type === 'pickup_boat' ? '#0C447C' : '#92400E'
                  }}>
                    {scheduleResult.currentOrder.type === 'pickup' || scheduleResult.currentOrder.type === 'pickup_boat' ? '接機' : '送機'}
                  </span>
                  <span className="text-[13px] font-medium text-[#222222]">
                    {scheduleResult.currentOrder.pickupLocation} → {scheduleResult.currentOrder.dropoffLocation}
                  </span>
                </div>
                <span className="text-[13px] font-bold font-mono-nums text-[#FF385C]">NT${scheduleResult.currentOrder.price.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* 排班時間軸預覽 */}
        {scheduleResult.timeline.length > 0 && (
          <div>
            <p className="text-[11px] text-[#78716C] uppercase tracking-wider mb-2 font-medium">排班預覽</p>
            <div className="relative bg-[#FAFAFA] rounded-xl p-4 border border-[#EBEBEB] space-y-2">
              {scheduleResult.timeline.map((node, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {idx > 0 && (
                    <div className="absolute left-[18px] top-0 bottom-0 w-px bg-[#DDDDDD]" />
                  )}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                    node.isTrigger ? 'bg-[#F59E0B]' : 'bg-[#0C447C]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium truncate ${node.isTrigger ? 'text-[#222222]' : 'text-[#717171]'}`}>
                      {node.label}
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
                  {idx < scheduleResult.timeline.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-[#DDDDDD] flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 銜接緊密度說明 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-green-700">完美銜接</p>
              <p className="text-[10px] text-green-600">緩衝充足</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-amber-700">需等候</p>
              <p className="text-[10px] text-amber-600">30-60 分鐘</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-red-700">時間較趕</p>
              <p className="text-[10px] text-red-600">請注意</p>
            </div>
          </div>
        </div>

        {/* 推薦清單 */}
        {filteredScheduleRecs.recs.length === 0 ? (
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
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#78716C] uppercase tracking-wider font-medium">
                {filteredScheduleRecs.label}（{filteredScheduleRecs.recs.length} 筆）— 按{filteredScheduleRecs.sortHint}排序
              </p>
              <p className="text-[11px] text-[#A8A29E]">
                點選加入排班，最多選 6 單
              </p>
            </div>
            {filteredScheduleRecs.recs.map((rec) => {
              const isSelected = selectedScheduleOrders.includes(rec.id)
              const typeColor = rec.recommendType === 'pickup'
                ? { bg: '#E6F1FB', text: '#0C447C', label: '接機' }
                : { bg: '#FFF3E0', text: '#92400E', label: '送機' }
              const tightnessColor = rec.tightnessLevel === 'perfect'
                ? { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' }
                : rec.tightnessLevel === 'reasonable'
                ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
                : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
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
                      {/* 勾選框 */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                        isSelected ? 'bg-[#F59E0B] border-[#F59E0B]' : 'border-[#DDDDDD]'
                      }`}>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      {/* 單號 */}
                      <span className="inline-flex items-center px-2 py-0.5 bg-[#1C1917] text-white text-[12px] font-bold font-mono-nums rounded">
                        #{rec.orderSeq.toString().padStart(4, '0')}
                      </span>
                      {/* 種類 */}
                      <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-bold font-mono-nums rounded" style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                        {typeColor.label}
                      </span>
                      {/* 車型 */}
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold font-mono-nums rounded bg-[#F4EFE9] text-[#717171]">
                        {rec.vehicle === 'small' ? '小車' : rec.vehicle === 'suv' ? '休旅' : rec.vehicle === 'van9' ? '9人座' : rec.vehicle === 'any' ? '任意' : rec.vehicle === 'any_r' ? '任意R' : '待確認'}
                      </span>
                      {/* 肯驛 */}
                      {rec.kenichiRequired && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold font-mono-nums rounded bg-[#F3E8FF] text-[#6B21A8]">
                          肯驛
                        </span>
                      )}
                    </div>
                    {/* 金額 */}
                    <div className="text-right">
                      <p className="text-[22px] font-bold font-mono-nums text-[#FF385C] leading-none">
                        NT${rec.price.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[#78716C] mt-0.5 font-mono-nums">
                        平台費 -{Math.floor(rec.price * 0.05)} 點
                      </p>
                    </div>
                  </div>

                  {/* 時間 + 路線 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[14px] font-bold font-mono-nums text-[#222222]">
                      {format(parseISO(rec.scheduledTime), 'M/dd HH:mm', { locale: zhTW })}
                    </span>
                    {rec.flightNumber && (
                      <span className="px-1.5 py-0.5 rounded bg-[#F4EFE9] text-[11px] font-mono-nums text-[#717171]">
                        {rec.flightNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 mb-2 text-[13px] text-[#717171]">
                    <span className="font-medium text-[#222222] truncate">{rec.pickupLocation}</span>
                    <span className="text-[#DDDDDD] flex-shrink-0 mt-0.5"><ArrowRight className="w-3 h-3" /></span>
                    <span className="font-medium text-[#222222] truncate">{rec.dropoffLocation}</span>
                  </div>

                  {/* 銜接標籤 + 說明 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded ${tightnessColor.bg} ${tightnessColor.text} border ${tightnessColor.border}`}>
                        {rec.tightnessLabel}
                      </span>
                      {rec.reason && (
                        <p className="text-[12px] text-[#B45309] italic">{rec.reason}</p>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-[12px] font-bold text-[#B45309]">
                        已選擇
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 總收入預估 + 確認按鈕 */}
        {filteredScheduleRecs.recs.length > 0 && (
          <div className="bg-[#FAFAFA] border border-[#EBEBEB] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[12px] text-[#717171]">已選訂單</p>
                <p className="text-[22px] font-bold font-mono-nums text-[#222222]">
                  {selectedScheduleOrders.length} 單
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[#717171]">總收入預估</p>
                <p className="text-[22px] font-bold font-mono-nums text-[#008A05]">
                  NT${((scheduleResult.currentOrder?.price ?? 0) + filteredScheduleRecs.recs
                    .filter(r => selectedScheduleOrders.includes(r.id))
                    .reduce((sum, r) => sum + r.price, 0)
                  ).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-[11px] text-[#78716C] space-y-0.5 mb-3">
              <p>每單扣除 5% 平台費</p>
              <p>接單成功後，可再次點「智慧排班」繼續推薦銜接訂單（最多 6 單）</p>
            </div>
            <button
              onClick={onConfirmSchedule}
              disabled={selectedScheduleOrders.length === 0 || scheduleConfirming}
              className="w-full py-3 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-[15px] font-bold rounded-xl hover:shadow-[0_2px_8px_rgba(245,158,11,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {scheduleConfirming ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {scheduleConfirming ? '確認中...' : `確認排班（${selectedScheduleOrders.length} 單）`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
