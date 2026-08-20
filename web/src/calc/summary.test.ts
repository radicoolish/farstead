import { describe, expect, it } from "vitest";
import { averageOverRange, householdRetirementBoundaryAge } from "./summary";
import type { Person } from "./types";

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
