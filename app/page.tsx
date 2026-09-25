"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Lang, dict, useLang } from "@/lib/i18n";
import { addDays, localDateStr } from "@/lib/date";
import { Goal, calculateMacroTargets } from "@/lib/nutrition";
import TabsBar from "@/app/components/TabsBar";
import WelcomeCarousel from "@/app/components/WelcomeCarousel";
import OnboardingWizard from "@/app/components/OnboardingWizard";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "suhoor" | "iftar";

type MealEntry = {
  id: string;
  slot: MealSlot;
  description: string | null;
  items: { food_name: string; food_name_en?: string }[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
};

type DayStat = { date: string; logged: boolean; calories: number };

type Profile = {
  goal: Goal;
  dailyCalorieTarget: number | null;
  dailyWaterTargetMl: number | null;
  ramadanMode: boolean;
};

const STANDARD_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const RAMADAN_SLOTS: MealSlot[] = ["suhoor", "iftar"];
const SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: "☕",
  lunch: "🍛",
  dinner: "🥗",
  snack: "🍪",
  suhoor: "🌙",
  iftar: "🌅",
};
// Arabic week starts Saturday; English starts Sunday. Indexed by getUTCDay().
const WEEKDAY_LETTERS: Record<Lang, string[]> = {
  ar: ["ح", "ن", "ث", "ر", "خ", "ج", "س"],
  en: ["S", "M", "T", "W", "T", "F", "S"],
};
const WEEK_START_DAY: Record<Lang, number> = { ar: 6, en: 0 };

const PLAN_IMAGE = "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=700&q=70&auto=format&fit=crop";
const CHAT_IMAGE = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=700&q=70&auto=format&fit=crop";

function weekStart(today: string, lang: Lang): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, -((dow - WEEK_START_DAY[lang] + 7) % 7));
}

export default function Home() {
  const [lang, setLang] = useLang();
  const { status } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => setProfile(data.profile ?? null))
      .catch(() => {})
      .finally(() => setProfileChecked(true));
  }, [status]);

  if (status === "unauthenticated") return <WelcomeCarousel lang={lang} setLang={setLang} />;
  if (status === "loading" || !profileChecked) {
    return <div style={{ minHeight: "100vh", background: "var(--semolina)" }} />;
  }
  if (!profile) {
    return (
      <OnboardingWizard
        lang={lang}
        onComplete={(p) =>
          setProfile({
            goal: p.goal,
            dailyCalorieTarget: p.dailyCalorieTarget ?? null,
            dailyWaterTargetMl: p.dailyWaterTargetMl ?? null,
            ramadanMode: !!p.ramadanMode,
          })
        }
      />
    );
  }
  return <TodayDashboard lang={lang} setLang={setLang} profile={profile} />;
}

