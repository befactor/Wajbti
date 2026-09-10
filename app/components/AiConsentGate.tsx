"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dict, useLang } from "@/lib/i18n";

const CONSENT_STORAGE_KEY = "wajbti_ai_consent_v1";

// Apple Guideline 5.1.1(i)/5.1.2(i): before any data reaches Anthropic (the
// AI provider behind analyze/chat/meal-plan), the app must disclose what's
// sent, name who it's sent to, and get the user's permission - not just
// mention it in the privacy policy. This blocks every page (guests included,
// since meal analysis works without signing in) until that's acknowledged
// once. Defaults to "already agreed" until the effect below reads
// localStorage, so server-rendered/first-paint markup never flashes an
// impossible false state before hydration.
export default function AiConsentGate({ children }: { children: React.ReactNode }) {
  const [lang] = useLang();
  const t = dict[lang];
  const tc = t.aiConsent;
  const [hasConsented, setHasConsented] = useState(true);

  useEffect(() => {
    try {
      setHasConsented(localStorage.getItem(CONSENT_STORAGE_KEY) === "1");
    } catch {
      // localStorage unavailable (private mode, etc.) - don't block the app over it.
      setHasConsented(true);
    }
  }, []);

  function agree() {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, "1");
    } catch {
      // no-op
    }
    setHasConsented(true);
  }

  return (
    <>
      {children}
      {!hasConsented && (
        <div
          dir={t.dir}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(30, 22, 14, 0.55)",
            zIndex: 999,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "var(--semolina)",
              borderRadius: "22px 22px 0 0",
              padding: "24px 22px calc(24px + env(safe-area-inset-bottom))",
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ fontFamily: "El Messiri", fontSize: 19, marginBottom: 10 }}>{tc.title}</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.8, marginBottom: 12 }}>{tc.body}</p>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{tc.whatSent}</p>
            <ul style={{ margin: "0 0 12px", paddingInlineStart: 20, fontSize: 13, lineHeight: 1.9 }}>
              <li>{tc.item1}</li>
              <li>{tc.item2}</li>
              <li>{tc.item3}</li>
            </ul>
            <p style={{ fontSize: 12, color: "var(--taupe)", lineHeight: 1.8, marginBottom: 18 }}>
              {tc.note}{" "}
              <Link href="/privacy" style={{ color: "var(--saffron-deep)", fontWeight: 700 }}>
                {tc.privacyLink}
              </Link>
            </p>
            <button className="analyze-cta" onClick={agree} style={{ marginTop: 0 }}>
              {tc.agree}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
