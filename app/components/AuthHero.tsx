"use client";

import Link from "next/link";
import { Lang, dict } from "@/lib/i18n";

export default function AuthHero({
  lang,
  setLang,
  image,
  title,
  subtitle,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  image: string;
  title: string;
  subtitle: string;
}) {
  const t = dict[lang];
  return (
    <div className="auth-hero" style={{ backgroundImage: `url(${image})` }}>
      <div className="auth-hero-overlay" />
      <div className="auth-hero-top">
        <Link href="/" className="auth-hero-back" aria-label="back">
          {t.dir === "rtl" ? "→" : "←"}
        </Link>
        <button className="auth-hero-lang" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "English" : "العربية"}
        </button>
      </div>
      <div className="auth-hero-text">
        <div className="auth-hero-brand">
          <div className="brand-mark" />
          <span>{t.appName}</span>
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
