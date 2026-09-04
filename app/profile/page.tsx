"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, useLang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";

type ProfileData = {
  sex: "male" | "female";
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
  pregnancyStatus?: "none" | "pregnant" | "breastfeeding";
  bmr?: number;
  tdee?: number;
  dailyCalorieTarget?: number;
  dailyWaterTargetMl?: number;
  ramadanMode?: boolean;
};

const ACTIVITY_OPTIONS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
const GOAL_OPTIONS = ["lose", "maintain", "gain"] as const;
const PREGNANCY_OPTIONS = ["none", "pregnant", "breastfeeding"] as const;

export default function ProfilePage() {
  const [lang, setLang] = useLang();
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
  const [foodNotes, setFoodNotes] = useState<Array<{ id: string; note: string }>>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function loadWeightHistory() {
    fetch("/api/weight")
      .then((res) => res.json())
      .then((data) => setWeightLogs(data.logs || []))
      .catch(() => {});
  }

  function loadFoodNotes() {
    fetch("/api/food-notes")
      .then((res) => res.json())
      .then((data) => setFoodNotes(data.foodNotes || []))
      .catch(() => {});
  }

  async function deleteFoodNote(id: string) {
    setFoodNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/food-notes/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function deleteAccount() {
    setDeleteError("");
    setDeletingAccount(true);
    let res: Response;
    try {
      res = await fetch("/api/account", { method: "DELETE" });
    } catch {
      setDeletingAccount(false);
      setDeleteError(tp.deleteAccountError);
      return;
    }
    if (!res.ok) {
      setDeletingAccount(false);
      setDeleteError(tp.deleteAccountError);
      return;
    }
    await signOut({ callbackUrl: "/" });
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
    loadFoodNotes();
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
        <div className="top-nav-auth">
          <span>{session?.user?.name || session?.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl: "/" })}>{t.auth.signOut}</button>
        </div>
        <button className="lang-toggle-inline" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "English" : "العربية"}
        </button>
      </div>

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
            onChange={(e) =>
              setForm({
                ...form,
                sex: e.target.value as ProfileData["sex"],
                pregnancyStatus: e.target.value === "female" ? form.pregnancyStatus : "none",
              })
            }
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

        {form.sex === "female" && (
          <div className="form-field">
            <label>{tp.pregnancyStatus}</label>
            <select
              value={form.pregnancyStatus || "none"}
              onChange={(e) =>
                setForm({ ...form, pregnancyStatus: e.target.value as ProfileData["pregnancyStatus"] })
              }
            >
              {PREGNANCY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {tp[`pregnancy_${opt}` as keyof typeof tp]}
                </option>
              ))}
            </select>
            {form.pregnancyStatus && form.pregnancyStatus !== "none" && (
              <p className="hint">{tp.pregnancyStatusHint}</p>
            )}
          </div>
        )}

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
              fontSize: 16,
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

      {foodNotes.length > 0 && (
        <div className="form-card">
          <h3 style={{ fontFamily: "El Messiri", fontSize: 15, marginBottom: 6 }}>{tp.foodNotesTitle}</h3>
          <p className="hint" style={{ marginBottom: 10 }}>{tp.foodNotesHint}</p>
          {foodNotes.map((n) => (
            <div key={n.id} className="diary-meal-row">
              <span style={{ fontSize: 13.5 }}>{n.note}</span>
              <button className="diary-delete-btn" onClick={() => deleteFoodNote(n.id)} aria-label={t.diary.delete}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="form-card">
        <h3 style={{ fontFamily: "El Messiri", fontSize: 15, marginBottom: 10, color: "var(--sumac)" }}>
          {tp.dangerZoneTitle}
        </h3>
        {!confirmingDelete ? (
          <>
            <p className="hint" style={{ marginBottom: 12 }}>{tp.deleteAccountHint}</p>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              style={{
                width: "100%",
                background: "none",
                border: "1px solid var(--sumac)",
                color: "var(--sumac)",
                borderRadius: 14,
                padding: "12px 14px",
                fontFamily: "Cairo",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tp.deleteAccount}
            </button>
          </>
        ) : (
          <>
            <p style={{ marginBottom: 12, fontSize: 13.5, color: "var(--sumac)" }}>{tp.deleteAccountConfirm}</p>
            {deleteError && <p className="error-text">{deleteError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deletingAccount}
                style={{
                  flex: 1,
                  background: "var(--sumac)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontFamily: "Cairo",
                  fontSize: 14,
                  cursor: "pointer",
                  opacity: deletingAccount ? 0.7 : 1,
                }}
              >
                {tp.deleteAccountConfirmCta}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deletingAccount}
                style={{
                  flex: 1,
                  background: "none",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontFamily: "Cairo",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {tp.deleteAccountCancel}
              </button>
            </div>
          </>
        )}
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
