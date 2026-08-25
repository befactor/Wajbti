"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, Lang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";

type ProfileData = {
  sex: "male" | "female";
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
  bmr?: number;
  tdee?: number;
  dailyCalorieTarget?: number;
  dailyWaterTargetMl?: number;
  ramadanMode?: boolean;
};

const ACTIVITY_OPTIONS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
const GOAL_OPTIONS = ["lose", "maintain", "gain"] as const;

export default function ProfilePage() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const tp = t.profile;
  const { data: session, status } = useSession();

  const [form, setForm] = useState<Partial<ProfileData>>({
    sex: "male",
    activityLevel: "moderate",
    goal: "maintain",
  });
  const [bmi, setBmi] = useState<number | null>(null);
  const [bmiCategory, setBmiCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [weightLogs, setWeightLogs] = useState<Array<{ date: string; weightKg: number }>>([]);
  const [newWeight, setNewWeight] = useState("");
  const [loggingWeight, setLoggingWeight] = useState(false);

  function loadWeightHistory() {
    fetch("/api/weight")
      .then((res) => res.json())
      .then((data) => setWeightLogs(data.logs || []))
      .catch(() => {});
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setForm(data.profile);
        }
      })
      .catch(() => {});
    loadWeightHistory();
  }, [status]);

  async function logWeight(e: React.FormEvent) {
    e.preventDefault();
    const weightKg = Number(newWeight);
    if (!weightKg || weightKg <= 0) return;
    setLoggingWeight(true);
    try {
      const res = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg }),
      });
      const data = await res.json();
      if (data.profile) setForm(data.profile);
      setNewWeight("");
      loadWeightHistory();
    } catch {
      // no-op, user can retry
    } finally {
      setLoggingWeight(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setForm(data.profile);
        setBmi(data.bmi);
        setBmiCategory(data.bmiCategory);
        setSaved(true);
      }
    } catch {
      setError(tp.title);
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div dir={t.dir} className="container">
        <div className="loading-box">
          <div className="spin" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div dir={t.dir} className="container">
        <div className="form-card" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 14 }}>{tp.title}</p>
          <Link href="/auth/signin" className="analyze-cta" style={{ display: "block" }}>
            {t.auth.signInCta}
          </Link>
        </div>
        <TabsBar lang={lang} />
      </div>
    );
  }

  return (
    <div dir={t.dir} className="container">
      <div className="top-nav">
        <span>{session?.user?.name || session?.user?.email}</span>
        <button onClick={() => signOut({ callbackUrl: "/" })}>{t.auth.signOut}</button>
      </div>
      <button className="lang-toggle" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div className="brand">
        <div className="brand-mark" />
        <h1 className="title">{tp.title}</h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-field">
          <label>{tp.sex}</label>
          <select
            value={form.sex || "male"}
            onChange={(e) => setForm({ ...form, sex: e.target.value as ProfileData["sex"] })}
          >
            <option value="male">{tp.male}</option>
            <option value="female">{tp.female}</option>
          </select>
        </div>

        <div className="form-field">
          <label>{tp.age}</label>
          <input
            type="number"
            min={1}
            max={120}
            required
            value={form.ageYears ?? ""}
            onChange={(e) => setForm({ ...form, ageYears: Number(e.target.value) })}
          />
        </div>

        <div className="form-field">
          <label>{tp.height}</label>
          <input
            type="number"
            min={50}
            max={260}
            required
            value={form.heightCm ?? ""}
            onChange={(e) => setForm({ ...form, heightCm: Number(e.target.value) })}
          />
        </div>

        <div className="form-field">
          <label>{tp.weight}</label>
          <input
            type="number"
            min={20}
            max={400}
            required
            value={form.weightKg ?? ""}
            onChange={(e) => setForm({ ...form, weightKg: Number(e.target.value) })}
          />
        </div>

        <div className="form-field">
          <label>{tp.activityLevel}</label>
          <select
            value={form.activityLevel || "moderate"}
            onChange={(e) =>
              setForm({ ...form, activityLevel: e.target.value as ProfileData["activityLevel"] })
            }
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {tp[`activity_${opt}` as keyof typeof tp]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>{tp.goal}</label>
          <select
            value={form.goal || "maintain"}
            onChange={(e) => setForm({ ...form, goal: e.target.value as ProfileData["goal"] })}
          >
            {GOAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {tp[`goal_${opt}` as keyof typeof tp]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>
            <input
              type="checkbox"
              checked={form.ramadanMode || false}
              onChange={(e) => setForm({ ...form, ramadanMode: e.target.checked })}
              style={{ width: "auto", display: "inline-block", marginInlineEnd: 8 }}
            />
            {tp.ramadanMode}
          </label>
          <p className="hint">{tp.ramadanModeHint}</p>
        </div>

        <button className="analyze-cta" type="submit" disabled={loading}>
          {tp.save}
        </button>
        {saved && <p style={{ color: "var(--zaatar)", fontSize: 12.5, marginTop: 10, textAlign: "center" }}>{tp.saved}</p>}
      </form>

      {(form.bmr || bmi) && (
        <div className="tip-card">
          <h3>📊 {tp.resultsTitle}</h3>
          <div className="results-grid">
            {form.bmr && (
              <p>
                {tp.bmr}: <strong>{form.bmr}</strong> kcal
              </p>
            )}
            {form.tdee && (
              <p>
                {tp.tdee}: <strong>{form.tdee}</strong> kcal
              </p>
            )}
            {form.dailyCalorieTarget && (
              <p>
                {tp.calorieTarget}: <strong>{form.dailyCalorieTarget}</strong> kcal
              </p>
            )}
            {bmi && (
              <p>
                {tp.bmi}: <strong>{bmi}</strong> ({tp[`bmi_${bmiCategory}` as keyof typeof tp]})
              </p>
            )}
            {form.dailyWaterTargetMl && (
              <p>
                {tp.water}: <strong>{(form.dailyWaterTargetMl / 1000).toFixed(1)}</strong> L
              </p>
            )}
          </div>
        </div>
      )}

      <div className="form-card">
        <h3 style={{ fontFamily: "El Messiri", fontSize: 15, marginBottom: 14 }}>{tp.weightTrackingTitle}</h3>

        <WeightChart logs={weightLogs} noDataLabel={tp.weightNoData} />

        <form onSubmit={logWeight} style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input
            type="number"
            step="0.1"
            min={20}
            max={400}
            placeholder={tp.logWeightPlaceholder}
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            style={{
              flex: 1,
              background: "var(--semolina)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "12px 14px",
              fontFamily: "Cairo",
              fontSize: 14,
            }}
          />
          <button
            className="analyze-cta"
            type="submit"
            disabled={loggingWeight || !newWeight}
            style={{ width: "auto", padding: "0 20px", marginTop: 0 }}
          >
            {tp.logWeight}
          </button>
        </form>
      </div>

      <TabsBar lang={lang} />
    </div>
  );
}

function WeightChart({
  logs,
  noDataLabel,
}: {
  logs: Array<{ date: string; weightKg: number }>;
  noDataLabel: string;
}) {
  if (logs.length < 2) {
    return <p style={{ fontSize: 12.5, color: "var(--taupe)", textAlign: "center" }}>{noDataLabel}</p>;
  }

  const width = 320;
  const height = 110;
  const padding = 16;
  const weights = logs.map((l) => l.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const points = logs.map((log, i) => {
    const x = padding + (i / (logs.length - 1)) * (width - padding * 2);
    const y = height - padding - ((log.weightKg - min) / range) * (height - padding * 2);
    return { x, y, weightKg: log.weightKg };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const first = logs[0];
  const last = logs[logs.length - 1];
  const delta = Math.round((last.weightKg - first.weightKg) * 10) / 10;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ direction: "ltr" }}>
        <path d={pathD} fill="none" stroke="var(--saffron-deep)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill="var(--saffron-deep)" />
        ))}
      </svg>
      <p style={{ fontSize: 12, color: "var(--taupe)", textAlign: "center", marginTop: 6 }}>
        {first.weightKg}kg → {last.weightKg}kg ({delta > 0 ? "+" : ""}
        {delta}kg)
      </p>
    </div>
  );
}
