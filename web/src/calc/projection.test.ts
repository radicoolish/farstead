import { describe, expect, it } from "vitest";
import { effectiveGrowthRateForYear, MARKET_CONDITIONS } from "./marketConditions";
import {
  buildHouseholdComboData,
  personScenarioOptions,
  projectBalance,
  projectHouseholdBalanceByAge,
  projectHouseholdNetIncomeByAge,
  projectHouseholdSocialSecurityByAge,
  projectHouseholdWithdrawalIncomeByAge,
  projectSeriesByYear,
} from "./projection";
import type { Person, Scenario } from "./types";

// Fixed reference date so age-derived expectations stay correct regardless
// of when the suite actually runs. All expected values below were
// independently cross-checked against a from-scratch Python port of the
// same logic (not copy-pasted from app.py), run against this exact date.
const TODAY = new Date(2026, 7, 16); // 2026-08-16

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    name: "Test Person",
    birthday: "1986-01-01", // age 40 as of TODAY
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

describe("projectBalance", () => {
  it("starts at the current balance in the current year", () => {
    const rows = projectBalance(makePerson(), {}, TODAY);
    expect(rows[0]).toEqual({ age: 40, year: 2026, balance: 10000 });
  });

  it("compounds growth plus contribution + match each year", () => {
    const rows = projectBalance(makePerson(), {}, TODAY);
    // 10000 * 1.06 + 100000 * (0.10 + 0.04) = 10600 + 14000 = 24600
    expect(rows[1]).toEqual({ age: 41, year: 2027, balance: 24600 });
  });

  it("projects through retirement age and matches the verified reference", () => {
    const rows = projectBalance(makePerson(), {}, TODAY);
    const atRetirement = rows.find((r) => r.age === 65);
    expect(atRetirement?.balance).toBeCloseTo(970861.36, 1);
  });

  it("stops contributing past the stop-contribution age but keeps growing", () => {
    const rows = projectBalance(makePerson({ stopContributionAge: 50 }), {}, TODAY);
    const at50 = rows.find((r) => r.age === 50)!;
    const at51 = rows.find((r) => r.age === 51)!;
    // Growth only, no contribution: balance(51) = balance(50) * 1.06
    expect(at51.balance).toBeCloseTo(at50.balance * 1.06, 1);
  });

  it("steps salary, contribution, and raise at the income-change age", () => {
    const rows = projectBalance(
      makePerson(),
      { incomeChange: { age: 45, newSalary: 60000, contributionPct: 5, salaryIncreasePct: 1 } },
      TODAY,
    );
    const at44 = rows.find((r) => r.age === 44)!;
    const at45 = rows.find((r) => r.age === 45)!;
    // Contribution + match at 45 uses the new salary/contribution, not the old trajectory.
    const expectedContribution45 = 60000 * (0.05 + 0.04); // match_pct unaffected by the override
    expect(at45.balance).toBeCloseTo(at44.balance * 1.06 + expectedContribution45, 1);
  });
});

describe("projectHouseholdNetIncomeByAge", () => {
  const person = makePerson();

  it("matches the verified base trajectory with no income change", () => {
    const totals = projectHouseholdNetIncomeByAge([person], 40, 50, {}, TODAY);
    expect(totals.get(43)).toBeCloseTo(74284.56, 1);
    expect(totals.get(45)).toBeCloseTo(77285.6562, 2);
  });

  it("drops income at the income-change age and keeps other people unaffected", () => {
    const overrides = {
      p1: { incomeChange: { age: 45, newSalary: 60000, contributionPct: 5, salaryIncreasePct: 1 } },
    };
    const totals = projectHouseholdNetIncomeByAge([person], 40, 50, overrides, TODAY);
    expect(totals.get(44)).toBeCloseTo(75770.2512, 2); // unaffected before the trigger
    expect(totals.get(45)).toBeCloseTo(45000, 1); // 60000 - 5% contribution - 20% tax
    expect(totals.get(46)).toBeCloseTo(45450, 1); // salary grew 1% to 60600
  });

  it("stops counting income once a person passes their own retirement age", () => {
    const totals = projectHouseholdNetIncomeByAge(
      [makePerson({ retirementAge: 42 })],
      40,
      45,
      {},
      TODAY,
    );
    expect(totals.get(42)).toBeGreaterThan(0);
    expect(totals.get(43)).toBe(0);
  });

  it("sums independently across multiple people", () => {
    const alice = makePerson({ id: "alice", currentSalary: 50000 });
    const bob = makePerson({ id: "bob", currentSalary: 50000 });
    const solo = projectHouseholdNetIncomeByAge([alice], 40, 40, {}, TODAY).get(40)!;
    const pair = projectHouseholdNetIncomeByAge([alice, bob], 40, 40, {}, TODAY).get(40)!;
    expect(pair).toBeCloseTo(solo * 2, 5);
  });
});

