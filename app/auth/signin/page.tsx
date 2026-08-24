"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dict, Lang } from "@/lib/i18n";

export default function SignInPage() {
  const [lang, setLang] = useState<Lang>("ar");
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
    const res = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (res?.error) {
      setError(ta.invalidCredentials);
      return;
    }
    router.push("/");
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
          className={`btn-google ${appleEnabled ? "" : "btn-disabled"}`}
          disabled={!appleEnabled}
          onClick={() => signIn("apple", { callbackUrl: "/" })}
        >
          🍎 {ta.appleComingSoon}
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
