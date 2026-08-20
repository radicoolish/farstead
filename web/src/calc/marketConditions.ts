export type MarketConditionKey = "normal" | "bear" | "bull" | "dotcom" | "financialCrisis" | "covid";

/** Either a flat, sustained adjustment to the person's own growth-rate
 * assumption (bear/bull), or a fixed sequence of annual returns that
 * replaces it year by year starting from today — reverting to the
 * person's own assumption once the sequence runs out. Historical event
 * sequences are illustrative approximations of the shape of each event
 * (a sharp drawdown followed by recovery), not a precise backtest against
 * exact calendar-year index returns — this is a planning tool, not a
 * historical replay. */
export interface MarketCondition {
  label: string;
  detail: string;
  flatAdjustmentPct?: number;
  yearSequencePct?: number[];
}

export const MARKET_CONDITIONS: Record<MarketConditionKey, MarketCondition> = {
  normal: {
    label: "Normal (your assumption)",
    detail: "Uses the growth rate set above for every year.",
  },
  bear: {
    label: "Bear Market (sustained)",
    detail: "A prolonged downturn — your growth rate assumption runs about 6 points lower every year.",
    flatAdjustmentPct: -6,
  },
  bull: {
    label: "Bull Market (sustained)",
    detail: "An extended upswing — your growth rate assumption runs about 4 points higher every year.",
    flatAdjustmentPct: 4,
  },
  dotcom: {
    label: "Dot-Com Bust (2000–2003)",
    detail: "Three down years in a row, then a strong rebound — approximates the shape of the early-2000s crash, applied starting now.",
    yearSequencePct: [-9, -12, -22, 29],
  },
  financialCrisis: {
    label: "Financial Crisis (2008–2009)",
    detail: "One severe drop followed by a sharp recovery — approximates the 2008–2009 crash, applied starting now.",
    yearSequencePct: [-37, 26],
  },
  covid: {
    label: "COVID Crash (2020)",
    detail: "A steep, fast drop followed by an unusually quick rebound — approximates the 2020 crash-and-recovery, applied starting now.",
    yearSequencePct: [-20, 25, 12],
  },
};

/** Default length a sustained bear/bull condition lasts if the user
 * doesn't set one explicitly. Historical events ignore this entirely —
 * their duration is fixed by the shape of the event itself. */
export const DEFAULT_MARKET_CONDITION_DURATION_YEARS = 5;

/** The growth rate (as a decimal, e.g. 0.07) to use for the year of
 * growth that carries a person from age `personAge - 1` to `personAge`.
 * At or before `startAge`, always `baseRate` (unaffected) — so
 * `startAge` defaulting to the person's current age means the event's
 * first affected year of growth is the very next one, same as the
 * original always-on behavior. From there: a historical event steps
 * through its own fixed sequence, then reverts to `baseRate` once the
 * sequence ends regardless of `durationYears`; a sustained bear/bull
 * condition applies its flat adjustment for `durationYears` years, then
 * also reverts to `baseRate`. */
export function effectiveGrowthRateForYear(
  baseRate: number,
  condition: MarketCondition | undefined,
  personAge: number,
  startAge: number,
  durationYears: number,
): number {
  if (!condition || personAge <= startAge) return baseRate;
  const yearIntoEvent = personAge - startAge; // personAge === startAge + 1 is year 1
  if (condition.yearSequencePct) {
    const rate = condition.yearSequencePct[yearIntoEvent - 1];
    return rate === undefined ? baseRate : rate / 100;
  }
  if (condition.flatAdjustmentPct !== undefined) {
    if (yearIntoEvent > durationYears) return baseRate;
    return baseRate + condition.flatAdjustmentPct / 100;
  }
  return baseRate;
}
