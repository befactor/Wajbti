"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dict, useLang } from "@/lib/i18n";
import SocialAuthButtons from "@/app/components/SocialAuthButtons";
import AuthHero from "@/app/components/AuthHero";

export default function RegisterPage() {
  const [lang, setLang] = useLang();
  const t = dict[lang];
  const ta = t.auth;
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(
          data.error === "weakPasswordError"
            ? ta.weakPasswordError
            : data.error === "emailTakenError"
            ? ta.emailTakenError
            : ta.genericError
        );
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", { redirect: false, email, password });
      setLoading(false);
      if (signInRes?.error) {
        setError(ta.genericError);
        return;
      }
      router.push("/");
    } catch {
      setError(ta.genericError);
      setLoading(false);
    }
  }

  return (
    <div dir={t.dir} className="auth-page">
      <AuthHero
        lang={lang}
        setLang={setLang}
        image="https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=900&q=70&auto=format&fit=crop"
        title={ta.registerTitle}
        subtitle={ta.registerSubtitle}
      />

      <div className="form-card auth-card">
        <SocialAuthButtons lang={lang} />

        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleRegister}>
          <div className="form-field">
            <label>{ta.nameLabel}</label>
            <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
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
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "hide password" : "show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <p className="hint">{ta.passwordHint}</p>
          </div>
          <button className="analyze-cta" type="submit" disabled={loading}>
            {loading ? "…" : ta.registerCta}
          </button>
        </form>

        <p className="auth-switch">
          {ta.haveAccount} <Link href="/auth/signin">{ta.signInLink}</Link>
        </p>
      </div>
    </div>
  );
}
