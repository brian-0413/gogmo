'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Plane,
  ArrowRight,
  Zap,
  Brain,
  Smartphone,
  Wallet,
  Scan,
  ListChecks,
  TrendingDown,
  Clock,
  Users,
  ChevronRight,
  Check,
  Star,
  MapPin,
} from 'lucide-react';

// ─── Intersection Observer Reveal Hook ───
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Live Stats Counter ───
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return count;
}

// ─── Ambient Floating Orb ───
function AmbientOrb({ color, size, top, left, delay }: { color: string; size: number; top: string; left: string; delay: string }) {
  return (
    <div
      className="ambient-blob animate-float"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}, transparent)`,
        top,
        left,
        animationDelay: delay,
      }}
    />
  );
}

// ─── Stat Counter Card ───
function StatCard({ value, label, sublabel, accent }: { value: number; label: string; sublabel: string; accent: string }) {
  const count = useCounter(value);
  return (
    <div className="relative bg-white rounded-[2rem] p-6 border border-[#EAEAEA] card-lift overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 blur-2xl" style={{ background: accent }} />
      <p className="text-[48px] font-black tracking-tight leading-none font-mono-nums" style={{ color: accent }}>
        {count}
      </p>
      <p className="text-[13px] font-semibold text-[#222] mt-2">{label}</p>
      <p className="text-[11px] text-[#717171] mt-0.5">{sublabel}</p>
    </div>
  );
}

// ─── Feature Card ───
function FeatureCard({
  number,
  icon,
  iconBg,
  title,
  desc,
  tags,
  accent,
}: {
  number: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  tags: Array<{ label: string; color: string }>;
  accent: string;
}) {
  return (
    <div className="relative bg-white rounded-[1.5rem] p-8 border border-[#EAEAEA] card-lift overflow-hidden reveal">
      {/* Large background number */}
      <span
        className="absolute top-4 right-6 font-black text-[120px] leading-none select-none pointer-events-none"
        style={{ color: accent, opacity: 0.05 }}
      >
        {number}
      </span>

      <div className="relative">
        <div
          className="w-12 h-12 rounded-[1rem] flex items-center justify-center mb-5"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <h3 className="text-[18px] font-bold text-[#222] mb-2 leading-tight">{title}</h3>
        <p className="text-[13px] text-[#717171] leading-relaxed mb-5 max-w-[280px]">{desc}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="px-3 py-1 text-[11px] font-medium rounded-full text-white"
              style={{ background: tag.color }}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Testimonial Card ───
function TestimonialCard({ name, role, text, rating }: { name: string; role: string; text: string; rating: number }) {
  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#EAEAEA] card-lift reveal">
      <div className="flex gap-1 mb-3">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-[#FF385C] text-[#FF385C]" />
        ))}
      </div>
      <p className="text-[13px] text-[#717171] leading-relaxed mb-4">&ldquo;{text}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#F4EFE9] flex items-center justify-center text-[13px] font-bold text-[#FF385C]">
          {name[0]}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-[#222]">{name}</p>
          <p className="text-[11px] text-[#717171]">{role}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Nav ───
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-2xl border-b border-[#EAEAEA] shadow-[0_1px_0_rgba(0,0,0,0.04)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[#FF385C] flex items-center justify-center shadow-lg shadow-[#FF385C]/20 transition-transform duration-300 group-hover:scale-105">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-[#222] tracking-tight">goGMO</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[13px] text-[#717171] hover:text-[#222] transition-colors">服務特色</a>
            <a href="#stats" className="text-[13px] text-[#717171] hover:text-[#222] transition-colors">平台數據</a>
            <a href="#testimonials" className="text-[13px] text-[#717171] hover:text-[#222] transition-colors">使用者見證</a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden md:block text-[13px] text-[#717171] hover:text-[#222] transition-colors">
              登入
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-[#FF385C] hover:bg-[#E83355] text-white text-[13px] gap-1.5 btn-physics shadow-lg shadow-[#FF385C]/20">
                立即加入
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ───
function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden bg-white pt-20">
      {/* Ambient blobs */}
      <AmbientOrb color="#FF385C" size={600} top="10%" left="-10%" delay="0s" />
      <AmbientOrb color="#FF385C" size={400} top="50%" left="60%" delay="2s" />
      <AmbientOrb color="#0C447C" size={300} top="60%" left="20%" delay="4s" />

      <div className="relative max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="grid lg:grid-cols-12 gap-8 items-center">

          {/* Left — Text Content */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F5] border border-[#EAEAEA] rounded-full w-fit animate-reveal-up">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF385C] animate-pulse-ring" />
              <span className="text-[11px] font-medium text-[#717171] uppercase tracking-widest">台灣第一</span>
              <span className="text-[11px] font-medium text-[#222]">AI 機場接送派單平台</span>
            </div>

            {/* H1 */}
            <div className="animate-reveal-up delay-100">
              <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-black tracking-tight leading-[1.05] text-[#111]">
                告別 LINE 群組
                <br />
                <span className="text-[#FF385C]">智能派單</span>新時代
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-[15px] text-[#717171] leading-relaxed max-w-[480px] animate-reveal-up delay-200">
              從司機到派單方，所有人都值得一個優雅、高效的接送派遣體驗。
              AI 解析訂單、3 秒即時推播、智慧排班推薦——goGMO，重新定義機場接送的每一個環節。
            </p>

            {/* CTA Row */}
            <div className="flex flex-wrap items-center gap-3 animate-reveal-up delay-300">
              <Link href="/register">
                <Button size="lg" className="bg-[#111] hover:bg-[#333] text-white text-[14px] gap-2 btn-physics shadow-xl">
                  免費加入
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-[#DDDDDD] text-[#717171] hover:bg-[#FAF8F5] text-[14px]">
                  登入系統
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-6 pt-2 animate-reveal-up delay-400">
              {[
                { icon: <Users className="w-3.5 h-3.5" />, text: '1,200+ 司機加入' },
                { icon: <Check className="w-3.5 h-3.5" />, text: '免費使用' },
                { icon: <Zap className="w-3.5 h-3.5" />, text: '3 分鐘上手' },
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[12px] text-[#717171]">
                  <span style={{ color: '#FF385C' }}>{badge.icon}</span>
                  {badge.text}
                </div>
              ))}
            </div>
          </div>

          {/* Right — Visual Stack */}
          <div className="lg:col-span-5 relative animate-reveal-scale delay-200">
            {/* Main card */}
            <div className="relative bg-white rounded-[2rem] border border-[#EAEAEA] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.12)] overflow-hidden">
              {/* Card Header */}
              <div className="bg-[#111] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF385C]" />
                  <span className="text-[12px] font-medium text-white/80">goGMO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#FF385C] animate-pulse" />
                  <span className="text-[10px] text-white/60 font-mono">即時派單</span>
                </div>
              </div>

              {/* Order Item Preview */}
              <div className="p-5 space-y-3">
                {[
                  { time: '14:32', from: '桃園機場 TPE', to: '台北市信義區', price: 'NT$800', status: '待接單', statusColor: '#FF385C' },
                  { time: '14:45', from: '松山機場 TSA', to: '新北市板橋區', price: 'NT$650', status: '已接單', statusColor: '#0C447C' },
                  { time: '15:10', from: '高雄機場 KHH', to: '台南市東區', price: 'NT$1,200', status: '進行中', statusColor: '#008A05' },
                ].map((order, i) => (
                  <div key={i} className="relative p-4 bg-[#FAF8F5] rounded-2xl border border-[#EAEAEA] card-lift">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#717171]" />
                        <span className="text-[12px] font-mono font-semibold text-[#222]">{order.time}</span>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: order.statusColor }}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[#FF385C]" />
                        <span className="text-[12px] text-[#717171]">{order.from}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[#008A05]" />
                        <span className="text-[12px] text-[#717171]">{order.to}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-[#EAEAEA] flex items-center justify-between">
                      <span className="text-[14px] font-black text-[#FF385C] font-mono-nums">{order.price}</span>
                      <Button size="sm" className="bg-[#111] hover:bg-[#333] text-white text-[11px] h-7">
                        接單
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl border border-[#EAEAEA] px-4 py-3 shadow-lg animate-float">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#F0FFF4] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#008A05]" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#222]">3 秒推播</p>
                  <p className="text-[10px] text-[#717171]">訂單即時送達</p>
                </div>
              </div>
            </div>

            {/* Pulse ring behind card */}
            <div className="absolute inset-0 rounded-[2rem] border-2 border-[#FF385C]/10 scale-105 -z-10 animate-pulse-ring" />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-reveal-up delay-700">
        <span className="text-[10px] text-[#717171] uppercase tracking-widest">往下探索</span>
        <div className="w-5 h-8 rounded-full border-2 border-[#DDDDDD] flex items-start justify-center p-1.5">
          <div className="w-1 h-2 bg-[#FF385C] rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}

// ─── Stats Section ───
function StatsSection() {
  return (
    <section id="stats" className="relative py-20 bg-[#FAF8F5] overflow-hidden">
      <AmbientOrb color="#FF385C" size={500} top="50%" left="50%" delay="1s" />
      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="text-center mb-14 reveal">
          <span className="text-[11px] font-semibold text-[#FF385C] uppercase tracking-widest">平台實力</span>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black tracking-tight text-[#111] mt-2">
            用數據說話
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard value={1200} label="註冊司機" sublabel="全台灣持續成長中" accent="#FF385C" />
          <StatCard value={48000} label="已完成趟次" sublabel="精準、安全、準時" accent="#0C447C" />
          <StatCard value={99} label="% 準時抵達" sublabel="平均抵達時間誤差" accent="#008A05" />
          <StatCard value={3} label="秒即時推播" sublabel="新訂單上架到司機手機" accent="#7C3AED" />
        </div>
      </div>
    </section>
  );
}

// ─── Features Section ───
function FeaturesSection() {
  const driverFeatures = [
    {
      number: '01',
      icon: <Brain className="w-5 h-5" style={{ color: '#0C447C' }} />,
      iconBg: '#E6F1FB',
      title: 'AI 智能排班推薦',
      desc: '系統自動分析航班動態，智能推薦銜接訂單，司機一趟賺兩趟，效率最大化',
      tags: [{ label: '接機接駁', color: '#0C447C' }, { label: '地理優化', color: '#0C447C' }],
      accent: '#0C447C',
    },
    {
      number: '02',
      icon: <Zap className="w-5 h-5" style={{ color: '#F59E0B' }} />,
      iconBg: '#FFF3E0',
      title: '3 秒即時推播',
      desc: '新訂單上架 3 秒內推播到所有司機手機，先搶先贏，零時差接單',
      tags: [{ label: 'SSE 即時', color: '#F59E0B' }, { label: '先搶先贏', color: '#F59E0B' }],
      accent: '#F59E0B',
    },
    {
      number: '03',
      icon: <Smartphone className="w-5 h-5" style={{ color: '#008A05' }} />,
      iconBg: '#F0FFF4',
      title: '手機一鍵完成',
      desc: '抵達、開始、客上、客下，四步完成行程，司機不需要任何複雜操作',
      tags: [{ label: '四鍵完成', color: '#008A05' }, { label: '自動同步', color: '#008A05' }],
      accent: '#008A05',
    },
    {
      number: '04',
      icon: <Wallet className="w-5 h-5" style={{ color: '#7C3AED' }} />,
      iconBg: '#F3E8FF',
      title: '帳務管理中心',
      desc: '每筆車資自動結算，點數餘額即時查詢，司機輕鬆對帳不求人',
      tags: [{ label: '自動結算', color: '#7C3AED' }, { label: '歷史查詢', color: '#7C3AED' }],
      accent: '#7C3AED',
    },
  ];

  const dispatcherFeatures = [
    {
      number: '01',
      icon: <Scan className="w-5 h-5" style={{ color: '#F59E0B' }} />,
      iconBg: '#FFF3E0',
      title: 'AI 智慧解析多筆行程',
      desc: '從 LINE 群組複製文字，AI 自動解析航班、時間、地點、金額，多筆行程一次生成',
      tags: [{ label: '一鍵解析', color: '#F59E0B' }, { label: '批量生成', color: '#F59E0B' }],
      accent: '#F59E0B',
    },
    {
      number: '02',
      icon: <ListChecks className="w-5 h-5" style={{ color: '#0C447C' }} />,
      iconBg: '#E6F1FB',
      title: '行控中心即時掌握',
      desc: '所有訂單狀態一目了然，司機抵達、開始、接送即時通知，零死角掌控行程',
      tags: [{ label: '進度追蹤', color: '#0C447C' }, { label: '即時通知', color: '#0C447C' }],
      accent: '#0C447C',
    },
    {
      number: '03',
      icon: <Clock className="w-5 h-5" style={{ color: '#008A05' }} />,
      iconBg: '#F0FFF4',
      title: '帳務結算效率升級',
      desc: '每日對帳單自動生成，待轉帳金額一目了然，轉帳後司機即時收到通知',
      tags: [{ label: '自動對帳', color: '#008A05' }, { label: '轉帳通知', color: '#008A05' }],
      accent: '#008A05',
    },
    {
      number: '04',
      icon: <TrendingDown className="w-5 h-5" style={{ color: '#7C3AED' }} />,
      iconBg: '#F3E8FF',
      title: '有效降低成本',
      desc: '司機自行墊付油錢，平台抽成透明公開，派單方成本可控、效率提升',
      tags: [{ label: '透明抽成', color: '#7C3AED' }, { label: '成本可控', color: '#7C3AED' }],
      accent: '#7C3AED',
    },
  ];

  return (
    <>
      {/* Driver Features */}
      <section id="features" className="relative py-20 bg-white overflow-hidden">
        <AmbientOrb color="#FF385C" size={400} top="0%" left="80%" delay="0.5s" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="mb-14 reveal">
            <span className="text-[11px] font-semibold text-[#FF385C] uppercase tracking-widest">司機服務</span>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black tracking-tight text-[#111] mt-2">
              司機的接單樂園
            </h2>
            <p className="text-[14px] text-[#717171] mt-3 max-w-[480px]">
              從接單到結算，每一個環節都為司機精心設計
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {driverFeatures.map((f, i) => (
              <div key={i} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <FeatureCard {...f} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dispatcher Features */}
      <section className="relative py-20 bg-[#FAF8F5] overflow-hidden">
        <AmbientOrb color="#0C447C" size={400} top="20%" left="-5%" delay="1.5s" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="mb-14 reveal">
            <span className="text-[11px] font-semibold text-[#FF385C] uppercase tracking-widest">派單方服務</span>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black tracking-tight text-[#111] mt-2">
              派單方的派單天堂
            </h2>
            <p className="text-[14px] text-[#717171] mt-3 max-w-[480px]">
              告別 LINE 群組的混亂，享受智能派單的便利
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {dispatcherFeatures.map((f, i) => (
              <div key={i} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <FeatureCard {...f} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Testimonials ───
function TestimonialsSection() {
  return (
    <section id="testimonials" className="relative py-20 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14 reveal">
          <span className="text-[11px] font-semibold text-[#FF385C] uppercase tracking-widest">使用者見證</span>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black tracking-tight text-[#111] mt-2">
            來自第一線的聲音
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          <TestimonialCard
            name="阿志師"
            role="職業司機，台北"
            text="用了 goGMO 之後，每個月的收入比以前多跑 LINE 群組還穩定。AI 配單真的很準，連續接了好幾趟機場下來，都不用空車跑太遠。"
            rating={5}
          />
          <TestimonialCard
            name="美玉姐"
            role="派遣車行主管"
            text="以前每天要處理的 LINE 訊息上百條，現在只要把行程貼上 AI 解析，馬上就生成訂單。司機們也都說系統很清楚，不用一直問客人。"
            rating={5}
          />
          <TestimonialCard
            name="韋恩"
            role="商務旅客"
            text="第一次用是被司機朋友推薦的。司機都說這個平台單子品質好，果然叫了三次，來的司機都很專業、態度好，車子也乾淨。"
            rating={5}
          />
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───
function CTABanner() {
  return (
    <section className="relative py-24 bg-[#111] overflow-hidden">
      {/* Subtle ambient */}
      <div className="absolute inset-0 opacity-20" style={{
        background: 'radial-gradient(ellipse at 50% 50%, #FF385C 0%, transparent 70%)'
      }} />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <div className="reveal">
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black tracking-tight text-white leading-[1.1]">
            準備好加入
            <br />
            <span style={{ color: '#FF385C' }}>goGMO</span> 了嗎？
          </h2>
        </div>
        <p className="text-[#A8A29E] text-[15px] mt-5 max-w-[440px] mx-auto reveal delay-100">
          立即註冊，告別 LINE 群組的混亂，享受智能派單的便利。
          現在加入，享有新用戶 500 點bonus。
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 reveal delay-200">
          <Link href="/register">
            <Button size="lg" className="bg-[#FF385C] hover:bg-[#E83355] text-white text-[14px] gap-2 btn-physics shadow-xl shadow-[#FF385C]/30 w-full sm:w-auto">
              立即註冊
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-[#333] text-[#A8A29E] hover:bg-[#1C1C1E] text-[14px] w-full sm:w-auto">
              登入系統
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-8 mt-10 reveal delay-300">
          {[
            { icon: <Check className="w-3.5 h-3.5" />, text: '免費加入' },
            { icon: <Check className="w-3.5 h-3.5" />, text: '無月費' },
            { icon: <Check className="w-3.5 h-3.5" />, text: '500 點新戶禮' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[12px] text-[#A8A29E]">
              <span style={{ color: '#FF385C' }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───
function Footer() {
  return (
    <footer className="py-6 px-6 bg-[#FAF8F5] border-t border-[#EAEAEA]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#FF385C] flex items-center justify-center">
            <Plane className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[13px] font-bold text-[#222]">goGMO</span>
        </div>
        <p className="text-[11px] text-[#B0B0B0]">
          2026 goGMO. 機場接送智能派單平台.
        </p>
      </div>
    </footer>
  );
}

// ─── Main ───
export default function HomeClient() {
  useReveal();

  return (
    <div className="min-h-screen bg-white text-[#222]">
      <Nav />
      <main>
        <Hero />
        <StatsSection />
        <FeaturesSection />
        <TestimonialsSection />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
