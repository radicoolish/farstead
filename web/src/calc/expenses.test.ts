import { describe, expect, it } from "vitest";
import {
  buildExpenseChartData,
  describeExpense,
  projectExpenseAnnualCosts,
  projectHouseholdTotalExpensesByAge,
} from "./expenses";
import type { Expense } from "./types";

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e1",
    type: "Other Costs",
    monthlyAmount: 500,
    isLoan: false,
    isPerpetuity: true,
    applyInflation: false,
    inflationRate: 0,
    ...overrides,
  };
}

describe("projectExpenseAnnualCosts", () => {
  it("a loan pays its fixed monthly amount until the term ends, then stops", () => {
    const loan = makeExpense({
      type: "Mortgage",
      isLoan: true,
      isPerpetuity: true,
      monthlyAmount: 2000,
      remainingTermYears: 3,
    });
    const costs = projectExpenseAnnualCosts(loan, 40, 45);
    expect(costs.get(40)).toBe(24000); // year 0: active
    expect(costs.get(42)).toBe(24000); // year 2: active
    expect(costs.get(43)).toBe(0); // year 3: term elapsed
    expect(costs.get(45)).toBe(0);
  });

  it("a perpetuity runs the whole horizon with no inflation", () => {
    const costs = projectExpenseAnnualCosts(makeExpense({ monthlyAmount: 500 }), 40, 42);
    expect(costs.get(40)).toBe(6000);
    expect(costs.get(42)).toBe(6000); // flat — no inflation applied
  });

  it("compounds inflation from today, even before the expense becomes active", () => {
    const expense = makeExpense({
      isPerpetuity: false,
      startAge: 45,
      stopAge: 50,
      monthlyAmount: 1000,
      applyInflation: true,
      inflationRate: 10,
    });
    const costs = projectExpenseAnnualCosts(expense, 40, 46);
    expect(costs.get(44)).toBe(0); // not active yet
    // Active at 45 (i=5): monthly inflated by 5 years of 10% compounding.
    const expectedMonthly45 = 1000 * Math.pow(1.1, 5);
    expect(costs.get(45)).toBeCloseTo(expectedMonthly45 * 12, 5);
  });

  it("a start/stop expense is inactive outside its window", () => {
    const expense = makeExpense({ isPerpetuity: false, startAge: 50, stopAge: 55 });
    const costs = projectExpenseAnnualCosts(expense, 40, 60);
    expect(costs.get(49)).toBe(0);
    expect(costs.get(50)).toBeGreaterThan(0);
    expect(costs.get(55)).toBeGreaterThan(0);
    expect(costs.get(56)).toBe(0);
  });
});

describe("projectHouseholdTotalExpensesByAge", () => {
  it("sums multiple expenses at each age", () => {
    const a = makeExpense({ id: "a", monthlyAmount: 500 });
    const b = makeExpense({ id: "b", monthlyAmount: 300 });
    const totals = projectHouseholdTotalExpensesByAge([a, b], 40, 40);
    expect(totals.get(40)).toBe((500 + 300) * 12);
  });
});

describe("describeExpense", () => {
  it("describes a loan with its remaining term", () => {
    const loan = makeExpense({ isLoan: true, monthlyAmount: 2250, remainingTermYears: 11 });
    expect(describeExpense(loan)).toBe("$2,250/mo — loan, 11 yrs remaining");
  });

  it("describes a perpetuity with inflation", () => {
    const expense = makeExpense({ monthlyAmount: 500, applyInflation: true, inflationRate: 3 });
    expect(describeExpense(expense)).toBe("$500/mo — ongoing — 3.0% inflation");
  });

  it("describes a start/stop expense with no inflation", () => {
    const expense = makeExpense({
      isPerpetuity: false,
      startAge: 39,
      stopAge: 49,
      monthlyAmount: 300,
      applyInflation: false,
    });
    expect(describeExpense(expense)).toBe("$300/mo — ages 39–49 — no inflation");
  });
});

describe("buildExpenseChartData", () => {
  it("produces one row per age with a key per active expense type", () => {
    const mortgage = makeExpense({ id: "m", type: "Mortgage", isLoan: true, monthlyAmount: 2000, remainingTermYears: 2 });
    const groceries = makeExpense({ id: "g", type: "Groceries", monthlyAmount: 500 });
    const rows = buildExpenseChartData([mortgage, groceries], 40, 42);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ age: 40, Mortgage: 24000, Groceries: 6000 });
    // Mortgage's 2-year term has elapsed by age 42 — key absent, not 0.
    expect(rows[2]).toEqual({ age: 42, Groceries: 6000 });
    expect(rows[2].Mortgage).toBeUndefined();
  });

  it("returns an age row for every age even with no expenses", () => {
    const rows = buildExpenseChartData([], 40, 42);
    expect(rows).toEqual([{ age: 40 }, { age: 41 }, { age: 42 }]);
  });
});