describe("projectHouseholdWithdrawalIncomeByAge", () => {
  it("matches the verified withdrawal trajectory starting the year after retirement", () => {
    // currentAge must match the person's real current age (40, from their
    // birthday) — the household reference "age" axis only lines up with a
    // given person's own age trigger (retirementAge here) when the two
    // start in sync, exactly like the app's "Current Age (for projection)"
    // input defaults to the first person's real age.
    // Person retires at 65 (accountType Pre-tax, taxRatePct 20) — every
    // withdrawal year here is age 66+, past the early-withdrawal penalty
    // threshold, so only the 20% tax applies: net = gross * 0.8.
    const person = makePerson();
    const totals = projectHouseholdWithdrawalIncomeByAge([person], 40, 68, { mode: "percent", value: 4 }, {}, TODAY);
    expect(totals.get(65)).toBe(0); // retirement year itself: no withdrawal yet
    expect(totals.get(66)).toBeCloseTo(38834.45 * 0.8, 1);
    expect(totals.get(67)).toBeCloseTo(39517.94 * 0.8, 1);
    expect(totals.get(68)).toBeCloseTo(40213.46 * 0.8, 1);
  });

  it("in dollar mode, withdraws the fixed amount and clamps once the balance runs out", () => {
    // Retires immediately (retirementAge === current age) so the starting
    // balance is exactly currentBalance, with 0% growth so depletion is
    // pure subtraction — easy to hand-verify, and demonstrates the one
    // thing percent mode structurally can't: actually hitting zero. Every
    // withdrawal year here is under 60 (accountType Pre-tax, taxRatePct
    // 20), so both the 20% tax and the 10% early-withdrawal penalty apply:
    // net = gross * 0.7.
    const person = makePerson({ retirementAge: 40, currentBalance: 10000, growthRatePct: 0 });
    const totals = projectHouseholdWithdrawalIncomeByAge([person], 40, 45, { mode: "dollar", value: 3000 }, {}, TODAY);
    expect(totals.get(40)).toBe(0); // retirement year itself: no withdrawal yet
    expect(totals.get(41)).toBeCloseTo(3000 * 0.7, 2); // gross 10000 -> 7000
    expect(totals.get(42)).toBeCloseTo(3000 * 0.7, 2); // gross 7000 -> 4000
    expect(totals.get(43)).toBeCloseTo(3000 * 0.7, 2); // gross 4000 -> 1000
    expect(totals.get(44)).toBeCloseTo(1000 * 0.7, 2); // clamped: only 1000 left
    expect(totals.get(45)).toBe(0); // balance fully depleted — stays 0, not negative
  });
});

describe("projectHouseholdWithdrawalIncomeByAge — tax and early-withdrawal penalty", () => {
  it("Pre-tax: taxes the withdrawal and adds the 10% penalty before age 60", () => {
    const person = makePerson({
      retirementAge: 40, // withdrawal starts at 41 — well under 60
      currentBalance: 1_000_000, // large enough that the withdrawal never clamps
      growthRatePct: 0,
      taxRatePct: 25,
      accountType: "Pre-tax",
    });
    const totals = projectHouseholdWithdrawalIncomeByAge([person], 40, 41, { mode: "dollar", value: 10000 }, {}, TODAY);
    expect(totals.get(41)).toBeCloseTo(10000 * (1 - 0.25 - 0.1), 2); // tax + penalty
  });

  it("Pre-tax: drops the penalty (keeps the tax) once withdrawals start at exactly 60", () => {
    const person = makePerson({
      retirementAge: 59, // withdrawal starts at exactly age 60 — no penalty
      currentBalance: 1_000_000,
      growthRatePct: 0,
      taxRatePct: 25,
      accountType: "Pre-tax",
    });
    const totals = projectHouseholdWithdrawalIncomeByAge([person], 40, 60, { mode: "dollar", value: 10000 }, {}, TODAY);
    expect(totals.get(60)).toBeCloseTo(10000 * (1 - 0.25), 2); // tax only
  });

  it("Roth: no tax and no penalty, even before age 60", () => {
    const person = makePerson({
      retirementAge: 40,
      currentBalance: 1_000_000,
      growthRatePct: 0,
      taxRatePct: 25,
      accountType: "Roth",
    });
    const totals = projectHouseholdWithdrawalIncomeByAge([person], 40, 41, { mode: "dollar", value: 10000 }, {}, TODAY);
    expect(totals.get(41)).toBeCloseTo(10000, 2); // full gross — Roth is modeled tax/penalty-free
  });
});

