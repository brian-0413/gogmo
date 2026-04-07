import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/Button"
import { HeroCarousel } from "@/components/HeroCarousel"
import { DataWall } from "@/components/DataWall"
import { Plane } from "lucide-react"

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
