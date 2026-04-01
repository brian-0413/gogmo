'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Search, Wifi, WifiOff, Coffee, Phone, MapPin, Users } from 'lucide-react'

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
    dot: '#008A05',
    bg: 'bg-[#E8F5E8]',
    text: 'text-[#008A05]',
    border: 'border-[#DDDDDD]',
    tagBg: 'bg-[#E8F5E8]',
  },
  OFFLINE: {
    label: '離線',
    icon: WifiOff,
    dot: '#717171',
    bg: 'bg-[#F7F7F7]',
    text: 'text-[#717171]',
    border: 'border-[#DDDDDD]',
    tagBg: 'bg-[#F7F7F7]',
  },
  BUSY: {
    label: '忙碌中',
    icon: Coffee,
    dot: '#B45309',
    bg: 'bg-[#FFF3E0]',
    text: 'text-[#B45309]',
    border: 'border-[#DDDDDD]',
    tagBg: 'bg-[#FFF3E0]',
  },
} as const

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
    { label: '在線司機', value: online, color: '#008A05' },
    { label: '忙碌中', value: busy, color: '#B45309' },
    { label: '離線司機', value: offline, color: '#717171' },
    { label: '車隊總計', value: total, color: '#222222' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-[#F7F7F7] rounded-xl p-4">
          <p className="text-[11px] text-[#717171] mb-1">{stat.label}</p>
          <p className="text-[22px] font-medium text-[#222222] font-mono-nums leading-none">
            {stat.value}
            <span className="text-sm font-normal text-[#717171] ml-1">/{total}</span>
          </p>
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
    <div className={`bg-white border rounded-xl p-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200 ${config.border}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium text-[#222222] border border-[#DDDDDD] font-mono-nums"
            style={{ backgroundColor: `${config.dot}10` }}
          >
            {vehicleTag}
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#222222]">{driver.user.name}</h3>
            <p className="text-[11px] text-[#717171] font-mono-nums">{driver.user.phone}</p>
          </div>
        </div>

        <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${config.tagBg} ${config.text} ${config.border}`}>
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </div>
      </div>

      {/* Vehicle info */}
      <div className="mb-3 p-2.5 bg-[#F7F7F7] rounded-lg border border-[#DDDDDD]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 bg-[#F7F7F7] border border-[#DDDDDD] rounded text-[11px] font-medium text-[#222222] font-mono-nums">
              {driver.licensePlate || '----'}
            </div>
            <span className="text-[13px] text-[#717171]">{driver.carColor} {driver.carType}</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[12px] font-normal text-[#717171] bg-[#F7F7F7] rounded-lg border border-[#DDDDDD] hover:bg-[#EBEBEB] transition-colors"
          onClick={() => window.open(`tel:${driver.user.phone}`)}
        >
          <Phone className="w-3 h-3" />
          致電
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[12px] font-normal text-[#717171] bg-[#F7F7F7] rounded-lg border border-[#DDDDDD] hover:bg-[#EBEBEB] transition-colors"
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
      <div className="flex items-center gap-1 p-1 bg-[#F7F7F7] border border-[#DDDDDD] rounded-lg">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-normal transition-colors ${
              filter === f.key
                ? 'bg-[#222222] text-white'
                : 'text-[#717171] hover:bg-[#EBEBEB]'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[11px] font-mono-nums ${filter === f.key ? 'opacity-70' : 'text-[#B0B0B0]'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#717171]" />
        <input
          type="text"
          placeholder="搜尋車牌、司機名稱..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-[#DDDDDD] rounded-lg text-[13px] text-[#222222] placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] font-mono-nums"
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
        <Users className="w-10 h-10 text-[#B0B0B0] mb-3" />
        <h3 className="text-lg font-medium text-[#717171] mb-1">車隊尚無司機</h3>
        <p className="text-sm text-[#B0B0B0]">邀請司機加入後即可在此管理車隊</p>
      </div>
    )
  }

  return (
    <div>
      <FleetStats drivers={drivers} />
      <FilterBar drivers={drivers} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-[#717171] text-sm">找不到符合條件的司機</p>
          </div>
        ) : (
          filtered.map(driver => (
            <DriverCard key={driver.id} driver={driver} />
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-[#B0B0B0]">
        <span className="font-mono-nums">顯示 {filtered.length} / {drivers.length} 位司機</span>
        <span className="font-mono-nums">行控中心 {format(new Date(), 'HH:mm')} 更新</span>
      </div>
    </div>
  )
}
