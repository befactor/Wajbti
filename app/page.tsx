"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, Lang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";

type PortionComponent = {
  component: string;
  household_measure: string;
  weight_g: number;
};

type AnalysisItem = {
  food_name: string;
  food_name_en?: string;
  estimated_weight_g: number;
  portion_breakdown?: PortionComponent[];
  hidden_fat_detected: boolean;
  confidence_score: string;
  is_standard_portion_estimate?: boolean;
};

type AnalysisResult = {
  input_type?: "image" | "text";
  dining_mode?: boolean;
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  items: AnalysisItem[];
  ai_nutritionist_tip: string;
  healthy_swap_suggestion: string;
  medical_disclaimer_flag?: boolean;
  needs_clarification?: boolean;
  clarification_question?: string;
};

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "suhoor" | "iftar";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const { data: session, status } = useSession();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>("breakfast");
  const [savingMeal, setSavingMeal] = useState(false);
  const [savedToDiary, setSavedToDiary] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string>("image/jpeg");
  const [diningMode, setDiningMode] = useState(false);
  const [ramadanMode, setRamadanMode] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const isRamadan = !!data.profile?.ramadanMode;
        setRamadanMode(isRamadan);
        setSelectedSlot(isRamadan ? "suhoor" : "breakfast");
      })
      .catch(() => {});
  }, [status]);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition: SpeechRecognitionLike = new (SpeechRecognitionCtor as new () => SpeechRecognitionLike)();
    recognition.lang = lang === "ar" ? "ar-SA" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setDescription((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] || null);
      setImageMediaType(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearImage() {
    setImagePreview(null);
    setImageBase64(null);
  }

  async function analyze() {
    if (!description.trim() && !imageBase64) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSavedToDiary(false);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim() || undefined,
          imageBase64: imageBase64 || undefined,
          mediaType: imageBase64 ? imageMediaType : undefined,
          diningMode,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(lang === "ar" ? "صار خطأ، جرب مرة تانية" : "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(correct: boolean) {
    if (!result) return;
    if (correct) return; // ما في شي نعمله لو صح
    // المستخدم يصحح اسم الأكلة بس - الأرقام (سعرات/وزن) مسؤولية النظام حصراً
    const correctedFoodName = window.prompt(
      lang === "ar" ? "شو اسم الأكلة الصحيح؟" : "What's the correct food name?"
    );
    if (!correctedFoodName) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        original_description: description,
        corrected_food_name: correctedFoodName,
      }),
    }).catch(() => {});
    alert(lang === "ar" ? "يسلمو! سجلنا ملاحظتك" : "Thanks! Feedback recorded");
  }

  async function addToDiary() {
    if (!result) return;
    setSavingMeal(true);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: selectedSlot,
          description,
          inputType: result.input_type || "text",
          items: result.items,
          totals: result.totals,
          aiTip: result.ai_nutritionist_tip,
          swapSuggestion: result.healthy_swap_suggestion,
          diningContext: result.dining_mode ? "restaurant" : undefined,
        }),
      });
      const data = await res.json();
      if (!data.error) setSavedToDiary(true);
    } catch {
      // no-op: user can retry
    } finally {
      setSavingMeal(false);
    }
  }

  return (
    <div dir={t.dir} className="container">
      <button className="lang-toggle" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div className="top-nav">
        {status === "authenticated" ? (
          <>
            <span>{session.user?.name || session.user?.email}</span>
            <button onClick={() => signOut({ callbackUrl: "/" })}>{t.auth.signOut}</button>
          </>
        ) : status === "unauthenticated" ? (
          <Link href="/auth/signin">{t.auth.signInCta}</Link>
        ) : (
          <span />
        )}
      </div>

      <div className="brand">
        <div className="brand-mark" />
        <h1 className="title">{t.appName}</h1>
      </div>
      <p className="tagline">{t.tagline}</p>

      {!result && !loading && (
        <>
          {imagePreview ? (
            <div className="image-preview-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt={t.captureTitle} />
              <button className="image-remove-btn" onClick={clearImage} aria-label={t.removeImage}>
                ✕
              </button>
            </div>
          ) : (
            <div className="capture-card">
              <label className="capture-btn" htmlFor="meal-photo-input">
                🍽️
              </label>
              <input
                id="meal-photo-input"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
              <h2>{t.captureTitle}</h2>
              <p>{t.captureDesc}</p>
            </div>
          )}

          <div className="desc-input">
            <input
              type="text"
              placeholder={t.placeholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
            />
            {speechSupported && (
              <button
                type="button"
                className={`mic-btn ${listening ? "listening" : ""}`}
                onClick={toggleListening}
                aria-label={t.voiceInput}
              >
                🎙️
              </button>
            )}
          </div>

          <label className="dining-toggle">
            <input type="checkbox" checked={diningMode} onChange={(e) => setDiningMode(e.target.checked)} />
            {t.diningModeLabel}
          </label>

          {error && <p style={{ color: "var(--sumac)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

          <button className="analyze-cta" onClick={analyze} disabled={!description.trim() && !imageBase64}>
            {t.analyzeCta}
          </button>
        </>
      )}

      {loading && (
        <div className="loading-box">
          <div className="spin" />
          <p style={{ fontFamily: "El Messiri", fontSize: 16 }}>{t.loading}</p>
          <span style={{ fontSize: 12 }}>{t.loadingSub}</span>
        </div>
      )}

      {result && result.needs_clarification && (
        <div className="tip-card">
          <p>{result.clarification_question}</p>
          <button className="analyze-cta" onClick={() => setResult(null)}>
            {t.newMeal}
          </button>
        </div>
      )}

      {result && !result.needs_clarification && (
        <>
          <div className="plate-wrap">
            <div className="plate">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e6dcc8" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="52" fill="none" stroke="#e8a33d" strokeWidth="12"
                  strokeDasharray="326.7" strokeDashoffset="163.3" strokeLinecap="round"
                />
              </svg>
              <div className="plate-center">
                <div className="cal">{result.totals.calories}</div>
                <div className="cal-label">{t.calories}</div>
              </div>
            </div>
          </div>

          <div className="macro-row">
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--saffron)" }} />
              <div className="val">{result.totals.protein_g}g</div>
              <div className="lbl">{t.protein}</div>
            </div>
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--sumac)" }} />
              <div className="val">{result.totals.carbs_g}g</div>
              <div className="lbl">{t.carbs}</div>
            </div>
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--zaatar)" }} />
              <div className="val">{result.totals.fat_g}g</div>
              <div className="lbl">{t.fat}</div>
            </div>
          </div>

          {result.dining_mode && <div className="dining-badge">🍽️ {t.diningModeBadge}</div>}

          {result.items?.some((i) => i.hidden_fat_detected) && (
            <div className="hidden-fat-flag">
              ⚠️ {lang === "ar" ? "رصدنا دهون مخفية بالوجبة" : "Hidden fats detected in this meal"}
            </div>
          )}

          {result.input_type === "text" &&
            result.items?.some((i) => i.portion_breakdown && i.portion_breakdown.length > 0) && (
              <div className="tip-card portion-card">
                <h3>📏 {t.portionTitle}</h3>
                <p className="portion-disclaimer">{t.portionDisclaimer}</p>
                {result.items.map((item, idx) =>
                  item.portion_breakdown && item.portion_breakdown.length > 0 ? (
                    <div key={idx} className="portion-item">
                      <strong>{lang === "ar" ? item.food_name : item.food_name_en || item.food_name}</strong>
                      <ul>
                        {item.portion_breakdown.map((p, i) => (
                          <li key={i}>
                            {p.component} — {p.household_measure} (~{p.weight_g}g)
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            )}

          <div className="tip-card">
            <h3>💡 {t.tipTitle}</h3>
            <p>{result.ai_nutritionist_tip}</p>
          </div>

          <div className="tip-card">
            <h3>🔄 {t.swapTitle}</h3>
            <p>{result.healthy_swap_suggestion}</p>
          </div>

          <div className="feedback-row">
            <button onClick={() => sendFeedback(true)}>{t.correct}</button>
            <button onClick={() => sendFeedback(false)}>{t.fix}</button>
          </div>

          {status === "authenticated" && (
            <div className="form-card">
              {savedToDiary ? (
                <p style={{ textAlign: "center", color: "var(--zaatar)", fontWeight: 700, fontSize: 13 }}>
                  ✓ {t.addedToDiary}
                </p>
              ) : (
                <>
                  <div className="form-field">
                    <label>{t.addToDiaryTitle}</label>
                    <select
                      value={selectedSlot}
                      onChange={(e) => setSelectedSlot(e.target.value as MealSlot)}
                    >
                      {ramadanMode ? (
                        <>
                          <option value="suhoor">{t.diary.slots.suhoor}</option>
                          <option value="iftar">{t.diary.slots.iftar}</option>
                        </>
                      ) : (
                        <>
                          <option value="breakfast">{t.slotBreakfast}</option>
                          <option value="lunch">{t.slotLunch}</option>
                          <option value="dinner">{t.slotDinner}</option>
                          <option value="snack">{t.slotSnack}</option>
                        </>
                      )}
                    </select>
                  </div>
                  <button className="analyze-cta" onClick={addToDiary} disabled={savingMeal}>
                    {t.addToDiaryCta}
                  </button>
                </>
              )}
            </div>
          )}

          <button
            className="analyze-cta"
            onClick={() => {
              setResult(null);
              setDescription("");
              setSavedToDiary(false);
              setDiningMode(false);
              clearImage();
            }}
          >
            {t.newMeal}
          </button>
        </>
      )}

      <TabsBar lang={lang} />
    </div>
  );
}
