import { describe, expect, it } from "vitest";
import {
  averageOverRange,
  computeSimulatorComparisonMetrics,
  findEarliestHouseholdRetirement,
  firstDeficitAgeFrom,
  householdRetirementBoundaryAge,
  scanRetirementMilestones,
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
    savingsBalance: 0,
    savingsGrowthRatePct: 4,
    savingsContributionMonthly: 0,
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
  const noSavings = new Map([
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
    expect(firstDeficitAgeFrom(income, withdrawal, ss, noSavings, expenses, 60, 62)).toBeNull();
  });

  it("returns the first age where expenses exceed income", () => {
    const expenses = new Map([
      [60, 500],
      [61, 1500],
      [62, 1500],
    ]);
    expect(firstDeficitAgeFrom(income, withdrawal, ss, noSavings, expenses, 60, 62)).toBe(61);
  });

  it("ignores a deficit before startAge", () => {
    const expenses = new Map([
      [60, 5000], // a deficit here doesn't count — search starts at 61
      [61, 500],
      [62, 500],
    ]);
    expect(firstDeficitAgeFrom(income, withdrawal, ss, noSavings, expenses, 61, 62)).toBeNull();
  });

  it("a savings drawdown can cover what would otherwise be a deficit, but only up to what it actually draws", () => {
    const expenses = new Map([
      [60, 500], // surplus already, no shortfall
      [61, 1500], // 500 shortfall — fully covered by savings below
      [62, 1500], // 500 shortfall — only partly covered, still a real deficit
    ]);
    const savings = new Map([
      [60, 0],
      [61, 500], // exactly covers the 61 shortfall -> net 0, not a deficit
      [62, 300], // covers only part of the 62 shortfall -> net -200
    ]);
    expect(firstDeficitAgeFrom(income, withdrawal, ss, savings, expenses, 60, 62)).toBe(62);
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
      currentBalance: 25000,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    // $10k/yr gross withdrawal, taxed at Alice's 20% rate (every withdrawal
    // year here is 61+, past the early-withdrawal penalty threshold) nets
    // $8k/yr — covers the $6k/yr expenses for 2 years (age 61, 62), then
    // the $25k balance is exhausted, the year-3 withdrawal clamps to the
    // $5k remaining (nets $4k), and age 63 goes into deficit.
    const expenses = [makeExpense({ monthlyAmount: 500 })];
    const metrics = computeSimulatorComparisonMetrics([alice], expenses, 60, { mode: "dollar", value: 10000 }, {}, TODAY);
    expect(metrics.lastsFullHorizon).toBe(false);
    expect(metrics.yearsOfDraw).toBe(3);
  });
});

