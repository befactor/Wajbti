"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { dict, useLang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";
import { addDays, localDateStr } from "@/lib/date";
import { getAdaptiveDiaryTip, estimateCaloriesBurnedFromSteps } from "@/lib/nutrition";
import Steps from "@/lib/capacitor/steps";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "suhoor" | "iftar";

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
  diningContext: string | null;
};

type FavoriteMeal = {
  id: string;
  foodName: string;
  items: MealItem[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number | null;
  totalSugarG: number | null;
  totalSodiumMg: number | null;
};

const STANDARD_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const RAMADAN_SLOTS: MealSlot[] = ["suhoor", "iftar"];

export default function DiaryPage() {
  const [lang, setLang] = useLang();
  const t = dict[lang];
  const td = t.diary;
  const { data: session, status } = useSession();

  const [dateStr, setDateStr] = useState(() => localDateStr());
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [stepsToday, setStepsToday] = useState<number | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [ramadanMode, setRamadanMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [favoriteSlot, setFavoriteSlot] = useState<MealSlot>("breakfast");
  const [loggingFavoriteId, setLoggingFavoriteId] = useState<string | null>(null);
  const [justLoggedFavoriteId, setJustLoggedFavoriteId] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    setNotifPermission(await Notification.requestPermission());
  }

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
        setWeightKg(profileData.profile?.weightKg ?? null);
        const isRamadan = !!profileData.profile?.ramadanMode;
        setRamadanMode(isRamadan);
        setFavoriteSlot(isRamadan ? "suhoor" : "breakfast");
      })
      .finally(() => setLoading(false));
  }, [status, dateStr]);

  useEffect(() => {
    if (status !== "authenticated" || !Capacitor.isNativePlatform() || dateStr !== localDateStr()) {
      setStepsToday(null);
      return;
    }
    Steps.getTodaySteps()
      .then((data) => setStepsToday(Math.round(data.steps)))
      .catch(() => setStepsToday(null));
  }, [status, dateStr]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data) => setFavorites(data.favorites || []))
      .catch(() => {});
  }, [status]);

  async function logFavorite(fav: FavoriteMeal) {
    setLoggingFavoriteId(fav.id);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: favoriteSlot,
          date: dateStr,
          description: fav.foodName,
          inputType: "text",
          items: fav.items,
          totals: {
            calories: fav.totalCalories,
            protein_g: fav.totalProteinG,
            carbs_g: fav.totalCarbsG,
            fat_g: fav.totalFatG,
            fiber_g: fav.totalFiberG,
            sugar_g: fav.totalSugarG,
            sodium_mg: fav.totalSodiumMg,
          },
        }),
      });
      const data = await res.json();
      if (data.meal) {
        setMeals((prev) => [...prev, data.meal]);
        setJustLoggedFavoriteId(fav.id);
        setTimeout(() => setJustLoggedFavoriteId((cur) => (cur === fav.id ? null : cur)), 2000);
      }
    } catch {
      // no-op: user can retry
    } finally {
      setLoggingFavoriteId(null);
    }
  }

  async function deleteFavorite(id: string) {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/favorites/${id}`, { method: "DELETE" }).catch(() => {});
  }

  // Best-effort "you haven't logged anything today" nudge - same in-tab
  // notification approach as the water reminders (only fires while a tab is
  // open; real background push needs the Capacitor app later). Guarded by
  // localStorage so it fires at most once per calendar day even across
  // reloads, and only once meals for *today* have actually loaded.
  useEffect(() => {
    if (
      status !== "authenticated" ||
      loading ||
      dateStr !== localDateStr() ||
      notifPermission !== "granted" ||
      meals.length > 0
    ) {
      return;
    }
    const currentHour = new Date().getHours();
    if (currentHour < 14) return;

    const storageKey = `wajbti_meal_reminder_notified_${dateStr}`;
    if (localStorage.getItem(storageKey)) return;

    new Notification(td.title, {
      body: lang === "ar" ? "لم تُسجّل وجبة اليوم بعد 🍽️" : "You haven't logged a meal today yet 🍽️",
    });
    localStorage.setItem(storageKey, "1");
  }, [status, loading, dateStr, notifPermission, meals, lang, td.title]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/stats/streak")
      .then((r) => r.json())
      .then((data) => setStreak(data.streak || 0))
      .catch(() => {});
  }, [status, dateStr]);

  const SLOT_ORDER = ramadanMode ? RAMADAN_SLOTS : STANDARD_SLOTS;

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

  const caloriesBurned =
    stepsToday != null && weightKg != null ? estimateCaloriesBurnedFromSteps(stepsToday, weightKg) : 0;
  const remaining =
    calorieTarget != null ? Math.round(calorieTarget - totals.calories + caloriesBurned) : null;
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
    suhoor: [],
    iftar: [],
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
        <h1 className="title">{td.title}</h1>
      </div>

      <div className="date-nav">
        <button onClick={() => setDateStr(addDays(dateStr, -1))}>‹</button>
        <span>{dateStr === localDateStr() ? td.today : dateStr}</span>
        <button onClick={() => setDateStr(addDays(dateStr, 1))}>›</button>
      </div>

      {streak > 1 && <p className="streak-badge">🔥 {td.streakLabel.replace("{n}", String(streak))}</p>}

      {hasProfile === false && (
        <div className="tip-card">
          <p style={{ marginBottom: 10 }}>{td.noProfile}</p>
          <Link href="/profile" className="analyze-cta" style={{ display: "block", textAlign: "center" }}>
            {td.completeProfile}
          </Link>
        </div>
      )}

      {notifPermission === "default" && (
        <div className="tip-card">
          <p style={{ marginBottom: 10 }}>{td.notifPermissionNote}</p>
          <button className="analyze-cta" onClick={requestNotifications}>
            {td.enableNotifications}
          </button>
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
            <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--taupe)", marginBottom: stepsToday != null ? 6 : 20 }}>
              {td.consumed}: {Math.round(totals.calories)} / {td.goal}: {Math.round(calorieTarget)} kcal
            </p>
          )}

          {stepsToday != null && (
            <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--taupe)", marginBottom: 20 }}>
              🚶 {td.stepsToday}: {stepsToday.toLocaleString()}
              {caloriesBurned > 0 && <> · 🔥 {td.activityBurned}: {caloriesBurned} kcal</>}
            </p>
          )}

          {adaptiveTip !== "none" && (
            <div
              className={
                adaptiveTip === "over" ? "hidden-fat-flag" : adaptiveTip === "good" ? "dining-badge" : "tip-card"
              }
            >
              {adaptiveTip === "watch" && "⚖️ "}
              {adaptiveTip === "good" && "🎉 "}
              {adaptiveTip === "over" && "🔄 "}
              {adaptiveTip === "watch" && td.adaptiveWatch}
              {adaptiveTip === "good" && td.adaptiveGood}
              {adaptiveTip === "over" && td.adaptiveOver}
            </div>
          )}

          {favorites.length > 0 && (
            <div className="tip-card">
              <h3>{td.favoritesTitle}</h3>
              <div className="form-field">
                <select value={favoriteSlot} onChange={(e) => setFavoriteSlot(e.target.value as MealSlot)}>
                  {SLOT_ORDER.map((slot) => (
                    <option key={slot} value={slot}>
                      {td.slots[slot]}
                    </option>
                  ))}
                </select>
              </div>
              {favorites.map((fav) => (
                <div key={fav.id} className="diary-meal-row">
                  <div>
                    <strong>{fav.foodName}</strong>
                    <div className="diary-meal-cal">{Math.round(fav.totalCalories)} kcal</div>
                  </div>
                  {justLoggedFavoriteId === fav.id ? (
                    <span style={{ color: "var(--zaatar)", fontWeight: 700, fontSize: 12.5 }}>
                      {td.favoriteLogged}
                    </span>
                  ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => logFavorite(fav)}
                        disabled={loggingFavoriteId === fav.id}
                        style={{ width: "auto" }}
                      >
                        {td.logFavorite}
                      </button>
                      <button
                        className="diary-delete-btn"
                        onClick={() => deleteFavorite(fav.id)}
                        aria-label={td.delete}
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              ))}
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
                      {meal.diningContext === "restaurant" && "🍽️ "}
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
