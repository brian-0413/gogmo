'use client'

import { Calendar, FileText } from 'lucide-react'
import { getDateOptions } from '@/lib/utils'
import { VehicleType, VEHICLE_LABELS, VEHICLE_DROPDOWN_OPTIONS, normalizeVehicleInput } from '@/lib/vehicle'

interface CreateDefaultsCardProps {
  defaults: {
    date?: string
    vehicleType?: VehicleType
    vehicleCustom?: string
    kenichiRequired?: boolean
  }
  onChange: (defaults: CreateDefaultsCardProps['defaults']) => void
}

export function CreateDefaultsCard({ defaults, onChange }: CreateDefaultsCardProps) {
  const selectedVehicle = defaults.vehicleType
  const isCustom = selectedVehicle === VehicleType.CUSTOM

  return (
    <div className="bg-white border border-[#DDDDDD] rounded-xl overflow-hidden">
      {/* 卡片標題 */}
      <div className="px-4 sm:px-5 py-4 border-b border-[#DDDDDD] flex items-center gap-3">
        <FileText className="w-4 h-4 text-[#717171]" />
        <div>
          <h3 className="text-[18px] font-medium text-[#222222]">派單中心 — AI 智能解析</h3>
          <p className="text-[13px] text-[#717171]">選擇日期與車型，AI 自動解析訂單文字</p>
        </div>
      </div>
      {/* 內容 */}
      <div className="p-4 sm:p-5 space-y-5">
        {/* 日期選擇 */}
        <div className="space-y-2">
          <label className="text-[11px] text-[#717171] font-normal">日期（必選）</label>
          <select
            value={defaults.date || ''}
            onChange={(e) => onChange({ ...defaults, date: e.target.value })}
            className="w-full bg-white border border-[#DDDDDD] rounded-lg pl-10 pr-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222] cursor-pointer font-mono-nums"
          >
            {getDateOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Calendar className="w-4 h-4 text-[#717171] inline -mt-8 ml-3 pointer-events-none" />
        </div>

        {/* 車型選擇 */}
        <div className="space-y-2">
          <label className="text-[11px] text-[#717171] font-normal">車型（整批套用）</label>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_DROPDOWN_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...defaults, vehicleType: opt.value as VehicleType, vehicleCustom: '' })}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-normal transition-colors ${
                  selectedVehicle === opt.value
                    ? 'bg-[#FF385C] text-white'
                    : 'bg-white text-[#717171] border border-[#DDDDDD] hover:bg-[#F7F7F7]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isCustom && (
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
