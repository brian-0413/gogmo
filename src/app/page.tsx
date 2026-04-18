import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";

export const metadata: Metadata = {
  title: "goGMO — 機場接送智能派單平台",
  description: "台灣機場接送智能派單媒合系統，告別 LINE 群組的混亂，享受 AI 智能派單的便利",
};

export default function HomePage() {
  return <HomeClient />;
}
