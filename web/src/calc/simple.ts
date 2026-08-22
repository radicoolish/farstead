// The "Simple" planning mode's data model — a single household treated as
// one aggregate unit (one income, one 401(k), one savings account) instead
// of Advanced mode's per-person detail. Deliberately independent of
// Person[]/Expense[] (Advanced's data): converting a multi-person household
// down to one aggregate would be lossy, and keeping the two modes' saved
// data completely separate means switching between them never overwrites
// anything.
//
// Rather than duplicating the projection engine a second time, a Simple
// household is converted into the existing Person/Expense shapes (see
// simpleHouseholdToPerson / simpleExpensesToExpenses below) and run through
// the exact same calc functions Advanced mode uses — so every fix already
// made there (Social Security tax, 401(k) withdrawal tax/penalty, savings
// drawdown) applies here for free, with no separate implementation to keep
// in sync.

import { estimateMonthlySocialSecurity } from "./socialSecurity";
import type { AccountType, Expense, ExpenseType, Person, PersonOverrides, WithdrawalRate } from "./types";

export interface SimpleExpense {
  id: string;
  /** Household reference age the expense starts being active at (inclusive). */
  startAge: number;
  /** Household reference age the expense stops being active at (inclusive). */
  stopAge: number;
  monthlyAmount: number;
}

export interface SimpleHousehold {
  currentAge: number;
  householdIncome: number;
  contributionPct: number;
  matchPct: number;
  salaryIncreasePct: number;
  taxRatePct: number;
  currentBalance: number;
  growthRatePct: number;
  retirementAge: number;
  savingsBalance: number;
  savingsGrowthRatePct: number;
  /** One rate applied to every expense row, instead of Advanced's
   * per-expense inflation setting — keeps the input list to one field. */
  inflationRatePct: number;
  withdrawalRate: WithdrawalRate;
  expenses: SimpleExpense[];
}

export function defaultSimpleHousehold(): SimpleHousehold {
  return {
    currentAge: 35,
    householdIncome: 100000,
    contributionPct: 6,
    matchPct: 3,
    salaryIncreasePct: 3,
    taxRatePct: 22,
    currentBalance: 0,
    growthRatePct: 7,
    retirementAge: 65,
    savingsBalance: 0,
    savingsGrowthRatePct: 4,
    inflationRatePct: 3,
    withdrawalRate: { mode: "percent", value: 4 },
    expenses: [],
  };
}

const SIMPLE_ACCOUNT_TYPE: AccountType = "Pre-tax";
/** Not exposed as a Simple-mode input — full retirement age is a
 * reasonable, unsurprising default for an auto-calculated benefit. */
const SIMPLE_SS_CLAIM_AGE = 67;
/** Simple mode's household-level expenses don't have a category — grouped
 * under the same catch-all type the Advanced form itself offers. */
const SIMPLE_EXPENSE_TYPE: ExpenseType = "Other Costs";

/** Converts a Simple household into the shape the existing projection
 * engine expects: one synthetic Person, standing in for the whole
 * household. `birthday` is synthesized from `currentAge` (Jan 1 of the
 * matching birth year) since Simple mode only collects a plain age, not an
 * actual date — precise to the year, which is all Simple mode's other
 * inputs support anyway. */
export function simpleHouseholdToPerson(simple: SimpleHousehold, today: Date = new Date()): Person {
  const birthYear = today.getFullYear() - simple.currentAge;
  const birthday = `${birthYear}-01-01`;
  return {
    id: "simple-household",
    name: "Household",
    birthday,
    currentSalary: simple.householdIncome,
    contributionPct: simple.contributionPct,
    matchPct: simple.matchPct,
    salaryIncreasePct: simple.salaryIncreasePct,
    growthRatePct: simple.growthRatePct,
    currentBalance: simple.currentBalance,
    accountType: SIMPLE_ACCOUNT_TYPE,
    retirementAge: simple.retirementAge,
    stopContributionAge: simple.retirementAge,
    hsaMonthly: 0,
    medicalInsuranceMonthly: 0,
    taxRatePct: simple.taxRatePct,
    socialSecurityClaimAge: SIMPLE_SS_CLAIM_AGE,
    socialSecurityMonthly: estimateMonthlySocialSecurity(simple.householdIncome, birthday, SIMPLE_SS_CLAIM_AGE),
    savingsBalance: simple.savingsBalance,
    savingsGrowthRatePct: simple.savingsGrowthRatePct,
    savingsContributionMonthly: 0,
    scenarios: [],
  };
}

/** Converts Simple mode's age-range expense rows into the existing
 * Expense shape — a fixed window (never a loan or an open-ended
 * perpetuity), inflated at the household's one shared rate. */
export function simpleExpensesToExpenses(simple: SimpleHousehold): Expense[] {
  return simple.expenses.map((e) => ({
    id: e.id,
    type: SIMPLE_EXPENSE_TYPE,
    monthlyAmount: e.monthlyAmount,
    isLoan: false,
    isPerpetuity: false,
    startAge: e.startAge,
    stopAge: e.stopAge,
    applyInflation: simple.inflationRatePct > 0,
    inflationRate: simple.inflationRatePct,
  }));
}

/** A single-person override map, keyed by the synthetic household Person's
 * id — the shape every existing per-age-candidate search (see
 * findEarliestHouseholdRetirement, computeSimulatorComparisonMetrics)
 * expects for trying a different retirement age. */
export function simpleRetirementAgeOverride(retirementAge: number): Record<string, PersonOverrides> {
  return { "simple-household": { retirementAge } };
}
