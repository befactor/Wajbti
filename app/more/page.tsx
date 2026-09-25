"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dict, useLang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";

type MenuItem = { href: string; icon: string; tint: string; label: string };

function Chevron() {
  return (
    <svg className="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function MorePage() {
  const [lang, setLang] = useLang();
  const t = dict[lang];
  const tm = t.more;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [weightChange, setWeightChange] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/stats/streak")
      .then((r) => r.json())
      .then((d) => setStreak(d.streak || 0))
      .catch(() => {});
    fetch("/api/weight")
      .then((r) => r.json())
      .then((d) => {
        const logs: { weightKg: number }[] = d.logs || [];
        if (logs.length >= 1) setWeightChange(Math.round((logs[logs.length - 1].weightKg - logs[0].weightKg) * 10) / 10);
      })
      .catch(() => {});
  }, [status]);

  if (status !== "authenticated") {
    return <div style={{ minHeight: "100vh", background: "var(--semolina)" }} />;
  }

  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const initial = name.trim().charAt(0).toUpperCase() || "و";
  const lost = weightChange != null && weightChange < 0;

  const groups: MenuItem[][] = [
    [
      { href: "/profile", icon: "👤", tint: "rgba(232,163,61,0.18)", label: tm.profile },
      { href: "/diary", icon: "📔", tint: "rgba(166,58,58,0.12)", label: tm.diary },
      { href: "/plan", icon: "🗓️", tint: "rgba(92,112,72,0.16)", label: tm.plan },
      { href: "/diary#favorites", icon: "⭐", tint: "rgba(232,163,61,0.18)", label: tm.favorites },
    ],
    [
      { href: "/progress?tab=weight", icon: "⚖️", tint: "rgba(92,112,72,0.16)", label: tm.weight },
      { href: "/progress", icon: "📊", tint: "rgba(42,120,184,0.14)", label: tm.weeklyReport },
      { href: "/water", icon: "💧", tint: "rgba(42,120,184,0.14)", label: tm.water },
    ],
    [
      { href: "/support", icon: "💬", tint: "rgba(43,33,27,0.07)", label: tm.support },
      { href: "/privacy", icon: "🔒", tint: "rgba(43,33,27,0.07)", label: tm.privacy },
    ],
  ];

  return (
    <div dir={t.dir} className="container today-page">
      <div className="today-header">
        <h1>{tm.title}</h1>
      </div>

      <div className="more-hero">
        <div className="more-hero-stat">
          <p className="progress-stat-label">{tm.streak}</p>
          <p className="more-hero-number">🔥 {streak}</p>
          <p className="progress-stat-label">{tm.days}</p>
        </div>
        <div className="more-hero-center">
          <div className="more-avatar">{initial}</div>
          <p className="more-name">{name}</p>
        </div>
        <div className="more-hero-stat">
          <p className="progress-stat-label">{tm.progressLabel}</p>
          <p className="more-hero-number">{weightChange == null ? "—" : Math.abs(weightChange)}</p>
          <p className="progress-stat-label">{weightChange == null ? tm.kg : lost ? tm.kgLost : tm.kgChange}</p>
        </div>
      </div>

      {groups.map((items, gi) => (
        <div key={gi} className="menu-group">
          {items.map((item) => (
            <Link key={item.href + item.label} href={item.href} className="menu-row">
              <span className="menu-icon" style={{ background: item.tint }}>
                {item.icon}
              </span>
              <span className="menu-label">{item.label}</span>
              <Chevron />
            </Link>
          ))}
        </div>
      ))}

      <div className="menu-group">
        <button className="menu-row" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          <span className="menu-icon" style={{ background: "rgba(43,33,27,0.07)" }}>🌐</span>
          <span className="menu-label">{tm.language}</span>
          <span className="menu-value">{lang === "ar" ? "العربية" : "English"}</span>
        </button>
        <button className="menu-row danger" onClick={() => signOut({ callbackUrl: "/" })}>
          <span className="menu-icon" style={{ background: "rgba(166,58,58,0.12)" }}>↩️</span>
          <span className="menu-label">{t.auth.signOut}</span>
        </button>
      </div>

      <TabsBar lang={lang} />
    </div>
  );
}
