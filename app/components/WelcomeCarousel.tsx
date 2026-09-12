"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lang, dict } from "@/lib/i18n";

type Slide = {
  image: string;
  titleKey: "slide1Title" | "slide2Title" | "slide3Title";
  subKey: "slide1Sub" | "slide2Sub" | "slide3Sub";
};

const SLIDES: Slide[] = [
  { image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=900&q=75&auto=format&fit=crop", titleKey: "slide1Title", subKey: "slide1Sub" },
  { image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900&q=75&auto=format&fit=crop", titleKey: "slide2Title", subKey: "slide2Sub" },
];

export default function WelcomeCarousel({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const tw = t.welcome;
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideCount = SLIDES.length + 1; // +1 for the no-photo "goal" slide

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % slideCount);
    }, 4500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slideCount]);

  function goTo(i: number) {
    setActive(i);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % slideCount);
    }, 4500);
  }

  return (
    <div dir={t.dir} className="welcome-shell">
      <div className="welcome-slides">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`welcome-slide ${active === i ? "active" : ""}`}
            style={{ backgroundImage: `url(${slide.image})` }}
          >
            <div className="welcome-slide-overlay" />
          </div>
        ))}
        <div className={`welcome-slide welcome-slide-goal ${active === SLIDES.length ? "active" : ""}`}>
          <div className="welcome-slide-overlay" />
        </div>

        <div className="welcome-stat-bubble">
          <span className="welcome-stat-emoji">
            {active === 0 ? "📸" : active === 1 ? "🍽️" : "🎯"}
          </span>
        </div>

        <div className="welcome-text-block">
          <h1 className="welcome-headline">
            {active === 0 ? tw.slide1Title : active === 1 ? tw.slide2Title : tw.slide3Title}
          </h1>
          <p className="welcome-subtext">
            {active === 0 ? tw.slide1Sub : active === 1 ? tw.slide2Sub : tw.slide3Sub}
          </p>
        </div>

        <div className="welcome-dots">
          {Array.from({ length: slideCount }).map((_, i) => (
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