describe("findEarliestHouseholdRetirement", () => {
  const TODAY = new Date(2026, 7, 16); // 2026-08-16, matches projection.test.ts's convention

  it("returns a null-safe result for an empty household", () => {
    const result = findEarliestHouseholdRetirement([], [], 40, { mode: "percent", value: 4 }, {}, TODAY);
    expect(result).toEqual({ earliestYearsOut: null, resultingAgeByPersonId: {}, plannedYearsOut: 0, yearsEarlier: null });
  });

  it("matches single-person hand-derived results (sanity check against the same fixed-dollar depletion math)", () => {
    // Same setup as the old per-person search's exact-boundary test:
    // growthRatePct 0 and matchPct 0 keep the balance trajectory exactly
    // linear, so balance at yearsOut Y is exactly 10000*Y.
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01", // age 40 at TODAY
      retirementAge: 65,
      currentBalance: 0,
      currentSalary: 100000,
      contributionPct: 10,
      matchPct: 0,
      salaryIncreasePct: 0,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    // $5000/yr gross withdrawal, taxed at Alice's 20% rate, nets $4000 —
    // exactly the $4000/yr expense — *only* once withdrawals start at age
    // 60+ (no early-withdrawal penalty); below 60 the extra 10% penalty
    // drops net to $3500, permanently under the $4000 expense regardless
    // of balance size. So the binding constraint here is age, not balance:
    // yearsOut=19 (retiring at 59) is the earliest where the *first*
    // withdrawal year (age 60) — and every year after — clears the bar.
    const expenses = [makeExpense({ monthlyAmount: 4000 / 12 })];
    const result = findEarliestHouseholdRetirement([alice], expenses, 40, { mode: "dollar", value: 5000 }, {}, TODAY);
    expect(result.earliestYearsOut).toBe(19);
    expect(result.resultingAgeByPersonId).toEqual({ alice: 59 });
    expect(result.plannedYearsOut).toBe(25); // 65 - 40
    expect(result.yearsEarlier).toBe(6);
  });

  it("finds the earliest year two differently-aged people can retire together", () => {
    // Alice (40) contributes 10% of a flat $100k -> $10,000/yr to her
    // balance; Bob (30) contributes 10% of a flat $60k -> $6,000/yr.
    // Retiring both at the same yearsOut Y makes their withdrawal years
    // start simultaneously too (personAge + Y - retirementAge lines up for
    // both), so household withdrawal = up to $6,000/yr each = $12,000/yr
    // against an $8,000/yr expense while both balances hold.
    //
    // Bob's balance (6000Y) depletes at fixed $6,000/yr withdrawals after
    // exactly Y years — the binding constraint, since Alice's (10000Y)
    // lasts longer. The household models 45 years (85 - currentAge 40),
    // of which Y are pre-retirement, leaving 45-Y withdrawal years to
    // cover: sustainable exactly when Y >= 45-Y, i.e. Y >= 22.5 -> Y=23.
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01", // age 40
      retirementAge: 65,
      currentBalance: 0,
      currentSalary: 100000,
      contributionPct: 10,
      matchPct: 0,
      salaryIncreasePct: 0,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    const bob = makePerson({
      id: "bob",
      birthday: "1996-01-01", // age 30
      retirementAge: 65,
      currentBalance: 0,
      currentSalary: 60000,
      contributionPct: 10,
      matchPct: 0,
      salaryIncreasePct: 0,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    const expenses = [makeExpense({ monthlyAmount: 8000 / 12 })];
    const result = findEarliestHouseholdRetirement([alice, bob], expenses, 40, { mode: "dollar", value: 6000 }, {}, TODAY);
    expect(result.earliestYearsOut).toBe(23);
    expect(result.resultingAgeByPersonId).toEqual({ alice: 63, bob: 53 });
    expect(result.plannedYearsOut).toBe(35); // max(65-40, 65-30)
    expect(result.yearsEarlier).toBe(12);
  });

  it("applies a per-person scenario override on top of their saved settings", () => {
    // Same Alice, but withdrawing $8000/yr gross against the same
    // $4000/yr expense — even taxed-and-penalized (0.7x) that nets
    // $5600, comfortably above the expense at any age, so *this* pairing
    // is purely balance-constrained (no age floor to fight), letting a
    // balance-boosting scenario override actually move the result.
    //
    // With no override: balance at yearsOut Y is 10000Y, sustainable once
    // it covers (45-Y) years of $8000 withdrawals: 10000Y >= 8000(45-Y)
    // -> Y >= 20 exactly (200,000 covers 25 remaining years of $8000
    // exactly). A scenario starting Alice off with an $18,000 head start
    // (balance 18000 + 10000Y) shifts that exact boundary to Y = 19
    // instead (208,000 covers the 26 remaining years exactly).
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01",
      retirementAge: 65,
      currentBalance: 0,
      currentSalary: 100000,
      contributionPct: 10,
      matchPct: 0,
      salaryIncreasePct: 0,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    const expenses = [makeExpense({ monthlyAmount: 4000 / 12 })];
    const result = findEarliestHouseholdRetirement(
      [alice],
      expenses,
      40,
      { mode: "dollar", value: 8000 },
      { alice: { currentBalance: 18000 } },
      TODAY,
    );
    expect(result.earliestYearsOut).toBe(19);
    expect(result.resultingAgeByPersonId).toEqual({ alice: 59 });
    expect(result.plannedYearsOut).toBe(25); // scenario didn't touch retirementAge
    expect(result.yearsEarlier).toBe(6);
  });

  it("returns null when no shared retirement year is sustainable through the horizon", () => {
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
    // $500k/yr expenses dwarf even Alice's peak earned income, so every
    // candidate yearsOut (including working all the way to the horizon,
    // where the search never actually models a withdrawal year) shows a
    // deficit.
    const expenses = [makeExpense({ monthlyAmount: 500000 / 12 })];
    const result = findEarliestHouseholdRetirement([alice], expenses, 40, { mode: "percent", value: 4 }, {}, TODAY);
    expect(result.earliestYearsOut).toBeNull();
    expect(result.resultingAgeByPersonId).toEqual({});
    expect(result.yearsEarlier).toBeNull();
  });
});

describe("scanRetirementMilestones", () => {
  const TODAY = new Date(2026, 7, 16); // 2026-08-16, matches projection.test.ts's convention

  it("reports sustainability at each milestone age, matching the exact fixed-dollar depletion boundary", () => {
    // Same Alice/expense/withdrawal setup as findEarliestHouseholdRetirement's
    // "matches single-person hand-derived results" test: age 40, flat
    // $100k salary, 10% contribution, 0% growth, 20% tax (default),
    // $4000/yr expenses, $5000/yr dollar withdrawal. That test established
    // age 59 (yearsOut 19) as the earliest sustainable age — the knife
    // edge is age-driven, not balance-driven: below age 60 the 10% early-
    // withdrawal penalty stacks with the 20% tax, netting 5000*0.7=3500,
    // already under the $4000 expense regardless of balance; at 60+ (no
    // penalty) it nets exactly 5000*0.8=4000, a breakeven.
    //
    // So age 58 fails immediately at its very first withdrawal year (age
    // 59, still under 60) rather than via balance depletion; ages 59 and
    // 60 both last the full horizon.
    const alice = makePerson({
      id: "alice",
      birthday: "1986-01-01", // age 40 at TODAY
      retirementAge: 65,
      currentBalance: 0,
      currentSalary: 100000,
      contributionPct: 10,
      matchPct: 0,
      salaryIncreasePct: 0,
      growthRatePct: 0,
      socialSecurityMonthly: 0,
    });
    const expenses = [makeExpense({ monthlyAmount: 4000 / 12 })];
    const results = scanRetirementMilestones([alice], expenses, 40, { mode: "dollar", value: 5000 }, {}, TODAY, [58, 59, 60]);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ age: 58, combinedBalanceAtRetirement: 180000, lastsFullHorizon: false, runsOutAtAge: 59 });
    expect(results[1]).toMatchObject({ age: 59, combinedBalanceAtRetirement: 190000, lastsFullHorizon: true, runsOutAtAge: null });
    expect(results[2]).toMatchObject({ age: 60, combinedBalanceAtRetirement: 200000, lastsFullHorizon: true, runsOutAtAge: null });
  });

  it("skips milestone ages at or before the household's current age", () => {
    const alice = makePerson({ id: "alice", birthday: "1986-01-01" }); // age 40 at TODAY
    const expenses = [makeExpense({ monthlyAmount: 500 })];
    const results = scanRetirementMilestones([alice], expenses, 40, { mode: "percent", value: 4 }, {}, TODAY, [30, 40, 50]);
    expect(results.map((r) => r.age)).toEqual([50]);
  });
});
