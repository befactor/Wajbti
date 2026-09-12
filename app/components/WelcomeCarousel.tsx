"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lang, dict } from "@/lib/i18n";

type Slide = {
  image: string;
  emoji: string;
  titleKey: "slide1Title" | "slide2Title" | "slide3Title";
  subKey: "slide1Sub" | "slide2Sub" | "slide3Sub";
};

const SLIDES: Slide[] = [
  {
    image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=900&q=75&auto=format&fit=crop",
    emoji: "📸",
    titleKey: "slide1Title",
    subKey: "slide1Sub",
  },
  {
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900&q=75&auto=format&fit=crop",
    emoji: "🍽️",
    titleKey: "slide2Title",
    subKey: "slide2Sub",
  },
  {
    image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=900&q=75&auto=format&fit=crop",
    emoji: "🎯",
    titleKey: "slide3Title",
    subKey: "slide3Sub",
  },
];

const SWIPE_THRESHOLD_PX = 40;
const AUTO_ADVANCE_MS = 4500;

export default function WelcomeCarousel({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
}) {
  const t = dict[lang];
  const tw = t.welcome;
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  function restartTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
  }

  useEffect(() => {
    restartTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goTo(i: number) {
    setActive(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
    restartTimer();
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    // Swiped left (finger moved right-to-left) -> next slide, regardless of
    // RTL/LTR - this matches the universal photo-swipe gesture users already
    // know from every gallery/stories app, not the text reading direction.
    if (deltaX < 0) goTo(active + 1);
    else goTo(active - 1);
  }

  return (
    <div dir={t.dir} className="welcome-shell">
      <div
        className="welcome-slides"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`welcome-slide ${active === i ? "active" : ""}`}
            style={{ backgroundImage: `url(${slide.image})` }}
          >
            <div className="welcome-slide-overlay" />
          </div>
        ))}

        <button
          className="welcome-tap-zone welcome-tap-prev"
          onClick={() => goTo(active - 1)}
          aria-label="previous"
        />
        <button
          className="welcome-tap-zone welcome-tap-next"
          onClick={() => goTo(active + 1)}
          aria-label="next"
        />

        <div className="welcome-stat-bubble">
          <span className="welcome-stat-emoji">{SLIDES[active].emoji}</span>
        </div>

        <button
          className="welcome-lang-toggle"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        >
          {lang === "ar" ? "English" : "العربية"}
        </button>

        <div className="welcome-text-block">
          <h1 className="welcome-headline">{tw[SLIDES[active].titleKey]}</h1>
          <p className="welcome-subtext">{tw[SLIDES[active].subKey]}</p>
        </div>

        <div className="welcome-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`welcome-dot ${active === i ? "active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="welcome-cta-area">
        <Link href="/auth/register" className="welcome-cta-primary">
          {tw.getStarted}
        </Link>
        <Link href="/auth/signin" className="welcome-cta-secondary">
          {tw.alreadyHaveAccount}
        </Link>
      </div>
    </div>
  );
}
