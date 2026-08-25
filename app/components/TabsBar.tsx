"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lang } from "@/lib/i18n";

const TABS: Array<{ href: string; icon: string; label: { ar: string; en: string } }> = [
  { href: "/", icon: "🍽️", label: { ar: "تحليل", en: "Analyze" } },
  { href: "/diary", icon: "📔", label: { ar: "اليوميات", en: "Diary" } },
  { href: "/chat", icon: "💬", label: { ar: "أخصائيك", en: "Chat" } },
  { href: "/plan", icon: "🗓️", label: { ar: "خطة الطعام", en: "Plan" } },
  { href: "/water", icon: "💧", label: { ar: "الماء", en: "Water" } },
  { href: "/profile", icon: "👤", label: { ar: "الملف", en: "Profile" } },
];

export default function TabsBar({ lang }: { lang: Lang }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/auth")) return null;

  return (
    <nav className="tabs-bar">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : ""}>
          <span className="tab-icon">{tab.icon}</span>
          {tab.label[lang]}
        </Link>
      ))}
    </nav>
  );
}
