import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/Button"
import { HeroCarousel } from "@/components/HeroCarousel"
import { DataWall } from "@/components/DataWall"
import { Plane, ArrowRight, Zap, Brain, Smartphone, Wallet, Scan, ListChecks, TrendingDown, Clock, Users } from "lucide-react"

export default async function Home() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#222222]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAF8F5] border-b border-[#DDDDDD]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF385C] flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="text-[#222222] font-bold">goGMO</span>
            </Link>
            <div className="flex items-center gap-8">
              <a href="#driver" className="text-sm text-[#717171] hover:text-[#222222] transition-colors">司機服務</a>
              <a href="#dispatcher" className="text-sm text-[#717171] hover:text-[#222222] transition-colors">派單方服務</a>
            </div>
            <Link href="/login">
              <Button size="sm" className="text-[13px]">登入</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Cards */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Card A — Carousel */}
            <div className="bg-white rounded-3xl min-h-[520px] overflow-hidden shadow-sm">
              <HeroCarousel />
            </div>

            {/* Card B — Data Wall */}
            <div className="bg-white rounded-3xl min-h-[520px] overflow-hidden shadow-sm">
              <DataWall />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section id="driver" className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="mb-12">
            <span className="text-[11px] font-semibold text-[#FF385C] uppercase tracking-widest">服務特色</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#222222] mt-2">司機的接單樂園</h2>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Feature 01 */}
            <div className="relative p-6 bg-[#FAF8F5] rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-10 select-none">01</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E6F1FB] flex items-center justify-center">
                    <Brain className="w-4 h-4 text-[#0C447C]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">AI 智能排班推薦</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  系統自動分析航班動態，智能推薦銜接訂單，司機一趟賺兩趟，效率最大化
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#0C447C] text-white text-[10px] font-medium rounded-full">接機接駁</span>
                  <span className="px-2 py-0.5 bg-[#0C447C] text-white text-[10px] font-medium rounded-full">送機銜接</span>
                  <span className="px-2 py-0.5 bg-[#0C447C] text-white text-[10px] font-medium rounded-full">地理優化</span>
                </div>
              </div>
            </div>

            {/* Feature 02 */}
            <div className="relative p-6 bg-[#FAF8F5] rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-10 select-none">02</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF3E0] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">3 秒即時推播</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  新訂單上架 3 秒內推播到所有司機手機，先搶先贏，零時差接單
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded-full">SSE 即時</span>
                  <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded-full">先搶先贏</span>
                </div>
              </div>
            </div>

            {/* Feature 03 */}
            <div className="relative p-6 bg-[#FAF8F5] rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-10 select-none">03</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F0FFF4] flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-[#008A05]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">手機一鍵完成</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  抵達、開始、客上、客下，四步完成行程，司機不需要任何複雜操作
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#008A05] text-white text-[10px] font-medium rounded-full">四鍵完成</span>
                  <span className="px-2 py-0.5 bg-[#008A05] text-white text-[10px] font-medium rounded-full">自動同步</span>
                </div>
              </div>
            </div>

            {/* Feature 04 */}
            <div className="relative p-6 bg-[#FAF8F5] rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-10 select-none">04</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-[#7C3AED]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">帳務管理中心</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  每筆車資自動結算，點數餘額即時查詢，司機輕鬆對帳不求人
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#7C3AED] text-white text-[10px] font-medium rounded-full">自動結算</span>
                  <span className="px-2 py-0.5 bg-[#7C3AED] text-white text-[10px] font-medium rounded-full">歷史查詢</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dispatcher Features */}
      <section id="dispatcher" className="py-16 px-6 bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <span className="text-[11px] font-semibold text-[#FF385C] uppercase tracking-widest">服務特色</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#222222] mt-2">派單方的派單天堂</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Feature 01 */}
            <div className="relative p-6 bg-white rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-[0.07] select-none">01</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF3E0] flex items-center justify-center">
                    <Scan className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">AI 智慧解析多筆行程</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  從 LINE 群組複製文字，AI 自動解析航班、時間、地點、金額，多筆行程一次生成
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded-full">一鍵解析</span>
                  <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded-full">批量生成</span>
                </div>
              </div>
            </div>

            {/* Feature 02 */}
            <div className="relative p-6 bg-white rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-[0.07] select-none">02</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E6F1FB] flex items-center justify-center">
                    <ListChecks className="w-4 h-4 text-[#0C447C]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">行控中心即時掌握</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  所有訂單狀態一目了然，司機抵達、開始、接送即時通知，零死角掌控行程
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#0C447C] text-white text-[10px] font-medium rounded-full">進度追蹤</span>
                  <span className="px-2 py-0.5 bg-[#0C447C] text-white text-[10px] font-medium rounded-full">即時通知</span>
                </div>
              </div>
            </div>

            {/* Feature 03 */}
            <div className="relative p-6 bg-white rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-[0.07] select-none">03</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F0FFF4] flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#008A05]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">帳務結算效率升級</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  每日對帳單自動生成，待轉帳金額一目了然，轉帳後司機即時收到通知
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#008A05] text-white text-[10px] font-medium rounded-full">自動對帳</span>
                  <span className="px-2 py-0.5 bg-[#008A05] text-white text-[10px] font-medium rounded-full">轉帳通知</span>
                </div>
              </div>
            </div>

            {/* Feature 04 */}
            <div className="relative p-6 bg-white rounded-2xl overflow-hidden">
              <span className="absolute top-4 right-4 text-6xl font-black text-[#FF385C] opacity-[0.07] select-none">04</span>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-[#7C3AED]" />
                  </div>
                  <span className="text-sm font-bold text-[#222222]">有效降低成本</span>
                </div>
                <p className="text-[13px] text-[#717171] leading-relaxed mb-3">
                  司機自行墊付油錢，平台抽成透明公開，派單方成本可控、效率提升
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-[#7C3AED] text-white text-[10px] font-medium rounded-full">透明抽成</span>
                  <span className="px-2 py-0.5 bg-[#7C3AED] text-white text-[10px] font-medium rounded-full">成本可控</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 px-6 bg-[#1C1917]">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            準備好加入 goGMO 了嗎？
          </h2>
          <p className="text-[#A8A29E] text-[14px] mb-8 max-w-md mx-auto">
            立即註冊，告別 LINE 群組的混亂，享受智能派單的便利
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg" className="bg-[#FF385C] hover:bg-[#E83355] text-white w-full sm:w-auto text-[14px] gap-2">
                立即註冊
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-[#44403C] text-[#A8A29E] hover:bg-[#27272A] hover:text-white w-full sm:w-auto text-[14px]">
                登入系統
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#717171]" />
              <span className="text-[12px] text-[#717171]">免費加入</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[#717171]" />
              <span className="text-[12px] text-[#717171]">無月費</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#717171]" />
              <span className="text-[12px] text-[#717171]">3 分鐘上手</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-5 px-6 border-t border-[#DDDDDD] bg-[#F4EFE9]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#FF385C] flex items-center justify-center">
              <Plane className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-[#717171]">goGMO</span>
          </div>
          <p className="text-[11px] text-[#B0B0B0]">
            2026 Airport Dispatch Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