describe("market conditions", () => {
  it("effectiveGrowthRateForYear leaves the rate unaffected at or before startAge", () => {
    expect(effectiveGrowthRateForYear(0.06, MARKET_CONDITIONS.bear, 40, 40, 5)).toBeCloseTo(0.06, 5);
    expect(effectiveGrowthRateForYear(0.06, MARKET_CONDITIONS.bear, 35, 40, 5)).toBeCloseTo(0.06, 5);
  });

  it("effectiveGrowthRateForYear applies a flat adjustment for bear/bull for durationYears, then reverts", () => {
    expect(effectiveGrowthRateForYear(0.06, MARKET_CONDITIONS.bear, 41, 40, 5)).toBeCloseTo(0.0, 5); // year 1
    expect(effectiveGrowthRateForYear(0.06, MARKET_CONDITIONS.bear, 45, 40, 5)).toBeCloseTo(0.0, 5); // year 5, still within duration
    expect(effectiveGrowthRateForYear(0.06, MARKET_CONDITIONS.bear, 46, 40, 5)).toBeCloseTo(0.06, 5); // year 6, duration elapsed
    expect(effectiveGrowthRateForYear(0.06, MARKET_CONDITIONS.bull, 41, 40, 5)).toBeCloseTo(0.1, 5);
  });

  it("effectiveGrowthRateForYear steps through a historical sequence from startAge, then reverts to the base rate", () => {
    const dotcom = MARKET_CONDITIONS.dotcom;
    expect(effectiveGrowthRateForYear(0.06, dotcom, 41, 40, 5)).toBeCloseTo(-0.09, 5); // year 1
    expect(effectiveGrowthRateForYear(0.06, dotcom, 44, 40, 5)).toBeCloseTo(0.29, 5); // year 4, last of the sequence
    expect(effectiveGrowthRateForYear(0.06, dotcom, 45, 40, 5)).toBeCloseTo(0.06, 5); // year 5, sequence exhausted
  });

  it("projectBalance applies a sustained bear-market adjustment starting now by default", () => {
    const rows = projectBalance(makePerson(), { marketCondition: "bear" }, TODAY);
    // Base case (no override) is 24600 at 6% growth; bear knocks the
    // effective rate to 0%, so only the contribution is added.
    expect(rows.find((r) => r.age === 41)?.balance).toBeCloseTo(24000, 1);
  });

  it("projectBalance applies a historical event sequence starting now, then reverts to the base rate afterward", () => {
    const rows = projectBalance(makePerson(), { marketCondition: "dotcom" }, TODAY);
    const at44 = rows.find((r) => r.age === 44)!; // end of the 4-year dot-com sequence
    const at45 = rows.find((r) => r.age === 45)!; // first year back on the base 6% assumption
    const contributionAt45 = 100000 * Math.pow(1.02, 4) * 0.14; // unaffected salary trajectory * (contrib+match)
    expect(at45.balance).toBeCloseTo(at44.balance * 1.06 + contributionAt45, 0);
  });

  it("projectBalance delays a historical event until marketConditionStartAge instead of starting now", () => {
    const delayed = projectBalance(makePerson(), { marketCondition: "dotcom", marketConditionStartAge: 44 }, TODAY);
    const baseline = projectBalance(makePerson(), {}, TODAY);
    // Unaffected through the delayed start age — identical to the baseline.
    expect(delayed.find((r) => r.age === 44)?.balance).toBeCloseTo(baseline.find((r) => r.age === 44)!.balance, 1);
    // First affected year is age 45 (the sequence's -9% year 1), not age 41.
    const at44 = delayed.find((r) => r.age === 44)!;
    const at45 = delayed.find((r) => r.age === 45)!;
    const contributionAt45 = 100000 * Math.pow(1.02, 4) * 0.14;
    expect(at45.balance).toBeCloseTo(at44.balance * 0.91 + contributionAt45, 0);
  });

  it("projectBalance reverts a sustained bear market to the base rate once marketConditionDurationYears elapses", () => {
    const shortBear = projectBalance(makePerson(), { marketCondition: "bear", marketConditionDurationYears: 2 }, TODAY);
    const at42 = shortBear.find((r) => r.age === 42)!; // last of the 2 affected years (0% growth)
    const at43 = shortBear.find((r) => r.age === 43)!; // duration elapsed — back to 6%
    const contributionAt43 = 100000 * 1.02 * 1.02 * 0.14; // unaffected salary trajectory * (contrib+match)
    expect(at43.balance).toBeCloseTo(at42.balance * 1.06 + contributionAt43, 0);
  });
});

