"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dict, Lang } from "@/lib/i18n";

export default function RegisterPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const ta = t.auth;
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        setError(data.error);
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
          {ta.registerTitle}
        </h2>

        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleRegister}>
          <div className="form-field">
            <label>{ta.nameLabel}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label>{ta.emailLabel}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-field">
            <label>{ta.passwordLabel}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="analyze-cta" type="submit" disabled={loading}>
            {ta.registerCta}
          </button>
        </form>

        <p className="auth-switch">
          {ta.haveAccount} <Link href="/auth/signin">{ta.signInLink}</Link>
        </p>
      </div>
    </div>
  );
}
