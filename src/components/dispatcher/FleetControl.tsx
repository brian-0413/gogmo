'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, Radio, Wifi, WifiOff, Coffee, Phone, MapPin, Clock, TrendingUp, Zap } from 'lucide-react'

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
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.4)]',
    border: 'border-[#22c55e]/30',
    bg: 'bg-[#22c55e]/8',
    text: 'text-[#22c55e]',
  },
  OFFLINE: {
    label: '離線',
    icon: WifiOff,
    dot: '#666',
    glow: '',
    border: 'border-white/5',
    bg: 'bg-white/3',
    text: 'text-[#666]',
  },
  BUSY: {
    label: '忙碌中',
    icon: Coffee,
    dot: '#f59e0b',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
    border: 'border-[#f59e0b]/30',
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
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.25)]',
      bar: online / Math.max(total, 1),
    },
    {
      label: '忙碌中',
      value: busy,
      total,
      color: '#f59e0b',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
      bar: busy / Math.max(total, 1),
    },
    {
      label: '離線司機',
      value: offline,
      total,
      color: '#666',
      glow: '',
      bar: offline / Math.max(total, 1),
    },
    {
      label: '車隊總計',
      value: total,
      color: '#ff8c42',
      glow: 'shadow-[0_0_20px_rgba(255,140,66,0.25)]',
      bar: 1,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={`relative overflow-hidden bg-[#0e0e10] border border-white/8 rounded-lg p-4 ${stat.glow}`}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)` }} />

          {/* Background number */}
          <div
            className="absolute right-2 bottom-1 text-[64px] font-black leading-none opacity-[0.04] select-none"
            style={{ fontFamily: 'monospace', color: stat.color }}
          >
            {stat.value}
          </div>

          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stat.color, boxShadow: `0 0 6px ${stat.color}` }} />
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: stat.color }}>
                {stat.label}
              </span>
            </div>
            <div className="text-3xl font-black text-white font-mono leading-none mb-2">
              {stat.value}
              <span className="text-base font-normal text-[#555] ml-1">/{total}</span>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${stat.bar * 100}%`, backgroundColor: stat.color, boxShadow: `0 0 8px ${stat.color}60` }}
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
      className={`relative overflow-hidden bg-[#0e0e10] border rounded-lg p-4 transition-all duration-200 hover:scale-[1.02] group ${config.border}`}
    >
      {/* Live status bar */}
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ backgroundColor: config.dot, boxShadow: `0 0 10px ${config.dot}` }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        {/* Driver identity */}
        <div className="flex items-center gap-3">
          {/* Avatar / vehicle tag */}
          <div
            className="w-10 h-10 rounded flex items-center justify-center text-xs font-black border text-white"
            style={{
              backgroundColor: `${config.dot}18`,
              borderColor: `${config.dot}40`,
            }}
          >
            {vehicleTag}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-white">{driver.user.name}</h3>
              {/* Pulsing live dot for ONLINE/BUSY */}
              {(driver.status === 'ONLINE' || driver.status === 'BUSY') && (
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: config.dot }}
                  />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: config.dot }} />
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#555] font-mono">{driver.user.phone}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${config.bg} ${config.text} ${config.border}`}>
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </div>
      </div>

      {/* Vehicle info */}
      <div className="mb-3 p-2.5 bg-white/3 rounded border border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-[#ff8c42]/20 border border-[#ff8c42]/40 rounded text-[9px] font-black text-[#ff8c42] flex items-center justify-center font-mono">
              {driver.licensePlate?.slice(-4) || '----'}
            </div>
            <span className="text-xs text-[#a0a0a0]">{driver.carColor} {driver.carType}</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium bg-[#ff8c42]/15 text-[#ff8c42] rounded border border-[#ff8c42]/20 hover:bg-[#ff8c42]/25 transition-colors"
          onClick={() => window.open(`tel:${driver.user.phone}`)}
        >
          <Phone className="w-3 h-3" />
          致電
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium bg-white/5 text-[#a0a0a0] rounded border border-white/10 hover:bg-white/10 transition-colors"
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
      {/* Status filters */}
      <div className="flex items-center gap-1 p-1 bg-[#0e0e10] border border-white/8 rounded-lg">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-[#ff8c42] text-black font-bold shadow-[0_0_12px_rgba(255,140,66,0.4)]'
                : 'text-[#666] hover:text-[#a0a0a0] hover:bg-white/5'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] font-mono ${
              filter === f.key ? 'text-black/60' : 'text-[#444]'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
        <input
          type="text"
          placeholder="搜尋車牌、司機名稱..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[#0e0e10] border border-white/8 rounded-lg text-xs text-[#e0e0e0] placeholder:text-[#444] focus:outline-none focus:border-[#ff8c42]/50 focus:bg-[#0e0e10]/80 transition-all"
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
        <div className="w-16 h-16 rounded-full bg-[#0e0e10] border border-white/8 flex items-center justify-center mb-4">
          <Radio className="w-8 h-8 text-[#333]" />
        </div>
        <h3 className="text-lg font-semibold text-[#555] mb-1">車隊尚無司機</h3>
        <p className="text-sm text-[#333]">邀請司機加入後即可在此管理車隊</p>
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
            <p className="text-[#555] text-sm">找不到符合條件的司機</p>
          </div>
        ) : (
          filtered.map(driver => (
            <DriverCard key={driver.id} driver={driver} />
          ))
        )}
      </div>

      {/* Footer summary */}
      <div className="mt-4 flex items-center justify-between text-[10px] text-[#333]">
        <span>顯示 {filtered.length} / {drivers.length} 位司機</span>
        <span className="font-mono">行控中心 {format(new Date(), 'HH:mm')} 更新</span>
      </div>
    </div>
  )
}
