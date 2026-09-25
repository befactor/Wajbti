"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { dict, useLang } from "@/lib/i18n";
import { localDateStr } from "@/lib/date";
import TabsBar from "@/app/components/TabsBar";
import { prepareImageFile, takePendingImage } from "@/lib/image";

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
  clarification_options?: string[];
};

type ClarificationTurn = { question: string; answer: string };

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

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack", "suhoor", "iftar"];

export default function LogPage() {
  return (
    <Suspense fallback={null}>
      <LogPageInner />
    </Suspense>
  );
}

function LogPageInner() {
  const [lang] = useLang();
  const t = dict[lang];
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slotParam = searchParams.get("slot") as MealSlot | null;
  const requestedSlot = slotParam && MEAL_SLOTS.includes(slotParam) ? slotParam : null;
  const mode = searchParams.get("mode");
  const textInputRef = useRef<HTMLInputElement>(null);
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
  const [clarificationHistory, setClarificationHistory] = useState<ClarificationTurn[]>([]);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [wantsToAddToDiary, setWantsToAddToDiary] = useState<boolean | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [savedToFavorites, setSavedToFavorites] = useState(false);
  const [diaryError, setDiaryError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const isRamadan = !!data.profile?.ramadanMode;
        setRamadanMode(isRamadan);
        setSelectedSlot(requestedSlot ?? (isRamadan ? "suhoor" : "breakfast"));
      })
      .catch(() => {});
  }, [status, requestedSlot]);

  // A photo picked straight from the quick-add sheet's camera button.
  useEffect(() => {
    const pending = takePendingImage();
    if (pending) applyImage(pending.dataUrl, pending.base64, pending.mediaType);
    if (mode === "text") textInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const autoStartedVoice = useRef(false);
  useEffect(() => {
    if (mode !== "voice" || !speechSupported || autoStartedVoice.current) return;
    autoStartedVoice.current = true;
    toggleListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, speechSupported]);

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

  function applyImage(dataUrl: string, base64: string, mediaType: string) {
    setImagePreview(dataUrl);
    setImageBase64(base64 || null);
    setImageMediaType(mediaType);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    prepareImageFile(file)
      .then((img) => applyImage(img.dataUrl, img.base64, img.mediaType))
      .catch(() => setError(t.analyzeError));
  }

  function clearImage() {
    setImagePreview(null);
    setImageBase64(null);
  }

  async function runAnalysis(history: ClarificationTurn[]) {
    if (!description.trim() && !imageBase64) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSavedToDiary(false);
    setWantsToAddToDiary(requestedSlot ? true : null);
    setFeedbackGiven(false);
    setSavedToFavorites(false);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim() || undefined,
          imageBase64: imageBase64 || undefined,
          mediaType: imageBase64 ? imageMediaType : undefined,
          diningMode,
          clarificationHistory: history.length > 0 ? history : undefined,
          lang,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(
          data.error === "missingInputError"
            ? t.missingInputError
            : data.error === "analyzeError"
            ? t.analyzeError
            : data.error === "unauthorizedError"
            ? t.unauthorizedError
            : t.auth.genericError
        );
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(lang === "ar" ? "حدث خطأ، حاول مرة أخرى" : "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  }

  // Fresh analysis: starts a new clarification thread.
  async function analyze() {
    setClarificationHistory([]);
    await runAnalysis([]);
  }

  // Continue an in-progress clarification: answer the AI's question and
  // re-analyze with the accumulated Q&A as extra context. May come back
  // with another question, or a full result once it has enough to go on.
  async function submitClarification(optionAnswer?: string) {
    const answer = (optionAnswer ?? clarificationAnswer).trim();
    if (!result?.clarification_question || !answer) return;
    const nextHistory = [
      ...clarificationHistory,
      { question: result.clarification_question, answer },
    ];
    setClarificationHistory(nextHistory);
    setClarificationAnswer("");
    await runAnalysis(nextHistory);
  }

  async function sendFeedback(correct: boolean) {
    if (!result) return;
    if (correct) {
      setFeedbackGiven(true);
      return;
    }
    // المستخدم يصحح اسم الأكلة بس - الأرقام (سعرات/وزن) مسؤولية النظام حصراً
    const correctedFoodName = window.prompt(
      lang === "ar" ? "ما هو الاسم الصحيح للطعام؟" : "What's the correct food name?"
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
    setFeedbackGiven(true);
  }

  async function addToDiary() {
    if (!result) return;
    setSavingMeal(true);
    setDiaryError("");
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: localDateStr(),
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
      if (data.error) {
        setDiaryError(t.diaryAddError);
      } else {
        setSavedToDiary(true);
      }
    } catch {
      setDiaryError(t.diaryAddError);
    } finally {
      setSavingMeal(false);
    }
  }

  async function addToFavorites() {
    if (!result) return;
    setSavingFavorite(true);
    setFavoriteError("");
    try {
      const foodName =
        result.items?.map((i) => (lang === "ar" ? i.food_name : i.food_name_en || i.food_name)).join(lang === "ar" ? "، " : ", ") ||
        description;
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodName, items: result.items, totals: result.totals }),
      });
      const data = await res.json();
      if (data.error) {
        setFavoriteError(t.favoriteAddError);
      } else {
        setSavedToFavorites(true);
      }
    } catch {
      setFavoriteError(t.favoriteAddError);
    } finally {
      setSavingFavorite(false);
    }
  }

  if (status !== "authenticated") {
    return <div style={{ minHeight: "100vh", background: "var(--semolina)" }} />;
  }

  return (
    <div dir={t.dir} className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back" aria-label="back">
          {t.dir === "rtl" ? "→" : "←"}
        </Link>
        <h1>{requestedSlot ? `${t.log.title} · ${t.diary.slots[requestedSlot]}` : t.log.title}</h1>
        <span />
      </div>

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
            <>
              <label className="capture-photo-card" htmlFor="meal-photo-input">
                <div className="capture-photo-overlay" />
                <div className="capture-photo-content">
                  <span className="capture-btn">📷</span>
                  <h2>{t.captureTitle}</h2>
                  <p>{t.captureHint}</p>
                </div>
              </label>
              <input
                id="meal-photo-input"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
              <p className="capture-or">{t.captureDesc}</p>
            </>
          )}

          <div className="desc-input">
            <input
              type="text"
              placeholder={t.placeholder}
              value={description}
              ref={textInputRef}
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
          <p style={{ fontFamily: "El Messiri, Cairo, sans-serif", fontSize: 16 }}>{t.loading}</p>
          <span style={{ fontSize: 12 }}>{t.loadingSub}</span>
        </div>
      )}

      {result && result.needs_clarification && (
        <div className="tip-card">
          {clarificationHistory.length > 0 && (
            <div className="clarification-history">
              {clarificationHistory.map((turn, i) => (
                <p key={i} className="clarification-turn">
                  <strong>{turn.question}</strong>
                  <br />
                  {turn.answer}
                </p>
              ))}
            </div>
          )}
          <p className="clarification-question">❓ {result.clarification_question}</p>
          {result.clarification_options && result.clarification_options.length > 0 && (
            <div className="feedback-row" style={{ flexWrap: "wrap" }}>
              {result.clarification_options.map((opt, i) => (
                <button
                  key={i}
                  style={{ flex: "1 1 auto", minWidth: 90 }}
                  onClick={() => submitClarification(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          <div className="desc-input">
            <input
              type="text"
              placeholder={t.clarificationPlaceholder}
              value={clarificationAnswer}
              onChange={(e) => setClarificationAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitClarification()}
            />
          </div>
          {error && <p style={{ color: "var(--sumac)", fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button className="analyze-cta" onClick={() => submitClarification()} disabled={!clarificationAnswer.trim()}>
            {t.clarificationSubmit}
          </button>
          <button
            className="analyze-cta"
            style={{ background: "var(--card)", color: "var(--tanoor)", border: "1px solid var(--line)" }}
            onClick={() => {
              setResult(null);
              setClarificationHistory([]);
              setClarificationAnswer("");
            }}
          >
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
              <div className="dot" style={{ background: "var(--macro-protein)" }} />
              <div className="val">{result.totals.protein_g}g</div>
              <div className="lbl">{t.protein}</div>
            </div>
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--macro-carbs)" }} />
              <div className="val">{result.totals.carbs_g}g</div>
              <div className="lbl">{t.carbs}</div>
            </div>
            <div className="macro-chip">
              <div className="dot" style={{ background: "var(--macro-fat)" }} />
              <div className="val">{result.totals.fat_g}g</div>
              <div className="lbl">{t.fat}</div>
            </div>
          </div>

          {result.dining_mode && <div className="dining-badge">🍽️ {t.diningModeBadge}</div>}

          {result.items?.some((i) => i.hidden_fat_detected) && (
            <div className="hidden-fat-flag">
              ⚠️ {lang === "ar" ? "رصدنا دهوناً خفية في الوجبة" : "Hidden fats detected in this meal"}
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

          {feedbackGiven ? (
            <p style={{ textAlign: "center", color: "var(--zaatar)", fontWeight: 700, fontSize: 13 }}>
              ✓ {t.thanksFeedback}
            </p>
          ) : (
            <div className="feedback-row">
              <button onClick={() => sendFeedback(true)}>{t.correct}</button>
              <button onClick={() => sendFeedback(false)}>{t.fix}</button>
            </div>
          )}

          {status === "authenticated" && (
            <div className="form-card">
              {savedToDiary ? (
                <>
                  <p style={{ textAlign: "center", color: "var(--zaatar)", fontWeight: 700, fontSize: 13 }}>
                    ✓ {t.addedToDiary}
                  </p>
                  <Link href="/" className="analyze-cta" style={{ display: "block" }}>
                    {t.log.backToToday}
                  </Link>
                </>
              ) : wantsToAddToDiary === false ? (
                <p style={{ textAlign: "center", color: "var(--taupe)", fontSize: 13 }}>{t.skippedDiary}</p>
              ) : wantsToAddToDiary === true ? (
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
                  {diaryError && (
                    <p style={{ color: "var(--sumac)", fontSize: 12.5, marginTop: 10, textAlign: "center" }}>
                      {diaryError}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p style={{ textAlign: "center", fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
                    {t.addToDiaryQuestion}
                  </p>
                  <div className="feedback-row">
                    <button onClick={() => setWantsToAddToDiary(true)}>{t.yesAdd}</button>
                    <button onClick={() => setWantsToAddToDiary(false)}>{t.noJustChecking}</button>
                  </div>
                </>
              )}
            </div>
          )}

          {status === "authenticated" &&
            (savedToFavorites ? (
              <p style={{ textAlign: "center", color: "var(--zaatar)", fontWeight: 700, fontSize: 13 }}>
                {t.addedToFavorites}
              </p>
            ) : (
              <>
                <button
                  className="analyze-cta"
                  style={{ background: "var(--card)", color: "var(--tanoor)", border: "1px solid var(--line)" }}
                  onClick={addToFavorites}
                  disabled={savingFavorite}
                >
                  {t.addToFavorites}
                </button>
                {favoriteError && (
                  <p style={{ color: "var(--sumac)", fontSize: 12.5, marginTop: 10, textAlign: "center" }}>
                    {favoriteError}
                  </p>
                )}
              </>
            ))}

          <button
            className="analyze-cta"
            onClick={() => {
              setResult(null);
              setDescription("");
              setSavedToDiary(false);
              setDiningMode(false);
              setClarificationHistory([]);
              setClarificationAnswer("");
              setWantsToAddToDiary(null);
              setSavedToFavorites(false);
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
