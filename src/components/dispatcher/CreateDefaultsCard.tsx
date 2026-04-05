'use client'

import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Calendar, FileText } from 'lucide-react'

// VEHICLE_OPTIONS — 從 page.tsx 行 73-76 複製
const VEHICLE_OPTIONS = [
  '任意車', '小車', '休旅', '7人座', '9人座', 'VITO', 'GRANVIA', '自填',
] as const

// DATE_OPTIONS — 動態生成，與 page.tsx 行 51-60 相同邏輯
const DATE_OPTIONS = [
  { value: '', label: '選擇日期...' },
]
for (let i = 0; i <= 14; i++) {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const dateStr = format(d, 'yyyy-MM-dd')
  const dayLabel = i === 0 ? '今天' : i === 1 ? '明天' : format(d, 'M/d (EEE)', { locale: zhTW })
  DATE_OPTIONS.push({ value: dateStr, label: dayLabel })
}

interface CreateDefaultsCardProps {
  defaults: {
    date?: string
    vehicle?: string
    vehicleCustom?: string
    kenichiRequired?: boolean
  }
  onChange: (defaults: CreateDefaultsCardProps['defaults']) => void
}

export function CreateDefaultsCard({ defaults, onChange }: CreateDefaultsCardProps) {
  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
      {/* 卡片標題 */}
      <div className="px-5 py-4 border-b border-[#DDDDDD] flex items-center gap-3">
        <FileText className="w-4 h-4 text-[#717171]" />
        <div>
          <h3 className="text-[18px] font-medium text-[#222222]">派單中心 — AI 智能解析</h3>
          <p className="text-[13px] text-[#717171]">選擇日期與車型，AI 自動解析訂單文字</p>
        </div>
      </div>
      {/* 內容 */}
      <div className="p-5 space-y-5">
        {/* 日期選擇 */}
        <div className="space-y-2">
          <label className="text-[11px] text-[#717171] font-normal">日期（必選）</label>
          <div className="relative">
            <select
              value={defaults.date || ''}
              onChange={(e) => onChange({ ...defaults, date: e.target.value })}
              className="w-full bg-white border border-[#DDDDDD] rounded-lg pl-10 pr-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222] cursor-pointer font-mono-nums"
            >
              {DATE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171] pointer-events-none" />
          </div>
        </div>

        {/* 車型選擇 */}
        <div className="space-y-2">
          <label className="text-[11px] text-[#717171] font-normal">車型（整批套用）</label>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_OPTIONS.filter(v => v !== '自填').map(v => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ ...defaults, vehicle: v, vehicleCustom: '' })}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-normal transition-colors ${
                  defaults.vehicle === v
                    ? 'bg-[#FF385C] text-white'
                    : 'bg-white text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
                }`}
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange({ ...defaults, vehicle: '自填' })}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-normal transition-colors ${
                defaults.vehicle === '自填'
                  ? 'bg-[#FF385C] text-white'
                  : 'bg-white text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
              }`}
            >
              自填
            </button>
          </div>
          {defaults.vehicle === '自填' && (
            <input
              type="text"
              value={defaults.vehicleCustom || ''}
              onChange={(e) => onChange({ ...defaults, vehicleCustom: e.target.value })}
              placeholder="輸入車型"
              className="mt-1 bg-white border border-[#DDDDDD] rounded-lg px-3 py-2 text-[#222222] text-sm focus:outline-none focus:border-[#222222] w-full max-w-xs"
            />
          )}
        </div>

        {/* 肯驛 toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...defaults, kenichiRequired: !defaults.kenichiRequired })}
            className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${
              defaults.kenichiRequired ? 'bg-[#6B21A8] border-[#6B21A8]' : 'bg-white border-[#DDDDDD]'
            }`}
          >
            {defaults.kenichiRequired && (
              <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <span className="text-[13px] text-[#6B21A8]">肯驛系統</span>
          <span className="text-[13px] text-[#717171]">（整批標記）</span>
        </div>
      </div>
    </div>
  )
}
