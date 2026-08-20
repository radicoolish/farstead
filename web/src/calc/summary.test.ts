import { describe, expect, it } from "vitest";
import {
  averageOverRange,
  computeSimulatorComparisonMetrics,
  findEarliestRetirementAge,
  firstDeficitAgeFrom,
  householdRetirementBoundaryAge,
} from "./summary";
import type { Expense, Person } from "./types";

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    name: "Test Person",
    birthday: "1986-01-01",
    currentSalary: 100000,
    contributionPct: 10,
    matchPct: 4,
    salaryIncreasePct: 2,
    growthRatePct: 6,
    currentBalance: 10000,
    accountType: "Pre-tax",
    retirementAge: 65,
    stopContributionAge: 65,
    hsaMonthly: 0,
    medicalInsuranceMonthly: 0,
    taxRatePct: 20,
    socialSecurityClaimAge: 67,
    socialSecurityMonthly: 0,
    scenarios: [],
    ...overrides,
  };
}

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

describe("householdRetirementBoundaryAge", () => {
  it("is just the person's own retirement age for a single-person household", () => {
    expect(householdRetirementBoundaryAge([makePerson({ retirementAge: 62 })])).toBe(62);
  });

  it("is the earliest retirement age across a multi-person household", () => {
    const people = [
      makePerson({ id: "a", retirementAge: 68 }),
      makePerson({ id: "b", retirementAge: 60 }),
      makePerson({ id: "c", retirementAge: 65 }),
    ];
    expect(householdRetirementBoundaryAge(people)).toBe(60);
  });

  it("uses an overridden retirement age when one is given", () => {
    const people = [makePerson({ id: "a", retirementAge: 65 }), makePerson({ id: "b", retirementAge: 60 })];
    expect(householdRetirementBoundaryAge(people, { a: { retirementAge: 55 } })).toBe(55);
  });
});

describe("averageOverRange", () => {
  it("averages the values in the given inclusive range", () => {
    const byAge = new Map([
      [40, 100],
      [41, 200],
      [42, 300],
    ]);
    expect(averageOverRange(byAge, 40, 42)).toBeCloseTo(200, 5);
    expect(averageOverRange(byAge, 41, 42)).toBeCloseTo(250, 5);
  });

  it("returns 0 for an empty (inverted) range", () => {
    const byAge = new Map([[40, 100]]);
    expect(averageOverRange(byAge, 45, 40)).toBe(0);
  });

  it("returns 0 when the range has no matching entries", () => {
    const byAge = new Map([[40, 100]]);
    expect(averageOverRange(byAge, 50, 55)).toBe(0);
  });

  it("only averages over entries actually present in the range", () => {
    const byAge = new Map([
      [40, 10],
      [42, 30],
    ]);
    // age 41 is missing — averages just the 2 present entries, not 3.
    expect(averageOverRange(byAge, 40, 42)).toBeCloseTo(20, 5);
  });
});

describe("firstDeficitAgeFrom", () => {
  const income = new Map([
    [60, 1000],
    [61, 1000],
    [62, 1000],
  ]);
  const withdrawal = new Map([
    [60, 0],
    [61, 0],
    [62, 0],
  ]);
  const ss = new Map([
    [60, 0],
    [61, 0],
    [62, 0],
  ]);

  it("returns null when income covers expenses for the whole range", () => {
    const expenses = new Map([
      [60, 500],
      [61, 500],
      [62, 500],
    ]);
    expect(firstDeficitAgeFrom(income, withdrawal, ss, expenses, 60, 62)).toBeNull();
  });

  it("returns the first age where expenses exceed income", () => {
    const expenses = new Map([
      [60, 500],
      [61, 1500],
      [62, 1500],
    ]);
    expect(firstDeficitAgeFrom(income, withdrawal, ss, expenses, 60, 62)).toBe(61);
  });

  it("ignores a deficit before startAge", () => {
    const expenses = new Map([
      [60, 5000], // a deficit here doesn't count — search starts at 61
      [61, 500],
      [62, 500],
    ]);
    expect(firstDeficitAgeFrom(income, withdrawal, ss, expenses, 61, 62)).toBeNull();
  });
});

