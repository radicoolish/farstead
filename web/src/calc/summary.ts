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

/** Oldest age a retirement search bothers trying. Capped at
 * EXPENSE_HORIZON_AGE itself, not the 100 the Retirement Age sliders allow
 * elsewhere: past the horizon age, `computeSimulatorComparisonMetrics`'s
 * deficit-search window (boundaryAge..EXPENSE_HORIZON_AGE) becomes empty,
 * which makes `lastsFullHorizon` trivially true — a degenerate "you can
 * retire at 95!" answer with zero actual retirement years evaluated. */
const MAX_SEARCHABLE_RETIREMENT_AGE = EXPENSE_HORIZON_AGE;

export interface EarliestRetirementResult {
  /** The earliest age (from this person's current age through
   * MAX_SEARCHABLE_RETIREMENT_AGE) at which retiring still leaves income
   * covering expenses all the way through EXPENSE_HORIZON_AGE — null if
   * not achievable at any age in that range under current assumptions. */
  earliestAge: number | null;
  /** This person's own saved retirement age, for comparison. */
  currentPlanAge: number;
  /** currentPlanAge - earliestAge — positive means they could retire that
   * many years earlier than currently planned; negative means their
   * current plan is already earlier than what's actually sustainable.
   * Null when earliestAge is null. */
  yearsEarlier: number | null;
}

/** "When can I retire?" for one person — holds every other person's
 * (and this person's own every-other-field's) actual saved settings
 * fixed, and finds the earliest retirement age for just this person that
 * still keeps the household's income covering its expenses through
 * EXPENSE_HORIZON_AGE. A linear scan rather than a binary search: the
 * search range tops out around 60-70 candidate ages, cheap either way,
 * and a scan doesn't depend on proving the underlying relationship is
 * strictly monotonic (retiring later should only ever help — more
 * contribution/growth years, a shorter withdrawal period — but a scan
 * finds the right answer even if some edge case wobbles that). */
export function findEarliestRetirementAge(
  people: Person[],
  expenses: Expense[],
  currentAge: number,
  withdrawalRate: WithdrawalRate,
  personId: string,
  today: Date = new Date(),
): EarliestRetirementResult {
  const person = people.find((p) => p.id === personId);
  if (!person) return { earliestAge: null, currentPlanAge: 0, yearsEarlier: null };

  const personAge = calculateAge(person.birthday, today);
  const minAge = Math.max(personAge, 1);

  for (let age = minAge; age <= MAX_SEARCHABLE_RETIREMENT_AGE; age++) {
    const metrics = computeSimulatorComparisonMetrics(people, expenses, currentAge, withdrawalRate, { [personId]: { retirementAge: age } }, today);
    if (metrics.lastsFullHorizon) {
      return { earliestAge: age, currentPlanAge: person.retirementAge, yearsEarlier: person.retirementAge - age };
    }
  }
  return { earliestAge: null, currentPlanAge: person.retirementAge, yearsEarlier: null };
}
