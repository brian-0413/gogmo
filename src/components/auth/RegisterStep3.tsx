'use client'

const VEHICLE_SIZE_OPTIONS = [
  { value: 'small_sedan', label: '5人座（小車/轎車）' },
  { value: 'small_suv', label: '5人座（休旅/SUV）' },
  { value: 'van7', label: '7人座' },
  { value: 'van9', label: '9人座' },
]

export interface Step3Data {
  licensePlate: string
  carBrand: string
  carModel: string
  carColor: string
  vehicleSize: string
}

interface RegisterStep3Props {
  data: Step3Data
  onChange: (data: Step3Data) => void
  onNext: () => void
  onBack: () => void
}

export function RegisterStep3({ data, onChange, onNext, onBack }: RegisterStep3Props) {
  const canProceed = data.licensePlate.trim() && data.vehicleSize

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, licensePlate: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })
  }

  const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, carBrand: e.target.value.toUpperCase() })
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, carModel: e.target.value.toUpperCase() })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-medium text-[#222222] text-center">填寫車輛資料</h2>
      <p className="text-[13px] text-[#717171] text-center">車牌號碼即為您的登入帳號</p>

      <div className="space-y-3 pt-2">
        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">車牌號碼（= 帳號）</label>
          <input
            type="text"
            value={data.licensePlate}
            onChange={handlePlateChange}
            placeholder="ABC-1234"
            maxLength={10}
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222] font-mono-nums"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">車廠 / 品牌</label>
          <input
            type="text"
            value={data.carBrand}
            onChange={handleBrandChange}
            placeholder="TOYOTA"
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">車型 / 型號</label>
          <input
            type="text"
            value={data.carModel}
            onChange={handleModelChange}
            placeholder="CAMRY"
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">車色</label>
          <input
            type="text"
            value={data.carColor}
            onChange={e => onChange({ ...data, carColor: e.target.value })}
            placeholder="白、黑、銀"
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#222222]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-[#717171] font-normal">車型（載客數）</label>
          <select
            value={data.vehicleSize}
            onChange={e => onChange({ ...data, vehicleSize: e.target.value })}
            className="w-full bg-white border border-[#DDDDDD] rounded-lg px-3 py-2.5 text-[#222222] text-sm focus:outline-none focus:border-[#222222]"
          >
            <option value="">請選擇車型</option>
            {VEHICLE_SIZE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-[#DDDDDD] text-[#717171] hover:bg-[#F7F7F7] h-11 rounded-lg text-sm transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 bg-[#FF385C] hover:bg-[#D70466] text-white font-medium h-11 rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          下一步
        </button>
      </div>
    </div>
  )
}
