"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, Lang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";

type PlanMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "suhoor" | "iftar";
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type PlanDay = {
  day_label: string;
  target_calories: number;
  meals: PlanMeal[];
};

type MealPlan = {
  id: string;
  startDate: string;
  days: PlanDay[];
  notes: string | null;
  goal: string;
  targetCalories: number;
  completedMeals: string[];
};

function getCompletedFoodNames(plan: MealPlan | null): string[] {
  if (!plan) return [];
  const names = new Set<string>();
  plan.days?.forEach((day, dayIdx) => {
    day.meals?.forEach((meal) => {
      if (plan.completedMeals?.includes(`${dayIdx}-${meal.slot}`)) names.add(meal.food_name);
    });
  });
  return Array.from(names);
}

const CUISINE_CHIPS = [
  "cuisineShami",
  "cuisineGulf",
  "cuisineEgyptian",
  "cuisineMaghrebi",
  "cuisineLight",
  "cuisineHighProtein",
] as const;

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function PlanPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const tp = t.plan;
  const { data: session, status } = useSession();

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [preferencesText, setPreferencesText] = useState("");
  const [keepCandidates, setKeepCandidates] = useState<string[]>([]);
  const [keepMeals, setKeepMeals] = useState<string[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/meal-plan").then((r) => r.json()),
    ])
      .then(([profileData, planData]) => {
        setHasProfile(!!profileData.profile);
        setPlan(planData.plan || null);
      })
      .finally(() => setLoading(false));
  }, [status]);

  async function generatePlan() {
    setGenerating(true);
    setError("");
    try {
      const preferences = [...selectedChips.map((key) => tp[key as keyof typeof tp]), preferencesText.trim()]
        .filter(Boolean)
        .join("، ");
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: 7,
          force: true,
          preferences: preferences || undefined,
          keepMeals: keepMeals.length > 0 ? keepMeals : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPlan(data.plan);
        setShowPreferences(false);
        setSelectedChips([]);
        setPreferencesText("");
        setKeepCandidates([]);
        setKeepMeals([]);
      }
    } catch {
      setError(tp.title);
    } finally {
      setGenerating(false);
    }
  }

  function toggleChip(key: string) {
    setSelectedChips((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleKeepMeal(name: string) {
    setKeepMeals((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function openPreferences() {
    const candidates = getCompletedFoodNames(plan);
    setKeepCandidates(candidates);
    setKeepMeals(candidates);
    setShowPreferences(true);
  }

  async function toggleMealDone(dayIndex: number, slot: string, completed: boolean) {
    if (!plan) return;
    const key = `${dayIndex}-${slot}`;
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            completedMeals: completed
              ? [...(prev.completedMeals || []), key]
              : (prev.completedMeals || []).filter((k) => k !== key),
          }
        : prev
    );
    try {
      const res = await fetch("/api/meal-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex, slot, completed }),
      });
      const data = await res.json();
      if (data.plan) setPlan(data.plan);
    } catch {
      // leave the optimistic state - the user can just toggle again
    }
  }

  const planIsActive = !!plan && Date.now() - new Date(plan.startDate).getTime() < ONE_WEEK_MS;

  if (status === "loading" || loading) {
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
      <p className="tagline">{tp.subtitle}</p>

      {hasProfile === false ? (
        <div className="tip-card">
          <p style={{ marginBottom: 10 }}>{tp.noProfile}</p>
          <Link href="/profile" className="analyze-cta" style={{ display: "block", textAlign: "center" }}>
            {tp.completeProfile}
          </Link>
        </div>
      ) : (
        <>
          {error && <p className="error-text">{error}</p>}

          {showPreferences ? (
            <div className="form-card">
              {keepCandidates.length > 0 && (
                <>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--taupe)", marginBottom: 10 }}>
                    {tp.keepMealsTitle}
                  </label>
                  <div className="feedback-row" style={{ flexWrap: "wrap" }}>
                    {keepCandidates.map((name) => (
                      <button
                        key={name}
                        style={{
                          flex: "1 1 auto",
                          minWidth: 80,
                          background: keepMeals.includes(name) ? "var(--saffron)" : "var(--card)",
                        }}
                        onClick={() => toggleKeepMeal(name)}
                        disabled={generating}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--taupe)", margin: "14px 0 10px" }}>
                {tp.preferencesTitle}
              </label>
              <div className="feedback-row" style={{ flexWrap: "wrap" }}>
                {CUISINE_CHIPS.map((key) => (
                  <button
                    key={key}
                    style={{
                      flex: "1 1 auto",
                      minWidth: 80,
                      background: selectedChips.includes(key) ? "var(--saffron)" : "var(--card)",
                    }}
                    onClick={() => toggleChip(key)}
                    disabled={generating}
                  >
                    {tp[key]}
                  </button>
                ))}
              </div>
              <div className="desc-input" style={{ marginTop: 10 }}>
                <input
                  type="text"
                  placeholder={tp.preferencesPlaceholder}
                  value={preferencesText}
                  onChange={(e) => setPreferencesText(e.target.value)}
                  disabled={generating}
                />
              </div>
              <div className="feedback-row">
                <button
                  onClick={() => {
                    setShowPreferences(false);
                    setSelectedChips([]);
                    setPreferencesText("");
                    setKeepCandidates([]);
                    setKeepMeals([]);
                  }}
                  disabled={generating}
                >
                  {tp.preferencesCancel}
                </button>
                <button className="analyze-cta" onClick={generatePlan} disabled={generating} style={{ marginTop: 0 }}>
                  {generating ? tp.generating : tp.preferencesConfirm}
                </button>
              </div>
            </div>
          ) : (
            !plan || !planIsActive ? (
              <button className="analyze-cta" onClick={openPreferences}>
                {tp.generate}
              </button>
            ) : null
          )}

          {generating && (
            <div className="loading-box">
              <div className="spin" />
            </div>
          )}

          {!generating && !showPreferences && !plan && (
            <p style={{ textAlign: "center", color: "var(--taupe)", fontSize: 13, marginTop: 20 }}>
              {tp.empty}
            </p>
          )}

          {!generating && plan && (
            <>
              {plan.notes && (
                <div className="tip-card">
                  <h3>💡 {tp.notesTitle}</h3>
                  <p>{plan.notes}</p>
                </div>
              )}

              {plan.days?.map((day, idx) => (
                <div key={idx} className="tip-card">
                  <h3>
                    🗓️ {day.day_label} — {Math.round(day.target_calories)} kcal
                  </h3>
                  {day.meals?.map((meal, mIdx) => {
                    const isDone = plan.completedMeals?.includes(`${idx}-${meal.slot}`);
                    return (
                      <div key={mIdx} className="diary-meal-row">
                        <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={!!isDone}
                            onChange={(e) => toggleMealDone(idx, meal.slot, e.target.checked)}
                            style={{ width: "auto", flexShrink: 0 }}
                          />
                          <div>
                            <strong style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.6 : 1 }}>
                              {t.diary.slots[meal.slot]}: {meal.food_name}
                            </strong>
                            <div className="diary-meal-cal">
                              {Math.round(meal.calories)} kcal · {t.protein} {Math.round(meal.protein_g)}g ·{" "}
                              {t.carbs} {Math.round(meal.carbs_g)}g · {t.fat} {Math.round(meal.fat_g)}g
                            </div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ))}

              {planIsActive && !showPreferences && (
                <>
                  <p style={{ textAlign: "center", color: "var(--taupe)", fontSize: 12.5, marginTop: 10 }}>
                    {tp.activeNote}
                  </p>
                  <button
                    className="analyze-cta"
                    style={{ background: "var(--card)", color: "var(--tanoor)", border: "1px solid var(--line)" }}
                    onClick={openPreferences}
                  >
                    {tp.newPlan}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}

      <TabsBar lang={lang} />
    </div>
  );
}
