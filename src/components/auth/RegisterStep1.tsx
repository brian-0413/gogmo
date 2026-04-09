'use client'
import { Car, Building2 } from 'lucide-react'

interface RegisterStep1Props {
  onSelect: (role: 'DRIVER' | 'DISPATCHER') => void
}

export function RegisterStep1({ onSelect }: RegisterStep1Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-medium text-[#222222] text-center">選擇您的身份</h2>
      <p className="text-[13px] text-[#717171] text-center">請選擇您要註冊的身份類型</p>

      <div className="grid grid-cols-2 gap-4 pt-2">
        {/* Driver card */}
        <button
          onClick={() => onSelect('DRIVER')}
          className="group p-6 rounded-xl border-2 border-[#DDDDDD] bg-white hover:border-[#0C447C] hover:bg-[#E6F1FB] transition-all text-center"
        >
          <div className="w-16 h-16 rounded-full bg-[#E6F1FB] border-2 border-[#C2DBF5] flex items-center justify-center mx-auto mb-3 group-hover:bg-[#0C447C] group-hover:border-[#0C447C] transition-colors">
            <Car className="w-8 h-8 text-[#0C447C] group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-[15px] font-medium text-[#222222] mb-1">司機</h3>
          <p className="text-[11px] text-[#717171] leading-snug">以車牌為帳號<br />一車一帳號</p>
        </button>

        {/* Dispatcher card */}
        <button
          onClick={() => onSelect('DISPATCHER')}
          className="group p-6 rounded-xl border-2 border-[#DDDDDD] bg-white hover:border-[#FF385C] hover:bg-[#FFF3E0] transition-all text-center"
        >
          <div className="w-16 h-16 rounded-full bg-[#FFF3E0] border-2 border-[#FFE0B2] flex items-center justify-center mx-auto mb-3 group-hover:bg-[#FF385C] group-hover:border-[#FF385C] transition-colors">
            <Building2 className="w-8 h-8 text-[#B45309] group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-[15px] font-medium text-[#222222] mb-1">派單方</h3>
          <p className="text-[11px] text-[#717171] leading-snug">管理車隊<br />發布訂單</p>
        </button>
      </div>
    </div>
  )
}
