"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Lang, dict } from "@/lib/i18n";
import { prepareImageFile, stashPendingImage } from "@/lib/image";

type TabKey = "today" | "progress" | "chat" | "more";

const ICONS: Record<TabKey, JSX.Element> = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  progress: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V11M10 20V5M16 20v-7M22 20H2" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
};

const TABS: { key: TabKey; href: string }[] = [
  { key: "today", href: "/" },
  { key: "progress", href: "/progress" },
  { key: "chat", href: "/chat" },
  { key: "more", href: "/more" },
];

function activeTab(pathname: string): TabKey {
  if (pathname === "/" || pathname.startsWith("/diary") || pathname.startsWith("/log")) return "today";
  if (pathname.startsWith("/progress")) return "progress";
  if (pathname.startsWith("/chat")) return "chat";
  return "more";
}

export default function TabsBar({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? "/";
  const t = dict[lang];
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => setSheetOpen(false), [pathname]);

  if (pathname.startsWith("/auth")) return null;
  const current = activeTab(pathname);

  return (
    <>
      <div className="nav-dock" dir={t.dir}>
        <nav className="tabs-bar">
          {TABS.map((tab) => (
            <Link key={tab.key} href={tab.href} className={current === tab.key ? "active" : ""}>
              {ICONS[tab.key]}
              {t.nav[tab.key]}
            </Link>
          ))}
        </nav>
        <button
          className={`fab ${sheetOpen ? "open" : ""}`}
          onClick={() => setSheetOpen((v) => !v)}
          aria-label={t.quickAdd.title}
          aria-expanded={sheetOpen}
        >
          +
        </button>
      </div>
      {sheetOpen && <QuickAddSheet lang={lang} onClose={() => setSheetOpen(false)} />}
    </>
  );
}

function QuickAddSheet({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = dict[lang];
  const tq = t.quickAdd;
  const router = useRouter();
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      stashPendingImage(await prepareImageFile(file));
    } catch {
      // Fall through - /log opens with the camera card so they can retry.
    }
    router.push("/log?mode=camera");
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="quick-sheet" dir={t.dir} role="dialog" aria-label={tq.title}>
        <div className="quick-sheet-brand">
          <div className="brand-mark" />
          {t.appName}
        </div>
        <div className="quick-grid">
          <label className="quick-tile" htmlFor="quick-photo-input">
            <span className="quick-tile-icon" style={{ background: "rgba(232,163,61,0.18)" }}>📷</span>
            {tq.mealScan}
          </label>
          <input id="quick-photo-input" type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          {speechSupported ? (
            <Link href="/log?mode=voice" className="quick-tile">
              <span className="quick-tile-icon" style={{ background: "rgba(166,58,58,0.14)" }}>🎙️</span>
              {tq.voiceLog}
            </Link>
          ) : (
            <Link href="/plan" className="quick-tile">
              <span className="quick-tile-icon" style={{ background: "rgba(166,58,58,0.14)" }}>🗓️</span>
              {tq.plan}
            </Link>
          )}
          <Link href="/log?mode=text" className="quick-tile">
            <span className="quick-tile-icon" style={{ background: "rgba(92,112,72,0.16)" }}>✍️</span>
            {tq.logFood}
          </Link>
          <Link href="/diary#favorites" className="quick-tile">
            <span className="quick-tile-icon" style={{ background: "rgba(43,33,27,0.08)" }}>⭐</span>
            {tq.favorites}
          </Link>
        </div>
        <div className="quick-list">
          <Link href="/water">
            <span className="quick-list-icon">💧</span>
            {tq.water}
          </Link>
          <Link href="/progress?tab=weight">
            <span className="quick-list-icon">⚖️</span>
            {tq.weight}
          </Link>
        </div>
      </div>
    </>
  );
}
