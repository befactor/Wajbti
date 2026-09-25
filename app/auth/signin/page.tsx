"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dict, useLang } from "@/lib/i18n";
import SocialAuthButtons from "@/app/components/SocialAuthButtons";
import AuthHero from "@/app/components/AuthHero";

export default function SignInPage() {
  const [lang, setLang] = useLang();
  const t = dict[lang];
  const ta = t.auth;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div dir={t.dir} className="auth-page">
      <AuthHero
        lang={lang}
        setLang={setLang}
        image="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900&q=70&auto=format&fit=crop"
        title={ta.signInTitle}
        subtitle={ta.signInSubtitle}
      />

      <div className="form-card auth-card">
        <SocialAuthButtons lang={lang} />

        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleCredentialsSignIn}>
          <div className="form-field">
            <label>{ta.emailLabel}</label>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>{ta.passwordLabel}</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="analyze-cta" type="submit" disabled={loading}>
            {loading ? "…" : ta.signInCta}
          </button>
        </form>

        <p className="auth-switch">
          {ta.noAccount} <Link href="/auth/register">{ta.registerLink}</Link>
        </p>
      </div>
    </div>
  );
}
