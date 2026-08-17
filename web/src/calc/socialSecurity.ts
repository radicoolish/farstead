// Approximate, for planning purposes only — not an official SSA estimate.
// Real Social Security uses a 35-year wage-indexed earnings history; this
// tool only has a single current salary, so that salary stands in as an
// average-career-earnings proxy. Bend points and the taxable maximum are
// 2024 figures. Ported from app.py.

const SS_BEND_POINTS_2024 = [1174, 7078] as const; // monthly AIME bend points
const SS_TAXABLE_MAX_2024 = 168_600; // annual wage base

/** Approximate Average Indexed Monthly Earnings, capped at the Social
 * Security taxable maximum. */
export function estimateAime(currentSalary: number): number {
  return Math.min(currentSalary, SS_TAXABLE_MAX_2024) / 12;
}

/** Monthly benefit at full retirement age, via the 2024 PIA bend-point
 * formula: 90% of AIME up to the first bend point, 32% up to the second,
 * 15% beyond it. */
export function calculatePrimaryInsuranceAmount(aime: number): number {
  const [b1, b2] = SS_BEND_POINTS_2024;
  if (aime <= b1) return aime * 0.9;
  if (aime <= b2) return b1 * 0.9 + (aime - b1) * 0.32;
  return b1 * 0.9 + (b2 - b1) * 0.32 + (aime - b2) * 0.15;
}

/** SSA full retirement age, in total months, by birth year. */
export function fullRetirementAgeMonths(birthYear: number): number {
  if (birthYear <= 1937) return 65 * 12;
  if (birthYear >= 1960) return 67 * 12;
  if (birthYear >= 1943 && birthYear <= 1954) return 66 * 12;
  if (birthYear <= 1942) return 65 * 12 + (birthYear - 1937) * 2;
  return 66 * 12 + (birthYear - 1954) * 2;
}

/** Multiplier on the Primary Insurance Amount for claiming earlier (as
 * early as 62) or later (delayed retirement credits stop accruing at 70)
 * than full retirement age. */
export function claimAgeAdjustmentFactor(claimAgeMonths: number, fraMonths: number): number {
  const diff = claimAgeMonths - fraMonths;
  if (diff === 0) return 1.0;
  if (diff < 0) {
    const earlyMonths = Math.min(-diff, fraMonths - 62 * 12);
    const first36 = Math.min(earlyMonths, 36);
    const remaining = Math.max(earlyMonths - 36, 0);
    const reduction = first36 * (5 / 9 / 100) + remaining * (5 / 12 / 100);
    return 1 - reduction;
  }
  const delayedMonths = Math.min(diff, 70 * 12 - fraMonths);
  return 1 + delayedMonths * (2 / 3 / 100);
}

/** Approximate monthly Social Security benefit at a given claim age, for
 * planning only — not an official SSA estimate. */
export function estimateMonthlySocialSecurity(
  currentSalary: number,
  birthday: string,
  claimAge: number,
): number {
  const pia = calculatePrimaryInsuranceAmount(estimateAime(currentSalary));
  const birthYear = Number(birthday.split("-")[0]);
  const fraMonths = fullRetirementAgeMonths(birthYear);
  const factor = claimAgeAdjustmentFactor(claimAge * 12, fraMonths);
  return pia * factor;
}
