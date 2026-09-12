"use client";

import { useState } from "react";
import { dict, Lang } from "@/lib/i18n";
import { ActivityLevel, Goal, PregnancyStatus, Sex } from "@/lib/nutrition";

type OnboardingProfile = {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  pregnancyStatus: PregnancyStatus;
  bmr?: number;
  tdee?: number;
  dailyCalorieTarget?: number;
  dailyWaterTargetMl?: number;
  ramadanMode?: boolean;
};

const GOAL_IMAGE = "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=900&q=75&auto=format&fit=crop";
const SEX_IMAGE = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900&q=75&auto=format&fit=crop";

const GOAL_OPTIONS: { value: Goal; emoji: string }[] = [
  { value: "lose", emoji: "🔥" },
  { value: "maintain", emoji: "⚖️" },
  { value: "gain", emoji: "💪" },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; emoji: string }[] = [
  { value: "sedentary", emoji: "🛋️" },
  { value: "light", emoji: "🚶" },
  { value: "moderate", emoji: "🏃" },
  { value: "active", emoji: "🏋️" },
  { value: "very_active", emoji: "🔥" },
];

const PREGNANCY_OPTIONS: { value: PregnancyStatus; emoji: string }[] = [
  { value: "none", emoji: "🙂" },
  { value: "pregnant", emoji: "🤰" },
  { value: "breastfeeding", emoji: "🤱" },
];

type Step = "goal" | "sex" | "activity" | "details" | "pregnancy" | "summary";

