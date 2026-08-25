export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type PregnancyStatus = "none" | "pregnant" | "breastfeeding";

// Extra daily calories per general prenatal/postpartum nutrition guidance
// (flat estimate, not trimester-specific - this app isn't a clinical tool).
const PREGNANCY_CALORIE_BONUS: Record<Exclude<PregnancyStatus, "none">, number> = {
  pregnant: 340,
  breastfeeding: 500,
};

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const WATER_ACTIVITY_BONUS_ML: Record<ActivityLevel, number> = {
  sedentary: 0,
  light: 250,
  moderate: 500,
  active: 750,
  very_active: 1000,
};

// Mifflin-St Jeor equation
export function calculateBMR(params: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const { sex, weightKg, heightCm, ageYears } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export type BMICategory = "underweight" | "normal" | "overweight" | "obese";

export function classifyBMI(bmi: number): BMICategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

// Safe deficit/surplus of 300-500 kcal/day off TDEE per the project's
// nutrition guardrails (never more, unless a clinician says otherwise).
const CALORIE_ADJUSTMENT = 400;

export function calculateDailyCalorieTarget(
  tdee: number,
  goal: Goal,
  pregnancyStatus: PregnancyStatus = "none"
): number {
  // Pregnancy/breastfeeding: never diet down, regardless of the selected
  // goal - a calorie deficit isn't safe here without clinical supervision.
  if (pregnancyStatus !== "none") {
    return Math.round(tdee + PREGNANCY_CALORIE_BONUS[pregnancyStatus]);
  }
  if (goal === "lose") return Math.round(tdee - CALORIE_ADJUSTMENT);
  if (goal === "gain") return Math.round(tdee + CALORIE_ADJUSTMENT);
  return Math.round(tdee);
}

// ~33ml per kg of body weight as a baseline, plus an activity bonus.
export function calculateDailyWaterTargetMl(
  weightKg: number,
  activityLevel: ActivityLevel
): number {
  const base = weightKg * 33;
  return Math.round((base + WATER_ACTIVITY_BONUS_ML[activityLevel]) / 50) * 50;
}

// "Flexibility instead of restriction": if the meals logged so far already
// ate up most of the daily target, nudge the next meal to go lighter on
// carbs/fat instead of letting the user feel like they've already failed
// the day. Pure arithmetic heuristic - no LLM call needed for this nudge.
export type AdaptiveTipLevel = "none" | "watch" | "good" | "over";

export function getAdaptiveDiaryTip(consumedSoFar: number, dailyTarget: number): AdaptiveTipLevel {
  if (dailyTarget <= 0) return "none";
  const ratio = consumedSoFar / dailyTarget;
  if (ratio >= 1.05) return "over";
  if (ratio >= 0.95) return "good";
  if (ratio >= 0.75) return "watch";
  return "none";
}
