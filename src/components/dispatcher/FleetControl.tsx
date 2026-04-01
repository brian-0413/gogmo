'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, Radio, Wifi, WifiOff, Coffee, Phone, MapPin, Clock, TrendingUp, Users } from 'lucide-react'

interface Driver {
  id: string
  status: string
  licensePlate: string
  carType: string
  carColor: string
  user: { name: string; phone: string }
}

interface FleetControlProps {
  drivers: Driver[]
}

const STATUS_CONFIG = {
  ONLINE: {
    label: '在線',
    icon: Wifi,
    dot: '#22c55e',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.3)]',
    border: 'border-[#22c55e]/25',
    bg: 'bg-[#22c55e]/8',
    text: 'text-[#22c55e]',
  },
  OFFLINE: {
    label: '離線',
    icon: WifiOff,
    dot: '#4a4a52',
    glow: '',
    border: 'border-[#1e1e26]',
    bg: 'bg-[#141418]',
    text: 'text-[#6b6560]',
  },
  BUSY: {
    label: '忙碌中',
    icon: Coffee,
    dot: '#f59e0b',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]',
    border: 'border-[#f59e0b]/25',
    bg: 'bg-[#f59e0b]/8',
    text: 'text-[#f59e0b]',
  },
} as const

const VEHICLE_TYPE_ICONS: Record<string, string> = {
  '小車': 'S',
  '休旅': 'S',
  '7人座': 'V',
  '9人座': 'V',
  'VAN': 'V',
  'default': '?',
}

function getVehicleTag(carType: string): string {
  const t = carType?.toUpperCase() || ''
  if (t.includes('VAN') || t.includes('9') || t.includes('七') || t.includes('VITO')) return '9S'
  if (t.includes('休') || t.includes('SUV') || t.includes('GRANVIA')) return 'SUV'
  if (t.includes('小') || t.includes('轎')) return '5S'
  return carType?.slice(0, 4) || '—'
}

