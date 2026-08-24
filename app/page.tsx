"use client";

import { useState } from "react";
import { dict, Lang } from "@/lib/i18n";

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
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  items: AnalysisItem[];
  ai_nutritionist_tip: string;
  healthy_swap_suggestion: string;
  medical_disclaimer_flag?: boolean;
  needs_clarification?: boolean;
  clarification_question?: string;
};

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");

  async function analyze() {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
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

  return (
    <div dir={t.dir} className="container">
      <button className="lang-toggle" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div className="brand">
        <div className="brand-mark" />
        <h1 className="title">{t.appName}</h1>
      </div>
      <p className="tagline">{t.tagline}</p>

      {!result && !loading && (
        <>
          <div className="capture-card">
            <button className="capture-btn" onClick={analyze} aria-label={t.captureTitle}>
              🍽️
            </button>
            <h2>{t.captureTitle}</h2>
            <p>{t.captureDesc}</p>
          </div>

          <div className="desc-input">
            <input
              type="text"
              placeholder={t.placeholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
            />
          </div>

          {error && <p style={{ color: "var(--sumac)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

          <button className="analyze-cta" onClick={analyze}>
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

          <button className="analyze-cta" onClick={() => { setResult(null); setDescription(""); }}>
            {t.newMeal}
          </button>
        </>
      )}
    </div>
  );
}
