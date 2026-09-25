"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lang, dict, useLang } from "@/lib/i18n";
import { localDateStr } from "@/lib/date";
import { Goal, calculateMacroTargets } from "@/lib/nutrition";
import TabsBar from "@/app/components/TabsBar";
import { BarChart, LineChart } from "@/app/components/Charts";

type Tab = "overview" | "calories" | "macros" | "weight" | "water";
const TABS: Tab[] = ["overview", "calories", "macros", "weight", "water"];

type DayStat = { date: string; logged: boolean; calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number };
type WeightLog = { date: string; weightKg: number };
type Profile = { goal: Goal; dailyCalorieTarget: number | null; dailyWaterTargetMl: number | null; weightKg: number | null };

const WEEKDAY_SHORT: Record<Lang, string[]> = {
  ar: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const WEEKDAY_LETTER: Record<Lang, string[]> = {
  ar: ["ح", "ن", "ث", "ر", "خ", "ج", "س"],
  en: ["S", "M", "T", "W", "T", "F", "S"],
};

function dayLabels(date: string, lang: Lang, many: boolean) {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay();
  const dm = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  return {
    label: many ? String(d.getUTCDate()) : WEEKDAY_LETTER[lang][dow],
    tooltipLabel: `${WEEKDAY_SHORT[lang][dow]} ${dm}`,
  };
}

function avgOfLogged(days: DayStat[], pick: (d: DayStat) => number) {
  const logged = days.filter((d) => d.logged);
  return logged.length ? Math.round(logged.reduce((s, d) => s + pick(d), 0) / logged.length) : 0;
}

export default function ProgressPage() {
  const [lang, setLang] = useLang();
  const t = dict[lang];
  const tp = t.progress;
  const { status } = useSession();
  const router = useRouter();
  const today = localDateStr();

  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<7 | 30>(7);
  const [days, setDays] = useState<DayStat[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (requested && TABS.includes(requested)) setTab(requested);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile ?? null))
      .catch(() => {});
    fetch("/api/weight")
      .then((r) => r.json())
      .then((d) => setWeights(d.logs || []))
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/stats/range?days=${range}`)
      .then((r) => r.json())
      .then((d) => setDays(d.days || []))
      .catch(() => {});
  }, [status, range]);

  async function logWeight(e: React.FormEvent) {
    e.preventDefault();
    const weightKg = Number(newWeight);
    if (!weightKg || weightKg <= 0) return;
    setSavingWeight(true);
    setWeightError("");
    try {
      const res = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg }),
      });
      const data = await res.json();
      if (!data.log) {
        setWeightError(t.auth.genericError);
        return;
      }
      if (data.profile) setProfile(data.profile);
      setNewWeight("");
      const logs = await fetch("/api/weight").then((r) => r.json());
      setWeights(logs.logs || []);
    } catch {
      setWeightError(t.auth.genericError);
    } finally {
      setSavingWeight(false);
    }
  }

  if (status !== "authenticated") {
    return <div style={{ minHeight: "100vh", background: "var(--semolina)" }} />;
  }

  const many = range === 30;
  const calorieTarget = profile?.dailyCalorieTarget ?? 0;
  const waterGoal = profile?.dailyWaterTargetMl ?? 0;
  const macroTargets = calorieTarget && profile ? calculateMacroTargets(calorieTarget, profile.goal) : null;
  const bars = (pick: (d: DayStat) => number) =>
    days.map((d) => ({ key: d.date, value: pick(d), ...dayLabels(d.date, lang, many) }));

  const startWeight = weights[0]?.weightKg;
  const currentWeight = weights[weights.length - 1]?.weightKg ?? profile?.weightKg ?? undefined;
  const change = startWeight != null && currentWeight != null ? Math.round((currentWeight - startWeight) * 10) / 10 : null;
  const avgCalories = avgOfLogged(days, (d) => d.calories);
  const loggedDays = days.filter((d) => d.logged).length;

  const show = (card: Tab) => tab === "overview" || tab === card;

  return (
    <div dir={t.dir} className="container today-page">
      <div className="today-header">
        <h1>{tp.title}</h1>
        <button className="lang-toggle-inline" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "EN" : "ع"}
        </button>
      </div>

      <div className="progress-tabs">
        {TABS.map((k) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {tp.tabs[k]}
          </button>
        ))}
      </div>

      <div className="range-toggle">
        {([7, 30] as const).map((r) => (
          <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
            {r === 7 ? tp.last7 : tp.last30}
          </button>
        ))}
      </div>

      {show("calories") && (
        <div className="dash-card">
          <p className="dash-card-title">{tp.calories}</p>
          <div className="progress-stat-row">
            <div>
              <p className="progress-stat-label">{tp.dailyAvg}</p>
              <p className="progress-stat-value">
                {avgCalories} <small>kcal</small>
              </p>
            </div>
            <div>
              <p className="progress-stat-label">{tp.daysLogged}</p>
              <p className="progress-stat-value">
                {loggedDays}
                <small> / {range}</small>
              </p>
            </div>
          </div>
          <BarChart
            data={bars((d) => d.calories)}
            color="var(--saffron)"
            goal={calorieTarget || undefined}
            goalLabel={tp.goal}
            formatValue={(v) => `${v} kcal`}
            highlightKey={today}
            rtl={t.dir === "rtl"}
          />
        </div>
      )}

      {show("weight") && (
        <div className="dash-card">
          <p className="dash-card-title">{tp.weight}</p>
          <div className="progress-stat-row three">
            <div>
              <p className="progress-stat-label">{tp.start}</p>
              <p className="progress-stat-value">{startWeight != null ? `${startWeight}` : "—"} <small>kg</small></p>
            </div>
            <div>
              <p className="progress-stat-label">{tp.current}</p>
              <p className="progress-stat-value">{currentWeight != null ? `${currentWeight}` : "—"} <small>kg</small></p>
            </div>
            <div>
              <p className="progress-stat-label">{tp.change}</p>
              <p className={`progress-stat-value ${change != null && change < 0 ? "good" : ""}`}>
                {change == null ? "—" : `${change > 0 ? "↗ +" : change < 0 ? "↘ " : ""}${change}`} <small>kg</small>
              </p>
            </div>
          </div>
          <LineChart
            points={weights.map((w) => {
              const d = w.date.slice(0, 10);
              return { key: d, label: dayLabels(d, lang, true).tooltipLabel, value: w.weightKg };
            })}
            color="var(--zaatar)"
            formatValue={(v) => `${v} kg`}
            emptyLabel={tp.noWeight}
            rtl={t.dir === "rtl"}
          />
          <form onSubmit={logWeight} className="inline-form">
            <input
              type="number"
              step="0.1"
              min={20}
              max={400}
              inputMode="decimal"
              placeholder={tp.weightPlaceholder}
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
            <button className="pill-btn" type="submit" disabled={savingWeight || !newWeight}>
              {tp.logWeight}
            </button>
          </form>
          {weightError && <p className="error-text">{weightError}</p>}
        </div>
      )}

      {show("macros") && macroTargets && (
        <div className="dash-card">
          <p className="dash-card-title">{tp.macros}</p>
          <p className="progress-stat-label" style={{ marginBottom: 10 }}>{tp.dailyAvgVsGoal}</p>
          {[
            { key: "carbs", label: t.home.carbs, avg: avgOfLogged(days, (d) => d.carbsG), target: macroTargets.carbsG, color: "var(--macro-carbs)" },
            { key: "protein", label: t.home.protein, avg: avgOfLogged(days, (d) => d.proteinG), target: macroTargets.proteinG, color: "var(--macro-protein)" },
            { key: "fat", label: t.home.fat, avg: avgOfLogged(days, (d) => d.fatG), target: macroTargets.fatG, color: "var(--macro-fat)" },
          ].map((m) => (
            <div key={m.key} className="macro-avg-row">
              <div className="macro-avg-head">
                <span>
                  <i className="legend-dot" style={{ background: m.color }} />
                  {m.label}
                </span>
                <span>
                  <strong>{m.avg}g</strong> / {m.target}g
                </span>
              </div>
              <div className="dash-bar small">
                <div className="dash-bar-fill" style={{ width: `${Math.min(100, (m.avg / m.target) * 100)}%`, background: m.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {show("water") && (
        <div className="dash-card">
          <p className="dash-card-title">{tp.water}</p>
          <div className="progress-stat-row">
            <div>
              <p className="progress-stat-label">{tp.dailyAvg}</p>
              <p className="progress-stat-value">
                {(Math.round(days.reduce((s, d) => s + d.waterMl, 0) / Math.max(1, days.length)) / 1000).toFixed(1)} <small>L</small>
              </p>
            </div>
          </div>
          <BarChart
            data={bars((d) => d.waterMl)}
            color="#2a78b8"
            goal={waterGoal || undefined}
            goalLabel={tp.goal}
            formatValue={(v) => `${(v / 1000).toFixed(2)} L`}
            highlightKey={today}
            rtl={t.dir === "rtl"}
          />
        </div>
      )}

      <TabsBar lang={lang} />
    </div>
  );
}