function FleetStats({ drivers }: { drivers: Driver[] }) {
  const online = drivers.filter(d => d.status === 'ONLINE').length
  const busy = drivers.filter(d => d.status === 'BUSY').length
  const offline = drivers.filter(d => d.status === 'OFFLINE').length
  const total = drivers.length

  const stats = [
    {
      label: '在線司機',
      value: online,
      total,
      color: '#22c55e',
      bar: online / Math.max(total, 1),
    },
    {
      label: '忙碌中',
      value: busy,
      total,
      color: '#f59e0b',
      bar: busy / Math.max(total, 1),
    },
    {
      label: '離線司機',
      value: offline,
      total,
      color: '#4a4a52',
      bar: offline / Math.max(total, 1),
    },
    {
      label: '車隊總計',
      value: total,
      color: '#ff6b2b',
      bar: 1,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="relative overflow-hidden bg-[#0c0c10] border border-[#1e1e26] rounded-xl p-4 group hover:border-[#ff6b2b]/20 transition-colors duration-300"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${stat.color}60, transparent)` }} />

          {/* Background number */}
          <div
            className="absolute right-2 bottom-0 text-[56px] font-black leading-none opacity-[0.04] select-none font-mono-nums"
            style={{ color: stat.color }}
          >
            {stat.value}
          </div>

          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stat.color, boxShadow: `0 0 6px ${stat.color}80` }} />
              <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: stat.color }}>
                {stat.label}
              </span>
            </div>
            <div className="text-3xl font-bold text-[#f0ebe3] font-mono-nums leading-none mb-2">
              {stat.value}
              <span className="text-sm font-normal text-[#6b6560] ml-1">/{total}</span>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 bg-[#141418] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${stat.bar * 100}%`, backgroundColor: stat.color, boxShadow: `0 0 6px ${stat.color}40` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DriverCard({ driver }: { driver: Driver }) {
  const config = STATUS_CONFIG[driver.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.OFFLINE
  const StatusIcon = config.icon
  const vehicleTag = getVehicleTag(driver.carType)

  return (
    <div
      className={`relative overflow-hidden bg-[#0c0c10] border rounded-xl p-4 transition-all duration-200 hover:border-[#ff6b2b]/20 group hover:bg-[#0c0c10]/80 ${config.border}`}
    >
      {/* Live status bar */}
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ backgroundColor: config.dot, boxShadow: `0 0 8px ${config.dot}` }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        {/* Driver identity */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black border text-[#f0ebe3] font-mono-nums"
            style={{
              backgroundColor: `${config.dot}12`,
              borderColor: `${config.dot}30`,
            }}
          >
            {vehicleTag}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-[#f0ebe3]">{driver.user.name}</h3>
              {(driver.status === 'ONLINE' || driver.status === 'BUSY') && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: config.dot }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: config.dot }} />
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#6b6560] font-mono-nums">{driver.user.phone}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${config.bg} ${config.text} ${config.border}`}>
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </div>
      </div>

      {/* Vehicle info */}
      <div className="mb-3 p-2.5 bg-[#141418] rounded-lg border border-[#1e1e26]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-[#ff6b2b]/10 border border-[#ff6b2b]/20 rounded text-[9px] font-black text-[#ff6b2b] flex items-center justify-center font-mono-nums">
              {driver.licensePlate?.slice(-4) || '----'}
            </div>
            <span className="text-xs text-[#6b6560]">{driver.carColor} {driver.carType}</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium bg-[#ff6b2b]/10 text-[#ff6b2b] rounded-lg border border-[#ff6b2b]/20 hover:bg-[#ff6b2b]/15 transition-colors"
          onClick={() => window.open(`tel:${driver.user.phone}`)}
        >
          <Phone className="w-3 h-3" />
          致電
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium bg-[#141418] text-[#6b6560] rounded-lg border border-[#1e1e26] hover:bg-[#1e1e26] transition-colors"
        >
          <MapPin className="w-3 h-3" />
          定位
        </button>
      </div>
    </div>
  )
}

function FilterBar({ drivers, filter, setFilter, search, setSearch }: {
  drivers: Driver[]
  filter: string
  setFilter: (f: string) => void
  search: string
  setSearch: (s: string) => void
}) {
  const filters = [
    { key: 'all', label: '全部', count: drivers.length },
    { key: 'ONLINE', label: '在線', count: drivers.filter(d => d.status === 'ONLINE').length },
    { key: 'BUSY', label: '忙碌', count: drivers.filter(d => d.status === 'BUSY').length },
    { key: 'OFFLINE', label: '離線', count: drivers.filter(d => d.status === 'OFFLINE').length },
  ]

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
      {/* Status filters */}
      <div className="flex items-center gap-1 p-1 bg-[#0c0c10] border border-[#1e1e26] rounded-lg">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-[#ff6b2b] text-[#060608] font-semibold shadow-[0_0_12px_rgba(255,107,43,0.3)]'
                : 'text-[#6b6560] hover:text-[#f0ebe3] hover:bg-[#141418]'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] font-mono-nums ${filter === f.key ? 'text-[#060608]/60' : 'text-[#4a4a52]'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a4a52]" />
        <input
          type="text"
          placeholder="搜尋車牌、司機名稱..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[#0c0c10] border border-[#1e1e26] rounded-lg text-xs text-[#f0ebe3] placeholder:text-[#3a3a40] focus:outline-none focus:border-[#ff6b2b]/50 bg-[#0c0c10]/80 transition-all"
        />
      </div>
    </div>
  )
}

export function FleetControl({ drivers }: FleetControlProps) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = drivers.filter(d => {
    const matchFilter = filter === 'all' || d.status === filter
    const matchSearch = !search || [
      d.user.name,
      d.user.phone,
      d.licensePlate,
      d.carType,
      d.carColor,
    ].some(field => field?.toLowerCase().includes(search.toLowerCase()))
    return matchFilter && matchSearch
  })

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-[#0c0c10] border border-[#1e1e26] flex items-center justify-center mb-4 relative overflow-hidden">
          <div className="absolute inset-0 dot-matrix opacity-30" />
          <Users className="w-8 h-8 text-[#3a3a40] relative" />
        </div>
        <h3 className="text-lg font-semibold text-[#6b6560] mb-1">車隊尚無司機</h3>
        <p className="text-sm text-[#3a3a40]">邀請司機加入後即可在此管理車隊</p>
      </div>
    )
  }

  return (
    <div>
      {/* Fleet Stats */}
      <FleetStats drivers={drivers} />

      {/* Filters */}
      <FilterBar drivers={drivers} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} />

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-[#6b6560] text-sm">找不到符合條件的司機</p>
          </div>
        ) : (
          filtered.map(driver => (
            <DriverCard key={driver.id} driver={driver} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-[10px] text-[#4a4a52]">
        <span className="font-mono-nums">顯示 {filtered.length} / {drivers.length} 位司機</span>
        <span className="font-mono-nums">行控中心 {format(new Date(), 'HH:mm')} 更新</span>
      </div>
    </div>
  )
}
