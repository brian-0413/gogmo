'use client'

import { useState, useEffect, useRef } from 'react'

interface SlideContent {
  eyebrow: string
  headline: string
  subheadline: string
  cta: string
  tags: Array<{ color: string; label: string }>
}

const SLIDES: SlideContent[] = [
  {
    eyebrow: '司機服務',
    headline: '來 goGMO 接單，做個自由的司機。',
    subheadline: '告別 LINE 群組的混亂趟訊，所有的行程一目瞭然，隨心所欲接單在你，智慧接續配單有我，我們一起在 goGMO，接有效率的單，開輕鬆的車。',
    cta: '免費加入、自由接單 →',
    tags: [
      { color: '#FF385C', label: '視覺接單' },
      { color: '#22C55E', label: '智慧配單' },
      { color: '#3B82F6', label: '行程管理' },
      { color: '#F59E0B', label: '即時訊息' },
      { color: '#A855F7', label: '帳務管理' },
      { color: '#06B6D4', label: '小隊模式' },
    ],
  },
  {
    eyebrow: '派單方服務',
    headline: '來 goGMO 派單，做個聰明的車頭。',
    subheadline: '有單派不出？LINE 帳號後總是接著「有群拉我」？有人喊單要先檢查三證？今天起讓我們告別派單地獄，歡迎來到 goGMO，車頭的救星，調度的希望。',
    cta: '免費加入、聰明派單 →',
    tags: [
      { color: '#FF385C', label: '一鍵派單' },
      { color: '#22C55E', label: '行程管理' },
      { color: '#3B82F6', label: '進度追蹤' },
      { color: '#F59E0B', label: '即時訊息' },
      { color: '#A855F7', label: '帳務管理' },
      { color: '#06B6D4', label: '效率升級' },
    ],
  },
]

export function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  const goTo = (target: number) => {
    if (animating || target === current) return
    setAnimating(true)

    // Exit current slide to the right
    const currentEl = slideRefs.current[current]
    if (currentEl) {
      currentEl.style.transform = 'translateX(100%)'
      currentEl.style.opacity = '0'
      currentEl.classList.remove('active')
    }

    // Enter target slide from the left
    const targetEl = slideRefs.current[target]
    if (targetEl) {
      targetEl.style.transform = 'translateX(-100%)'
      targetEl.style.opacity = '0'
      targetEl.classList.add('active')
      void targetEl.offsetWidth
      targetEl.style.transform = 'translateX(0)'
      targetEl.style.opacity = '1'
    }

    setCurrent(target)
    setTimeout(() => setAnimating(false), 500)
  }

  const next = () => goTo((current + 1) % SLIDES.length)
  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length)

  useEffect(() => {
    // Init positions
    slideRefs.current.forEach((el, i) => {
      if (el) {
        el.style.transition = 'none'
        el.style.transform = i === 0 ? 'translateX(0)' : 'translateX(-100%)'
        el.style.opacity = i === 0 ? '1' : '0'
        if (i === 0) el.classList.add('active')
        setTimeout(() => { if (el) el.style.transition = '' }, 20)
      }
    })

    // Auto-play
    timerRef.current = setInterval(() => {
      goTo((current + 1) % SLIDES.length)
    }, 4000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-full flex flex-col justify-center px-10 py-12">
      {/* Decorative circle */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(255,56,92,0.06),transparent)] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      {/* Slides */}
      <div className="relative flex-1 flex flex-col justify-center overflow-hidden">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            ref={el => { slideRefs.current[i] = el }}
            className="absolute inset-0 flex flex-col justify-center transition-transform duration-500 ease-out"
            style={{
              transform: i === 0 ? 'translateX(0)' : 'translateX(-100%)',
              opacity: i === 0 ? 1 : 0,
              pointerEvents: i === 0 ? 'auto' : 'none',
            }}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-0.5 bg-[#FF385C]" />
              <span className="text-[11px] font-semibold text-[#FF385C] uppercase tracking-widest">{slide.eyebrow}</span>
            </div>

            {/* Headline */}
            <h2 className="text-[clamp(20px,3vw,32px)] font-extrabold leading-tight mb-3 text-[#222222]">
              {slide.headline}
            </h2>

            {/* Subheadline */}
            <p className="text-[13px] text-[#717171] leading-relaxed mb-4 max-w-[360px]">
              {slide.subheadline}
            </p>

            {/* CTA Button */}
            <a
              href="/register"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#FF385C] text-white text-[12px] font-semibold rounded-lg hover:bg-[#E83355] transition-colors w-fit"
            >
              {slide.cta}
            </a>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {slide.tags.map((tag, j) => (
                <div key={j} className="flex items-center gap-1 px-2.5 py-1 bg-[#F4EFE9] border border-[#EBEBEB] rounded-full">
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-[11px] text-[#717171] font-medium">{tag.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 mt-6">
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full border-none cursor-pointer transition-all duration-300 ${
                i === current ? 'bg-[#FF385C] w-6 h-2 rounded' : 'bg-[#DDDDDD] w-2 h-2'
              }`}
            />
          ))}
        </div>

        {/* Arrows */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={prev}
            className="w-7 h-7 rounded-lg border border-[#DDDDDD] bg-white flex items-center justify-center text-[16px] text-[#717171] hover:bg-[#F4EFE9] transition-colors cursor-pointer"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="w-7 h-7 rounded-lg border border-[#DDDDDD] bg-white flex items-center justify-center text-[16px] text-[#717171] hover:bg-[#F4EFE9] transition-colors cursor-pointer"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