export default function OnboardingWizard({
  lang,
  onComplete,
}: {
  lang: Lang;
  onComplete: (profile: OnboardingProfile, bmi: number, bmiCategory: string) => void;
}) {
  const t = dict[lang];
  const to = t.onboarding;
  const tp = t.profile;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [ageYears, setAgeYears] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pregnancyStatus, setPregnancyStatus] = useState<PregnancyStatus>("none");
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ profile: OnboardingProfile; bmi: number; bmiCategory: string } | null>(null);

  const steps: Step[] =
    sex === "female"
      ? ["goal", "sex", "activity", "details", "pregnancy", "summary"]
      : ["goal", "sex", "activity", "details", "summary"];
  const step = steps[stepIndex];

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function submit() {
    setError("");
    setSubmitting(true);
    const body = {
      sex,
      ageYears: Number(ageYears),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      activityLevel,
      goal,
      pregnancyStatus,
      ramadanMode: false,
    };
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setError(t.auth.genericError);
        setStepIndex(steps.indexOf("details"));
      } else {
        setResult({ profile: data.profile, bmi: data.bmi, bmiCategory: data.bmiCategory });
      }
    } catch {
      setError(t.auth.genericError);
      setStepIndex(steps.indexOf("details"));
    } finally {
      setSubmitting(false);
    }
  }

  function selectGoal(value: Goal) {
    setGoal(value);
    setTimeout(goNext, 150);
  }
  function selectSex(value: Sex) {
    setSex(value);
    setTimeout(goNext, 150);
  }
  function selectActivity(value: ActivityLevel) {
    setActivityLevel(value);
    setTimeout(goNext, 150);
  }
  function selectPregnancy(value: PregnancyStatus) {
    setPregnancyStatus(value);
    setTimeout(goNext, 150);
  }

  function handleDetailsNext() {
    if (!ageYears || !heightCm || !weightKg) return;
    if (sex === "female") {
      goNext();
    } else {
      goNext();
      submit();
    }
  }

  function handlePregnancySubmit(value: PregnancyStatus) {
    setPregnancyStatus(value);
    setStepIndex(steps.indexOf("summary"));
    setSubmitting(true);
    setError("");
    const body = {
      sex,
      ageYears: Number(ageYears),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      activityLevel,
      goal,
      pregnancyStatus: value,
      ramadanMode: false,
    };
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(t.auth.genericError);
          setStepIndex(steps.indexOf("details"));
        } else {
          setResult({ profile: data.profile, bmi: data.bmi, bmiCategory: data.bmiCategory });
        }
      })
      .catch(() => {
        setError(t.auth.genericError);
        setStepIndex(steps.indexOf("details"));
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div dir={t.dir} className="onboard-shell">
      <div className="onboard-progress">
        {steps.map((s, i) => (
          <div key={s} className={`onboard-progress-bar ${i <= stepIndex ? "filled" : ""}`} />
        ))}
      </div>

      {step !== "details" && step !== "summary" && stepIndex > 0 && (
        <button
          className={`onboard-back ${step === "activity" || step === "pregnancy" ? "onboard-back-dark" : ""}`}
          onClick={goBack}
          aria-label={to.back}
        >
          {t.dir === "rtl" ? "→" : "←"}
        </button>
      )}

      {step === "goal" && (
        <div className="onboard-photo-step" style={{ backgroundImage: `url(${GOAL_IMAGE})` }}>
          <div className="onboard-photo-overlay" />
          <div className="onboard-photo-content">
            <h1 className="onboard-title">{to.goalTitle}</h1>
            <p className="onboard-subtitle">{to.goalSubtitle}</p>
            <div className="onboard-options">
              {GOAL_OPTIONS.map((opt) => (
                <button key={opt.value} className="onboard-option-card" onClick={() => selectGoal(opt.value)}>
                  <span className="onboard-option-emoji">{opt.emoji}</span>
                  {tp[`goal_${opt.value}` as keyof typeof tp]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "sex" && (
        <div className="onboard-photo-step" style={{ backgroundImage: `url(${SEX_IMAGE})` }}>
          <div className="onboard-photo-overlay" />
          <div className="onboard-photo-content">
            <h1 className="onboard-title">{to.sexTitle}</h1>
            <p className="onboard-subtitle">{to.sexSubtitle}</p>
            <div className="onboard-options onboard-options-row">
              <button className="onboard-option-card" onClick={() => selectSex("male")}>
                <span className="onboard-option-emoji">👨</span>
                {tp.male}
              </button>
              <button className="onboard-option-card" onClick={() => selectSex("female")}>
                <span className="onboard-option-emoji">👩</span>
                {tp.female}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "activity" && (
        <div className="onboard-gradient-step">
          <div className="onboard-photo-content">
            <h1 className="onboard-title onboard-title-dark">{to.activityTitle}</h1>
            <p className="onboard-subtitle onboard-subtitle-dark">{to.activitySubtitle}</p>
            <div className="onboard-options">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className="onboard-option-card onboard-option-card-light"
                  onClick={() => selectActivity(opt.value)}
                >
                  <span className="onboard-option-emoji">{opt.emoji}</span>
                  {tp[`activity_${opt.value}` as keyof typeof tp]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="onboard-gradient-step">
          <div className="onboard-photo-content">
            <h1 className="onboard-title onboard-title-dark">{to.detailsTitle}</h1>
            <p className="onboard-subtitle onboard-subtitle-dark">{to.detailsSubtitle}</p>
            <div className="onboard-details-form">
              <div className="form-field">
                <label>{tp.age}</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>{tp.height}</label>
                <input
                  type="number"
                  min={50}
                  max={260}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>{tp.weight}</label>
                <input
                  type="number"
                  min={20}
                  max={400}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="error-text" style={{ marginBottom: 10 }}>{error}</p>}
            <button
              className="analyze-cta"
              onClick={handleDetailsNext}
              disabled={!ageYears || !heightCm || !weightKg}
            >
              {to.next}
            </button>
          </div>
        </div>
      )}

      {step === "pregnancy" && (
        <div className="onboard-gradient-step">
          <div className="onboard-photo-content">
            <h1 className="onboard-title onboard-title-dark">{to.pregnancyTitle}</h1>
            <p className="onboard-subtitle onboard-subtitle-dark">{to.pregnancySubtitle}</p>
            <div className="onboard-options">
              {PREGNANCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className="onboard-option-card onboard-option-card-light"
                  onClick={() => handlePregnancySubmit(opt.value)}
                >
                  <span className="onboard-option-emoji">{opt.emoji}</span>
                  {tp[`pregnancy_${opt.value}` as keyof typeof tp]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "summary" && (
        <div className="onboard-gradient-step onboard-summary-step">
          <div className="onboard-photo-content">
            {submitting || !result ? (
              <>
                <div className="spin" style={{ margin: "40px auto 16px" }} />
                <p className="onboard-subtitle onboard-subtitle-dark" style={{ textAlign: "center" }}>
                  {to.buildingPlan}
                </p>
                {error && <p className="error-text" style={{ textAlign: "center", marginTop: 12 }}>{error}</p>}
              </>
            ) : (
              <>
                <h1 className="onboard-title onboard-title-dark" style={{ textAlign: "center" }}>
                  {to.summaryTitle}
                </h1>
                <p className="onboard-subtitle onboard-subtitle-dark" style={{ textAlign: "center" }}>
                  {to.summarySubtitle}
                </p>
                <div className="onboard-summary-circle">
                  <span className="onboard-summary-number">{result.profile.dailyCalorieTarget}</span>
                </div>
                <p className="onboard-summary-unit">{t.calories}</p>
                <button
                  className="analyze-cta"
                  onClick={() => onComplete(result.profile, result.bmi, result.bmiCategory)}
                >
                  {to.startNow}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
