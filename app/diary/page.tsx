"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, Lang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";
import { addDays, localDateStr } from "@/lib/date";
import { getAdaptiveDiaryTip } from "@/lib/nutrition";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

type MealItem = { food_name: string; food_name_en?: string };

type MealEntry = {
  id: string;
  slot: MealSlot;
  description: string | null;
  items: MealItem[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
};

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export default function DiaryPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const td = t.diary;
  const { data: session, status } = useSession();

  const [dateStr, setDateStr] = useState(() => localDateStr());
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    Promise.all([
      fetch(`/api/meals?date=${dateStr}`).then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ])
      .then(([mealsData, profileData]) => {
        setMeals(mealsData.meals || []);
        setHasProfile(!!profileData.profile);
        setCalorieTarget(profileData.profile?.dailyCalorieTarget ?? null);
      })
      .finally(() => setLoading(false));
  }, [status, dateStr]);

  async function deleteMeal(id: string) {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/meals/${id}`, { method: "DELETE" }).catch(() => {});
  }

  const totals = useMemo(
    () =>
      meals.reduce(
        (acc, m) => ({
          calories: acc.calories + m.totalCalories,
          protein: acc.protein + m.totalProteinG,
          carbs: acc.carbs + m.totalCarbsG,
          fat: acc.fat + m.totalFatG,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [meals]
  );

  const remaining = calorieTarget != null ? Math.round(calorieTarget - totals.calories) : null;
  const adaptiveTip =
    calorieTarget != null && meals.length > 0
      ? getAdaptiveDiaryTip(totals.calories, calorieTarget)
      : "none";
  const ringPct = calorieTarget ? Math.min(1, totals.calories / calorieTarget) : 0;
  const circumference = 326.7;

  const grouped: Record<MealSlot, MealEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  meals.forEach((m) => grouped[m.slot]?.push(m));

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
          <p style={{ marginBottom: 14 }}>{td.title}</p>
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
        <h1 className="title">{td.title}</h1>
      </div>

      <div className="date-nav">
        <button onClick={() => setDateStr(addDays(dateStr, -1))}>‹</button>
        <span>{dateStr === localDateStr() ? td.today : dateStr}</span>
        <button onClick={() => setDateStr(addDays(dateStr, 1))}>›</button>
      </div>

      {hasProfile === false && (
        <div className="tip-card">
          <p style={{ marginBottom: 10 }}>{td.noProfile}</p>
          <Link href="/profile" className="analyze-cta" style={{ display: "block", textAlign: "center" }}>
            {td.completeProfile}
          </Link>
        </div>
      )}

      {loading ? (
        <div className="loading-box">
          <div className="spin" />
        </div>
      ) : (
        <>
          <div className="plate-wrap">
            <div className="plate">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e6dcc8" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#e8a33d"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - ringPct)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="plate-center">
                <div className="cal">{remaining != null ? remaining : totals.calories}</div>
                <div className="cal-label">{remaining != null ? td.remaining : t.calories}</div>
              </div>
            </div>
          </div>

          <div className="macro-row">
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--saffron)" }} />
              <div className="val">{Math.round(totals.protein)}g</div>
              <div className="lbl">{t.protein}</div>
            </div>
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--sumac)" }} />
              <div className="val">{Math.round(totals.carbs)}g</div>
              <div className="lbl">{t.carbs}</div>
            </div>
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--zaatar)" }} />
              <div className="val">{Math.round(totals.fat)}g</div>
              <div className="lbl">{t.fat}</div>
            </div>
          </div>

          {calorieTarget != null && (
            <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--taupe)", marginBottom: 20 }}>
              {td.consumed}: {Math.round(totals.calories)} / {td.goal}: {Math.round(calorieTarget)} kcal
            </p>
          )}

          {adaptiveTip !== "none" && (
            <div className={adaptiveTip === "over" ? "hidden-fat-flag" : "tip-card"}>
              {adaptiveTip === "watch" ? "⚖️ " : "🔄 "}
              {adaptiveTip === "watch" ? td.adaptiveWatch : td.adaptiveOver}
            </div>
          )}

          {meals.length === 0 && (
            <div className="tip-card" style={{ textAlign: "center" }}>
              <p style={{ marginBottom: 10 }}>{td.empty}</p>
              <Link href="/" className="analyze-cta" style={{ display: "block" }}>
                {td.addMeal}
              </Link>
            </div>
          )}

          {SLOT_ORDER.filter((slot) => grouped[slot].length > 0).map((slot) => (
            <div key={slot} className="tip-card">
              <h3>{td.slots[slot]}</h3>
              {grouped[slot].map((meal) => (
                <div key={meal.id} className="diary-meal-row">
                  <div>
                    <strong>
                      {meal.items?.map((i) => (lang === "ar" ? i.food_name : i.food_name_en || i.food_name)).join("، ") ||
                        meal.description}
                    </strong>
                    <div className="diary-meal-cal">{Math.round(meal.totalCalories)} kcal</div>
                  </div>
                  <button className="diary-delete-btn" onClick={() => deleteMeal(meal.id)} aria-label={td.delete}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      <TabsBar lang={lang} />
    </div>
  );
}