describe("projectHouseholdBalanceByAge", () => {
  it("matches projectBalance's own trajectory before retirement", () => {
    const person = makePerson();
    const totals = projectHouseholdBalanceByAge([person], 40, 68, { mode: "percent", value: 4 }, {}, TODAY);
    // From the projectBalance suite: balance(41) = 24600 exactly.
    expect(totals.get(41)).toBeCloseTo(24600, 1);
    // From the projectBalance suite: balance(65, at retirement) = 970861.36.
    expect(totals.get(65)).toBeCloseTo(970861.36, 1);
  });

  it("depletes by the withdrawal rate after retirement, cross-checked against projectHouseholdWithdrawalIncomeByAge", () => {
    const person = makePerson();
    const balances = projectHouseholdBalanceByAge([person], 40, 68, { mode: "percent", value: 4 }, {}, TODAY);
    const withdrawals = projectHouseholdWithdrawalIncomeByAge([person], 40, 68, { mode: "percent", value: 4 }, {}, TODAY);
    // The withdrawal *taken* at each age is exactly 4% of the balance this
    // function reports for the *previous* age — the two functions share
    // the same underlying (gross) depletion mechanics, just exposing
    // different parts of it. What lands in the withdrawal-income total is
    // net of the person's 20% tax rate (ages 66+ are past the early-
    // withdrawal penalty threshold, so no penalty here).
    expect(balances.get(66)! * 0.04 * 0.8).toBeCloseTo(withdrawals.get(67)!, 1);
    expect(balances.get(67)! * 0.04 * 0.8).toBeCloseTo(withdrawals.get(68)!, 1);
  });

  it("in dollar mode, the balance itself reaches exactly zero and stays there", () => {
    const person = makePerson({ retirementAge: 40, currentBalance: 10000, growthRatePct: 0 });
    const totals = projectHouseholdBalanceByAge([person], 40, 45, { mode: "dollar", value: 3000 }, {}, TODAY);
    expect(totals.get(43)).toBeCloseTo(1000, 2);
    expect(totals.get(44)).toBe(0);
    expect(totals.get(45)).toBe(0);
  });

  it("sums independently across multiple people", () => {
    const alice = makePerson({ id: "alice" });
    const bob = makePerson({ id: "bob" });
    const solo = projectHouseholdBalanceByAge([alice], 40, 45, { mode: "percent", value: 4 }, {}, TODAY).get(42)!;
    const pair = projectHouseholdBalanceByAge([alice, bob], 40, 45, { mode: "percent", value: 4 }, {}, TODAY).get(42)!;
    expect(pair).toBeCloseTo(solo * 2, 2);
  });
});

describe("projectHouseholdSocialSecurityByAge", () => {
  it("pays nothing before the claim age and a flat annualized amount after", () => {
    const person = makePerson({ socialSecurityClaimAge: 67, socialSecurityMonthly: 2000 });
    const totals = projectHouseholdSocialSecurityByAge([person], 40, 69, {}, TODAY);
    expect(totals.get(65)).toBe(0);
    expect(totals.get(66)).toBe(0);
    expect(totals.get(67)).toBeCloseTo(24000, 5);
    expect(totals.get(69)).toBeCloseTo(24000, 5);
  });

  it("honors a claim-age override without touching the base person data", () => {
    const person = makePerson({ socialSecurityClaimAge: 67, socialSecurityMonthly: 2000 });
    const totals = projectHouseholdSocialSecurityByAge(
      [person],
      40,
      63,
      { p1: { socialSecurityClaimAge: 62 } },
      TODAY,
    );
    expect(totals.get(63)).toBeCloseTo(24000, 5);
    expect(person.socialSecurityClaimAge).toBe(67);
  });
});

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "s1",
    name: "Scenario 1",
    detail: "",
    field: "contributionPct",
    value: 20,
    ...overrides,
  };
}