describe("computeSimulatorComparisonMetrics", () => {
  const TODAY = new Date(2026, 7, 16); // 2026-08-16, matches projection.test.ts's convention

  it("balance at retirement is exactly the current balance when retirement age equals current age", () => {
    // yearsToGrow = max(retirementAge - age, 0) = 0, so projectBalance can't apply any growth/contributions.
    const alice = makePerson({ id: "alice", birthday: "1966-01-01", retirementAge: 60, currentBalance: 100000 });
    const bob = makePerson({ id: "bob", birthday: "1966-01-01", retirementAge: 60, currentBalance: 150000 });
    const metrics = computeSimulatorComparisonMetrics([alice, bob], [], 60, { mode: "percent", value: 4 }, {}, TODAY);
    expect(metrics.combinedBalanceAtRetirement).toBeCloseTo(250000, 2);
  });

  it("an override changes the balance used, not the saved person's own value", () => {
    const alice = makePerson({ id: "alice", birthday: "1966-01-01", retirementAge: 60, currentBalance: 100000 });
    const metrics = computeSimulatorComparisonMetrics(
      [alice],
      [],
      60,
      { mode: "percent", value: 4 },
      { alice: { currentBalance: 500000 } },
      TODAY,
    );
    expect(metrics.combinedBalanceAtRetirement).toBeCloseTo(500000, 2);
  });

  it("lasts the full horizon when retirement income comfortably covers expenses", () => {
    const alice = makePerson({
      id: "alice",
      birthday: "1966-01-01",
      retirementAge: 60,
      currentBalance: 0,
      socialSecurityClaimAge: 60,
      socialSecurityMonthly: 5000,
    });
    const expenses = [makeExpense({ monthlyAmount: 500 })];
    const metrics = computeSimulatorComparisonMetrics([alice], expenses, 60, { mode: "percent", value: 4 }, {}, TODAY);
    expect(metrics.lastsFullHorizon).toBe(true);
    expect(metrics.yearsOfDraw).toBe(85 - 60);
  });

  it("shows a short runway when expenses immediately outpace retirement income", () => {
    const alice = makePerson({
      id: "alice",
      birthday: "1966-01-01",
      retirementAge: 60,
      currentBalance: 0, // withdrawal is always 0 regardless of rate
      socialSecurityMonthly: 0,
    });
    const expenses = [makeExpense({ monthlyAmount: 50000 / 12 })];
    const metrics = computeSimulatorComparisonMetrics([alice], expenses, 60, { mode: "percent", value: 4 }, {}, TODAY);
    expect(metrics.lastsFullHorizon).toBe(false);
    // Earned income still covers age 60 itself (the retirement-age year);
    // income stops the year after, so the deficit lands at 61 — 1 year of draw.
    expect(metrics.yearsOfDraw).toBe(1);
  });

  it("works in dollar mode too, where the withdrawal actually runs out", () => {
    const alice = makePerson({
      id: "alice",
      birthday: "1966-01-01",
      retirementAge: 60,
      currentBalance: 20000,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    // $10k/yr withdrawal covers the $9k/yr expenses for 2 years (age 61,
    // 62), then the $20k balance is exhausted and age 63 goes into deficit.
    const expenses = [makeExpense({ monthlyAmount: 750 })];
    const metrics = computeSimulatorComparisonMetrics([alice], expenses, 60, { mode: "dollar", value: 10000 }, {}, TODAY);
    expect(metrics.lastsFullHorizon).toBe(false);
    expect(metrics.yearsOfDraw).toBe(3);
  });
});

describe("findEarliestRetirementAge", () => {
  const TODAY = new Date(2026, 7, 16); // 2026-08-16, matches projection.test.ts's convention

  it("returns a null-safe result for an unknown person id", () => {
    const alice = makePerson({ id: "alice" });
    const result = findEarliestRetirementAge([alice], [], 40, { mode: "percent", value: 4 }, "nobody", TODAY);
    expect(result).toEqual({ earliestAge: null, currentPlanAge: 0, yearsEarlier: null });
  });

  it("finds the person's current age itself when retiring today already covers expenses", () => {
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01", // age 40 at TODAY
      retirementAge: 40,
      currentBalance: 0,
      socialSecurityClaimAge: 40,
      socialSecurityMonthly: 5000,
    });
    const expenses = [makeExpense({ monthlyAmount: 500 })];
    const result = findEarliestRetirementAge([alice], expenses, 40, { mode: "percent", value: 4 }, "alice", TODAY);
    expect(result.earliestAge).toBe(40);
    expect(result.currentPlanAge).toBe(40);
    expect(result.yearsEarlier).toBe(0);
  });

  it("returns null when no age through the horizon achieves a sustainable retirement", () => {
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01",
      currentBalance: 0,
      growthRatePct: 0,
      contributionPct: 0,
      matchPct: 0,
      salaryIncreasePct: 0, // flat $100k salary, net ~$80k/yr after 20% tax
      socialSecurityMonthly: 0,
    });
    // $200k/yr expenses dwarf even Alice's peak earned income, so every
    // candidate retirement age (including the boundary age itself, where
    // earned income still counts for that one year) shows a deficit.
    const expenses = [makeExpense({ monthlyAmount: 200000 / 12 })];
    const result = findEarliestRetirementAge([alice], expenses, 40, { mode: "percent", value: 4 }, "alice", TODAY);
    expect(result.earliestAge).toBeNull();
    expect(result.yearsEarlier).toBeNull();
  });

  it("finds the exact earliest age a fixed-dollar withdrawal can sustain expenses through the horizon", () => {
    // growthRatePct 0 and matchPct 0 keep the balance trajectory exactly
    // linear: contributing 10% of a flat $100k salary each year Alice works
    // adds exactly $10,000/year to her balance, so her balance at
    // retirement age R is exactly 10000 * (R - 40).
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01", // age 40 at TODAY
      retirementAge: 65, // her own saved plan, for comparison
      currentBalance: 0,
      currentSalary: 100000,
      contributionPct: 10,
      matchPct: 0,
      salaryIncreasePct: 0,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    // $4000/yr recurring expenses against a fixed $5000/yr withdrawal:
    // - Retiring at 55 leaves a balance of 10000*(55-40) = $150,000, which
    //   funds exactly 30 full $5000 withdrawals (ages 56-85) with $0 left
    //   over — covers every year through the horizon.
    // - Retiring at 54 leaves only $140,000, which funds 28 full
    //   withdrawals then runs dry partway through age 83, leaving that
    //   year's withdrawal short of the $4000 expense.
    const expenses = [makeExpense({ monthlyAmount: 4000 / 12 })];
    const result = findEarliestRetirementAge([alice], expenses, 40, { mode: "dollar", value: 5000 }, "alice", TODAY);
    expect(result.earliestAge).toBe(55);
    expect(result.currentPlanAge).toBe(65);
    expect(result.yearsEarlier).toBe(10);
  });

  it("holds other household members' settings fixed while searching one person's age", () => {
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01", // age 40 at TODAY
      retirementAge: 40,
      currentBalance: 0,
      socialSecurityClaimAge: 40,
      socialSecurityMonthly: 5000, // covers expenses alone, regardless of bob
    });
    const bob = makePerson({
      id: "bob",
      birthday: "1986-01-01",
      retirementAge: 70, // bob's own saved plan is untouched by alice's search
      currentBalance: 0,
      socialSecurityMonthly: 0,
    });
    const expenses = [makeExpense({ monthlyAmount: 500 })];
    const result = findEarliestRetirementAge([alice, bob], expenses, 40, { mode: "percent", value: 4 }, "alice", TODAY);
    expect(result.earliestAge).toBe(40);
    expect(result.currentPlanAge).toBe(40);
  });
});
