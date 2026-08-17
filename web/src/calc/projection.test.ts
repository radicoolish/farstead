import { describe, expect, it } from "vitest";
import {
  buildHouseholdComboData,
  personScenarioOptions,
  projectBalance,
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
    const person = makePerson();
    const totals = projectHouseholdWithdrawalIncomeByAge([person], 40, 68, 4, {}, TODAY);
    expect(totals.get(65)).toBe(0); // retirement year itself: no withdrawal yet
    expect(totals.get(66)).toBeCloseTo(38834.45, 1);
    expect(totals.get(67)).toBeCloseTo(39517.94, 1);
    expect(totals.get(68)).toBeCloseTo(40213.46, 1);
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
