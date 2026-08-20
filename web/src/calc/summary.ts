import type { ByAge, Expense, Person, PersonOverrides, WithdrawalRate } from "./types";
import { EXPENSE_HORIZON_AGE } from "./types";
import { calculateAge } from "./age";
import { projectBalance, projectHouseholdNetIncomeByAge, projectHouseholdSocialSecurityByAge, projectHouseholdWithdrawalIncomeByAge } from "./projection";
import { projectHouseholdTotalExpensesByAge } from "./expenses";

/** The age the household's retirement period starts at — the earliest
 * retirement age among everyone in the household, since that's the point
 * where earned income first stops and withdrawal/Social Security first
 * start layering in for the household as a whole (even if not everyone
 * has retired yet). For a single-person household this is just their own
 * retirement age — no ambiguity. `overridesByPersonId` lets a simulated
 * household (where a retirement age itself might be overridden) compute
 * its own boundary rather than the saved one. */
export function householdRetirementBoundaryAge(
  people: Person[],
  overridesByPersonId: Record<string, PersonOverrides> = {},
): number {
  return Math.min(...people.map((p) => overridesByPersonId[p.id]?.retirementAge ?? p.retirementAge));
}

/** The mean of `byAge`'s values over [startAge, endAge] inclusive — 0 if
 * the range is empty (startAge > endAge) or byAge has no entries in it.
 * Used to collapse a whole projection into one representative number for
 * a given period (pre-retirement, retirement, or the full horizon)
 * instead of reading a single point-in-time value, which can be
 * unrepresentative since costs and income sources shift a lot over time. */
export function averageOverRange(byAge: ByAge, startAge: number, endAge: number): number {
  let sum = 0;
  let count = 0;
  for (let age = startAge; age <= endAge; age++) {
    const value = byAge.get(age);
    if (value !== undefined) {
      sum += value;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/** The first age, searching from `startAge` through `endAge`, at which
 * combined income (earned + 401(k) withdrawal + Social Security) falls
 * short of expenses — null if it never does in that range. Same "first
 * deficit" concept the Summary tab surfaces (relative to today), just
 * reusable from any starting age. */
export function firstDeficitAgeFrom(
  incomeByAge: ByAge,
  withdrawalByAge: ByAge,
  ssByAge: ByAge,
  expensesByAge: ByAge,
  startAge: number,
  endAge: number,
): number | null {
  for (let age = startAge; age <= endAge; age++) {
    const net = (incomeByAge.get(age) ?? 0) + (withdrawalByAge.get(age) ?? 0) + (ssByAge.get(age) ?? 0) - (expensesByAge.get(age) ?? 0);
    if (net < 0) return age;
  }
  return null;
}

export interface SimulatorComparisonMetrics {
  /** Combined 401(k) balance across the household at each person's own
   * (possibly overridden) retirement age. */
  combinedBalanceAtRetirement: number;
  /** Years from the household's retirement boundary age until expenses
   * first outpace income — capped at the distance to EXPENSE_HORIZON_AGE
   * when that never happens (see `lastsFullHorizon`). */
  yearsOfDraw: number;
  /** True if income covers expenses all the way through EXPENSE_HORIZON_AGE
   * for this scenario — `yearsOfDraw` is a lower-bound cap in that case,
   * not an actual depletion point. */
  lastsFullHorizon: boolean;
}

/** The two headline numbers behind the Simulator's Actual-vs-Simulated
 * comparison boxes — reused as-is for both the actual (saved) household
 * and the freely-edited simulated one, just with different overrides
 * (or none, for actual) passed in. */
export function computeSimulatorComparisonMetrics(
  people: Person[],
  expenses: Expense[],
  currentAge: number,
  withdrawalRate: WithdrawalRate,
  overridesByPersonId: Record<string, PersonOverrides> = {},
  today: Date = new Date(),
): SimulatorComparisonMetrics {
  const combinedBalanceAtRetirement = people.reduce((sum, p) => {
    const rows = projectBalance(p, overridesByPersonId[p.id] ?? {}, today);
    return sum + rows[rows.length - 1].balance;
  }, 0);

  const boundaryAge = householdRetirementBoundaryAge(people, overridesByPersonId);
  const incomeByAge = projectHouseholdNetIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId, today);
  const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE, withdrawalRate, overridesByPersonId, today);
  const ssByAge = projectHouseholdSocialSecurityByAge(people, currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId, today);
  const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, EXPENSE_HORIZON_AGE);

  const deficitAge = firstDeficitAgeFrom(incomeByAge, withdrawalByAge, ssByAge, expensesByAge, boundaryAge, EXPENSE_HORIZON_AGE);
  const lastsFullHorizon = deficitAge === null;
  const yearsOfDraw = lastsFullHorizon ? EXPENSE_HORIZON_AGE - boundaryAge : deficitAge - boundaryAge;

  return { combinedBalanceAtRetirement, yearsOfDraw, lastsFullHorizon };
}

