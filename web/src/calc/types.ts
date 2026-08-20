// Core data model. Mirrors the Streamlit app's people.json / expenses.json
// shape (see ../../../app.py), translated to camelCase. Not required to be
// byte-compatible with that JSON — an import/export bridge is a separate
// concern for later, if the two apps ever need to exchange files directly.

import type { MarketConditionKey } from "./marketConditions";

export type AccountType = "Pre-tax" | "Roth";

/** A step change to a new, flat salary at a given age, held through
 * retirement — the "Different Income Until Retirement" scenario type.
 * Missing rate fields fall back to whatever the person's own current
 * rates are at the time the change triggers. */
export interface IncomeChange {
  age: number;
  newSalary: number;
  contributionPct?: number;
  matchPct?: number;
  salaryIncreasePct?: number;
}

/** Every field a scenario or the Simulator is allowed to override on a
 * Person, for a single point-in-time "what if". `incomeChange`, if present,
 * additionally steps salary (and optionally contribution/match/raise) at a
 * given age — see `IncomeChange`. */
export interface PersonOverrides {
  currentSalary?: number;
  contributionPct?: number;
  matchPct?: number;
  salaryIncreasePct?: number;
  growthRatePct?: number;
  currentBalance?: number;
  accountType?: AccountType;
  retirementAge?: number;
  stopContributionAge?: number;
  hsaMonthly?: number;
  medicalInsuranceMonthly?: number;
  taxRatePct?: number;
  socialSecurityClaimAge?: number;
  socialSecurityMonthly?: number;
  incomeChange?: IncomeChange;
  /** Simulator-only — not settable via the saved-scenario builder. See
   * marketConditions.ts. `marketConditionStartAge` defaults to the
   * person's current age (i.e. "starts now") if omitted;
   * `marketConditionDurationYears` only matters for a sustained bear/bull
   * condition — historical events use their own fixed shape regardless. */
  marketCondition?: MarketConditionKey;
  marketConditionStartAge?: number;
  marketConditionDurationYears?: number;
}

/** A named, saved single-field (or income-change) override — up to 4 per
 * person. `field` is whichever key of `PersonOverrides` this scenario
 * varies ("incomeChange" for the income-change type). */
export interface Scenario {
  id: string;
  name: string;
  detail: string;
  field: keyof PersonOverrides;
  value: number | IncomeChange;
}

export interface Person {
  id: string;
  name: string;
  birthday: string; // ISO date, e.g. "1990-01-01"
  currentSalary: number;
  contributionPct: number;
  matchPct: number;
  salaryIncreasePct: number;
  growthRatePct: number;
  currentBalance: number;
  accountType: AccountType;
  retirementAge: number;
  stopContributionAge: number;
  hsaMonthly: number;
  medicalInsuranceMonthly: number;
  taxRatePct: number;
  socialSecurityClaimAge: number;
  socialSecurityMonthly: number;
  scenarios: Scenario[];
}

export const EXPENSE_TYPES = [
  "Mortgage", "Heloc/Loans", "Auto Loans", "Utilities", "Groceries",
  "Health Insurance", "Property Taxes", "Life Insurance", "Student Loans",
  "Gas", "529 / College Savings", "Daycare", "Other Costs",
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const LOAN_EXPENSE_TYPES: ReadonlySet<ExpenseType> = new Set([
  "Mortgage", "Heloc/Loans", "Auto Loans", "Student Loans",
]);

export interface Expense {
  id: string;
  type: ExpenseType;
  monthlyAmount: number;
  isLoan: boolean;
  remainingTermYears?: number;
  isPerpetuity: boolean;
  startAge?: number;
  stopAge?: number;
  applyInflation: boolean;
  inflationRate: number;
}

export const EXPENSE_HORIZON_AGE = 85;

/** How much to withdraw from a 401(k) balance each year in retirement —
 * either a percentage of that year's balance (the classic "4% rule" style,
 * where the balance shrinks toward zero but never mathematically reaches
 * it) or a fixed dollar amount (which does fully deplete the balance in
 * finite years, once it runs out). Always evaluated per person, same as
 * the withdrawal math it replaces — not a household total split across
 * people. */
export type WithdrawalRate = { mode: "percent"; value: number } | { mode: "dollar"; value: number };

/** A single point on a year-by-year 401(k) balance projection. */
export interface BalancePoint {
  age: number;
  year: number;
  balance: number;
}

/** {age: amount} — every household-level projection function returns this
 * shape so callers can zip several of them together by age. */
export type ByAge = Map<number, number>;
