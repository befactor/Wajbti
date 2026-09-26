"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Lang, dict } from "@/lib/i18n";
import AppleSignInNative from "@/lib/capacitor/appleSignIn";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
const APPLE_ENABLED = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// The web OAuth redirect (signIn("apple", ...)) fails inside the app's
// embedded WKWebView - Apple's identity servers reject completing sign-in in
// an embedded browser (this is what App Review hit). On native, use Apple's
// AuthenticationServices framework via AppleSignInPlugin.swift and hand the
// signed identityToken to the "apple-native" credentials provider instead.
export default function SocialAuthButtons({ lang }: { lang: Lang }) {
  const ta = dict[lang].auth;
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // null until mounted, so the Google button never flashes inside the app.
  const [isNative, setIsNative] = useState<boolean | null>(null);
  useEffect(() => setIsNative(Capacitor.isNativePlatform()), []);

  // Google refuses OAuth inside embedded WebViews (disallowed_useragent),
  // and its web redirect would leave the app for Safari - so the iOS app
  // offers native Sign in with Apple + email only.
  const showGoogle = GOOGLE_ENABLED && isNative === false;

  if (!showGoogle && !APPLE_ENABLED) return null;

  async function handleAppleSignIn() {
    if (!Capacitor.isNativePlatform()) {
      signIn("apple", { callbackUrl: "/" });
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await AppleSignInNative.signIn();
      const res = await signIn("apple-native", { redirect: false, identityToken: result.identityToken });
      if (res?.error) {
        setError(ta.invalidCredentials);
        return;
      }
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== "cancelled") setError(ta.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {APPLE_ENABLED && (
        <button type="button" className="btn-apple" disabled={loading} onClick={handleAppleSignIn}>
          <span className="apple-logo-glyph" aria-hidden="true">
            {""}
          </span>
          {ta.continueWithApple}
        </button>
      )}
      {showGoogle && (
        <button type="button" className="btn-google" onClick={() => signIn("google", { callbackUrl: "/" })}>
          <GoogleLogo />
          {ta.continueWithGoogle}
        </button>
      )}
      {error && <p className="error-text" style={{ textAlign: "center" }}>{error}</p>}
      <div className="divider">{ta.or}</div>
    </>
  );
}