function TodayDashboard({
  lang,
  setLang,
  profile,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  profile: Profile;
}) {
  const t = dict[lang];
  const th = t.home;
  const { data: session } = useSession();
  const today = localDateStr();
  const start = weekStart(today, lang);

  const [meals, setMeals] = useState<MealEntry[] | null>(null);
  const [week, setWeek] = useState<DayStat[]>([]);
  const [streak, setStreak] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoalMl, setWaterGoalMl] = useState(profile.dailyWaterTargetMl ?? 2000);
  const [addingWater, setAddingWater] = useState(false);

  useEffect(() => {
    fetch(`/api/meals?date=${today}`)
      .then((r) => r.json())
      .then((d) => setMeals(d.meals || []))
      .catch(() => setMeals([]));
    fetch("/api/stats/streak")
      .then((r) => r.json())
      .then((d) => setStreak(d.streak || 0))
      .catch(() => {});
    fetch(`/api/water?date=${today}`)
      .then((r) => r.json())
      .then((d) => {
        setWaterMl(d.totalMl || 0);
        if (d.settings?.dailyGoalMl) setWaterGoalMl(d.settings.dailyGoalMl);
      })
      .catch(() => {});
  }, [today]);

  useEffect(() => {
    fetch(`/api/stats/range?start=${start}&days=7`)
      .then((r) => r.json())
      .then((d) => setWeek(d.days || []))
      .catch(() => {});
  }, [start]);

  async function addGlass() {
    setAddingWater(true);
    setWaterMl((v) => v + 250);
    try {
      const res = await fetch("/api/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl: 250 }),
      });
      const data = await res.json();
      if (!data.log) setWaterMl((v) => v - 250);
    } catch {
      setWaterMl((v) => v - 250);
    } finally {
      setAddingWater(false);
    }
  }

  const calorieTarget = profile.dailyCalorieTarget ?? 2000;
  const macroTargets = calculateMacroTargets(calorieTarget, profile.goal);
  const totals = (meals ?? []).reduce(
    (acc, m) => ({
      calories: acc.calories + m.totalCalories,
      protein: acc.protein + m.totalProteinG,
      carbs: acc.carbs + m.totalCarbsG,
      fat: acc.fat + m.totalFatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const left = Math.round(calorieTarget - totals.calories);
  const slots = profile.ramadanMode ? RAMADAN_SLOTS : STANDARD_SLOTS;
  const firstName = (session?.user?.name || "").split(" ")[0];
  const macroRows = [
    { key: "carbs", label: th.carbs, value: totals.carbs, target: macroTargets.carbsG, color: "var(--macro-carbs)" },
    { key: "fat", label: th.fat, value: totals.fat, target: macroTargets.fatG, color: "var(--macro-fat)" },
    { key: "protein", label: th.protein, value: totals.protein, target: macroTargets.proteinG, color: "var(--macro-protein)" },
  ];

  return (
    <div dir={t.dir} className="container today-page">
      <div className="today-header">
        <div>
          {firstName && <p className="today-hello">{lang === "ar" ? `أهلاً ${firstName} 👋` : `Hi ${firstName} 👋`}</p>}
          <h1>{th.title}</h1>
        </div>
        <div className="today-header-actions">
          <span className="streak-chip" title={th.streakDays}>
            🔥 {streak}
          </span>
          <button className="lang-toggle-inline" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            {lang === "ar" ? "EN" : "ع"}
          </button>
        </div>
      </div>

      <div className="week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(start, i);
          const stat = week.find((d) => d.date === date);
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          const isToday = date === today;
          const isFuture = date > today;
          const pct = stat ? Math.min(1, stat.calories / calorieTarget) : 0;
          const content = (
            <>
              <span className={`week-day-letter ${isToday ? "today" : ""}`}>{WEEKDAY_LETTERS[lang][dow]}</span>
              <span
                className={`week-day-ring ${isToday ? "today" : ""} ${stat?.logged ? "logged" : ""}`}
                style={{ ["--pct" as string]: `${pct * 360}deg` }}
              >
                {stat?.logged && pct >= 0.9 ? "✓" : ""}
              </span>
            </>
          );
          return isFuture ? (
            <span key={date} className="week-day future">
              {content}
            </span>
          ) : (
            <Link key={date} href={`/diary?date=${date}`} className="week-day">
              {content}
            </Link>
          );
        })}
      </div>

      <Link href="/diary" className="dash-card calories-card">
        <p className="dash-card-title">{th.calories}</p>
        <div className="calories-row">
          <p className="calories-eaten">
            <strong>{Math.round(totals.calories)}</strong>
            <span> / {Math.round(calorieTarget)} 🔥</span>
          </p>
          <p className={`calories-left ${left < 0 ? "over" : ""}`}>
            <strong>{Math.abs(left)}</strong> {left < 0 ? th.over : th.left}
          </p>
        </div>
        <div className="dash-bar">
          <div
            className={`dash-bar-fill ${left < 0 ? "over" : ""}`}
            style={{ width: `${Math.min(100, (totals.calories / calorieTarget) * 100)}%` }}
          />
        </div>
      </Link>

      <div className="dash-card macros-card">
        {macroRows.map((m) => (
          <div key={m.key} className="macro-col">
            <p className="macro-col-label">{m.label}</p>
            <p className="macro-col-value">
              <strong>{Math.round(m.value)}g</strong>
              <span> / {m.target}</span>
            </p>
            <div className="dash-bar small">
              <div
                className="dash-bar-fill"
                style={{ width: `${Math.min(100, (m.value / m.target) * 100)}%`, background: m.color }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="dash-card water-card">
        <div className="water-card-info">
          <span className="water-card-icon">💧</span>
          <div>
            <p className="dash-card-title">{th.water}</p>
            <p className="water-card-amount">
              <strong>{(waterMl / 1000).toFixed(2)}</strong> / {(waterGoalMl / 1000).toFixed(1)} L
            </p>
          </div>
        </div>
        <button className="pill-btn water-pill" onClick={addGlass} disabled={addingWater}>
          {th.addWater}
        </button>
        <div className="dash-bar small water-card-bar">
          <div className="dash-bar-fill water" style={{ width: `${Math.min(100, (waterMl / waterGoalMl) * 100)}%` }} />
        </div>
      </div>

      <div className="section-header">
        <h2>{th.meals}</h2>
        <Link href="/diary">{th.viewDiary}</Link>
      </div>

      {slots.map((slot) => {
        const slotMeals = (meals ?? []).filter((m) => m.slot === slot);
        const kcal = slotMeals.reduce((s, m) => s + m.totalCalories, 0);
        const names = slotMeals
          .flatMap((m) =>
            m.items?.length
              ? m.items.map((i) => (lang === "ar" ? i.food_name : i.food_name_en || i.food_name))
              : [m.description || ""]
          )
          .filter(Boolean)
          .join(lang === "ar" ? "، " : ", ");
        return (
          <div key={slot} className="meal-slot-card">
            <span className="meal-slot-icon">{SLOT_ICONS[slot]}</span>
            <div className="meal-slot-info">
              <p className="meal-slot-name">{t.diary.slots[slot]}</p>
              {slotMeals.length > 0 && (
                <p className="meal-slot-items">
                  {Math.round(kcal)} kcal · {names}
                </p>
              )}
            </div>
            <Link href={`/log?slot=${slot}`} className="meal-slot-log">
              {th.logCta}
            </Link>
          </div>
        );
      })}

      <div className="discover-row">
        <Link href="/plan" className="discover-card" style={{ backgroundImage: `url(${PLAN_IMAGE})` }}>
          <span className="discover-overlay" />
          <span className="discover-text">
            🗓️ {t.plan.title}
          </span>
        </Link>
        <Link href="/chat" className="discover-card" style={{ backgroundImage: `url(${CHAT_IMAGE})` }}>
          <span className="discover-overlay" />
          <span className="discover-text">💬 {t.chat.title}</span>
        </Link>
      </div>

      <TabsBar lang={lang} />
    </div>
  );
}
