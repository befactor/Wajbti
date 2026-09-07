"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { dict, useLang } from "@/lib/i18n";
import AppleSignInNative from "@/lib/capacitor/appleSignIn";

export default function SignInPage() {
  const [lang, setLang] = useLang();
  const t = dict[lang];
  const ta = t.auth;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const appleEnabled = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true";

  async function handleCredentialsSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { redirect: false, email, password });
      if (res?.error) {
        setError(ta.invalidCredentials);
        return;
      }
      router.push("/");
    } catch {
      setError(ta.genericError);
    } finally {
      setLoading(false);
    }
  }

  // The web OAuth redirect (signIn("apple", ...)) fails inside the app's
  // embedded WKWebView - Apple's identity servers reject completing sign-in
  // in an untrusted embedded browser context (this is what App Review hit).
  // On native, use Apple's own AuthenticationServices framework instead (no
  // webview, no redirect) via AppleSignInPlugin.swift, then hand the signed
  // identityToken to the "apple-native" credentials provider for
  // verification. On plain web, the OAuth flow still works fine (real
  // browser), so keep using it there.
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
    <div dir={t.dir} className="container">
      <button className="lang-toggle" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div className="brand">
        <div className="brand-mark" />
        <h1 className="title">{t.appName}</h1>
      </div>

      <div className="form-card">
        <h2 style={{ fontFamily: "El Messiri", fontSize: 18, marginBottom: 16, textAlign: "center" }}>
          {ta.signInTitle}
        </h2>

        <button
          type="button"
          className={`btn-google ${googleEnabled ? "" : "btn-disabled"}`}
          disabled={!googleEnabled}
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          🔵 {ta.signInWithGoogle}
        </button>
        <button
          type="button"
          className={`btn-apple ${appleEnabled ? "" : "btn-disabled"}`}
          disabled={!appleEnabled || loading}
          onClick={handleAppleSignIn}
        >
          <span className="apple-logo-glyph" aria-hidden="true">
            {""}
          </span>
          {ta.signInWithApple}
        </button>

        <div className="divider">{ta.or}</div>

        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleCredentialsSignIn}>
          <div className="form-field">
            <label>{ta.emailLabel}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-field">
            <label>{ta.passwordLabel}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="analyze-cta" type="submit" disabled={loading}>
            {ta.signInCta}
          </button>
        </form>

        <p className="auth-switch">
          {ta.noAccount} <Link href="/auth/register">{ta.registerLink}</Link>
        </p>
      </div>
    </div>
  );
}
