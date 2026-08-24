"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, Lang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";

type PlanMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
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
  days: PlanDay[];
  notes: string | null;
  goal: string;
  targetCalories: number;
};

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
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPlan(data.plan);
      }
    } catch {
      setError(tp.title);
    } finally {
      setGenerating(false);
    }
  }

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

          <button className="analyze-cta" onClick={generatePlan} disabled={generating}>
            {generating ? tp.generating : tp.generate}
          </button>

          {generating && (
            <div className="loading-box">
              <div className="spin" />
            </div>
          )}

          {!generating && !plan && (
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
                  {day.meals?.map((meal, mIdx) => (
                    <div key={mIdx} className="diary-meal-row">
                      <div>
                        <strong>{t.diary.slots[meal.slot]}: {meal.food_name}</strong>
                        <div className="diary-meal-cal">
                          {Math.round(meal.calories)} kcal · {t.protein} {Math.round(meal.protein_g)}g ·{" "}
                          {t.carbs} {Math.round(meal.carbs_g)}g · {t.fat} {Math.round(meal.fat_g)}g
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </>
      )}

      <TabsBar lang={lang} />
    </div>
  );
}