export interface HouseholdRetirementResult {
  /** Fewest years from today (0..EXPENSE_HORIZON_AGE - currentAge) at which
   * *everyone* in the household could retire simultaneously — same target
   * year, not necessarily the same age — while household income still
   * covers expenses every year from today through EXPENSE_HORIZON_AGE.
   * Null if not achievable anywhere in that range under the given
   * (possibly scenario-overridden) assumptions. */
  earliestYearsOut: number | null;
  /** Each person's resulting age at that shared target year — empty when
   * earliestYearsOut is null. */
  resultingAgeByPersonId: Record<string, number>;
  /** Years from today until the household's *planned* settings have
   * everyone retired — the latest of each person's own planned retirement
   * age (their scenario override's, or their saved one) minus their
   * current age. The baseline earliestYearsOut is compared against. */
  plannedYearsOut: number;
  /** plannedYearsOut - earliestYearsOut — positive means the household
   * could retire together that many years sooner than planned; negative
   * means the current plan isn't sustainable and would need that many more
   * years. Null when earliestYearsOut is null. */
  yearsEarlier: number | null;
}

/** "When can we retire?" at the household level: rather than optimizing
 * one person at a time while holding everyone else's saved age fixed
 * (which doesn't answer "when can we stop working together"), this
 * searches for the earliest shared target year at which retiring
 * *everyone* simultaneously — each person's own age offset by the same
 * number of years from today — still keeps household income covering
 * expenses every year from today through EXPENSE_HORIZON_AGE. Each
 * person's other settings come from `scenarioOverridesByPersonId` (their
 * chosen saved 401(k) scenario, or {} for Base) — only `retirementAge`
 * gets overridden further by the search itself.
 *
 * Scans the full [currentAge, EXPENSE_HORIZON_AGE] range directly (not
 * just from a "boundary age" onward) specifically so it doesn't need
 * `householdRetirementBoundaryAge`'s per-person age numbers to line up
 * with the shared household reference-age scale the by-age maps use —
 * sidestepping that ambiguity entirely rather than relying on it holding
 * for households of very differently-aged people. */
export function findEarliestHouseholdRetirement(
  people: Person[],
  expenses: Expense[],
  currentAge: number,
  withdrawalRate: WithdrawalRate,
  scenarioOverridesByPersonId: Record<string, PersonOverrides> = {},
  today: Date = new Date(),
): HouseholdRetirementResult {
  if (people.length === 0) return { earliestYearsOut: null, resultingAgeByPersonId: {}, plannedYearsOut: 0, yearsEarlier: null };

  const personAgeById = new Map(people.map((p) => [p.id, calculateAge(p.birthday, today)]));
  const plannedYearsOut = Math.max(
    0,
    ...people.map((p) => {
      const overrides = scenarioOverridesByPersonId[p.id] ?? {};
      const plannedAge = overrides.retirementAge ?? p.retirementAge;
      return plannedAge - personAgeById.get(p.id)!;
    }),
  );

  const maxYearsOut = Math.max(0, EXPENSE_HORIZON_AGE - currentAge);

  for (let yearsOut = 0; yearsOut <= maxYearsOut; yearsOut++) {
    const overridesByPersonId: Record<string, PersonOverrides> = {};
    for (const p of people) {
      overridesByPersonId[p.id] = { ...(scenarioOverridesByPersonId[p.id] ?? {}), retirementAge: personAgeById.get(p.id)! + yearsOut };
    }
    const incomeByAge = projectHouseholdNetIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId, today);
    const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE, withdrawalRate, overridesByPersonId, today);
    const ssByAge = projectHouseholdSocialSecurityByAge(people, currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId, today);
    const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, EXPENSE_HORIZON_AGE);

    if (firstDeficitAgeFrom(incomeByAge, withdrawalByAge, ssByAge, expensesByAge, currentAge, EXPENSE_HORIZON_AGE) === null) {
      const resultingAgeByPersonId: Record<string, number> = {};
      for (const p of people) resultingAgeByPersonId[p.id] = personAgeById.get(p.id)! + yearsOut;
      return { earliestYearsOut: yearsOut, resultingAgeByPersonId, plannedYearsOut, yearsEarlier: plannedYearsOut - yearsOut };
    }
  }
  return { earliestYearsOut: null, resultingAgeByPersonId: {}, plannedYearsOut, yearsEarlier: null };
}