describe("personScenarioOptions", () => {
  it("always starts with Base (no overrides)", () => {
    const options = personScenarioOptions(makePerson());
    expect(options[0]).toEqual(["Base", {}]);
  });

  it("turns a simple-field scenario into a single-key override", () => {
    const person = makePerson({
      scenarios: [makeScenario({ field: "contributionPct", value: 20 })],
    });
    const options = personScenarioOptions(person);
    expect(options[1]).toEqual(["Scenario 1", { contributionPct: 20 }]);
  });

  it("turns an income-change scenario into an incomeChange override", () => {
    const incomeChange = { age: 50, newSalary: 80000 };
    const person = makePerson({
      scenarios: [makeScenario({ field: "incomeChange", value: incomeChange })],
    });
    const options = personScenarioOptions(person);
    expect(options[1]).toEqual(["Scenario 1", { incomeChange }]);
  });
});

describe("projectSeriesByYear", () => {
  it("extends past retirement with growth-only compounding", () => {
    const person = makePerson({ retirementAge: 41 }); // retires next year
    const series = projectSeriesByYear(person, {}, 2029, TODAY);
    const atRetirementYear = series.get(2027)!;
    const yearAfter = series.get(2028)!;
    // No more contributions past retirement — pure growth.
    expect(yearAfter).toBeCloseTo(atRetirementYear * 1.06, 2);
    expect(series.has(2029)).toBe(true);
  });
});

describe("buildHouseholdComboData", () => {
  it("returns nothing for an empty household", () => {
    const { combos, totalCombos } = buildHouseholdComboData([], TODAY);
    expect(combos).toEqual([]);
    expect(totalCombos).toBe(0);
  });

  it("produces exactly Base for a person with no scenarios", () => {
    const { combos, totalCombos } = buildHouseholdComboData([makePerson()], TODAY);
    expect(totalCombos).toBe(1);
    expect(combos).toHaveLength(1);
    expect(combos[0].label).toBe("Test Person: Base");
  });

  it("cross-multiplies combos across multiple people", () => {
    const alice = makePerson({
      id: "alice",
      scenarios: [makeScenario({ id: "a1", name: "High Growth", field: "growthRatePct", value: 10 })],
    });
    const bob = makePerson({
      id: "bob",
      scenarios: [makeScenario({ id: "b1", name: "Retire Early", field: "retirementAge", value: 60 })],
    });
    const { combos, totalCombos } = buildHouseholdComboData([alice, bob], TODAY);
    expect(totalCombos).toBe(4); // 2 options each
    expect(combos.map((c) => c.label).sort()).toEqual([
      "Test Person: Base, Test Person: Base",
      "Test Person: Base, Test Person: Retire Early",
      "Test Person: High Growth, Test Person: Base",
      "Test Person: High Growth, Test Person: Retire Early",
    ]);
  });

  it("sums each combo's series across people at every shared year", () => {
    const alice = makePerson({ id: "alice", currentBalance: 1000, retirementAge: 41 });
    const bob = makePerson({ id: "bob", currentBalance: 2000, retirementAge: 41 });
    const { combos } = buildHouseholdComboData([alice, bob], TODAY);
    const soloAlice = projectSeriesByYear(alice, {}, 2027, TODAY);
    const soloBob = projectSeriesByYear(bob, {}, 2027, TODAY);
    expect(combos[0].series.get(2027)).toBeCloseTo(soloAlice.get(2027)! + soloBob.get(2027)!, 2);
  });

  it("returns an empty combo list (but the real count) past the combo cap", () => {
    const manyScenarios = Array.from({ length: 4 }, (_, i) =>
      makeScenario({ id: `s${i}`, name: `S${i}`, field: "contributionPct", value: 10 + i }),
    );
    // 5 options (Base + 4) per person, 3 people => 125 combos, over the 100 cap.
    const people = [
      makePerson({ id: "p1", scenarios: manyScenarios }),
      makePerson({ id: "p2", scenarios: manyScenarios }),
      makePerson({ id: "p3", scenarios: manyScenarios }),
    ];
    const { combos, totalCombos } = buildHouseholdComboData(people, TODAY);
    expect(totalCombos).toBe(125);
    expect(combos).toEqual([]);
  });
});
