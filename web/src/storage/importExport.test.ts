import { describe, expect, it } from "vitest";
import { buildExportPayload, validateImportPayload } from "./importExport";
import type { Expense, Person } from "../calc";

const person: Person = {
  id: "p1",
  name: "Test",
  birthday: "1990-01-01",
  currentSalary: 100000,
  contributionPct: 6,
  matchPct: 3,
  salaryIncreasePct: 3,
  growthRatePct: 7,
  currentBalance: 0,
  accountType: "Pre-tax",
  retirementAge: 65,
  stopContributionAge: 65,
  hsaMonthly: 0,
  medicalInsuranceMonthly: 0,
  taxRatePct: 22,
  socialSecurityClaimAge: 67,
  socialSecurityMonthly: 0,
  scenarios: [],
};

const expense: Expense = {
  id: "e1",
  type: "Groceries",
  monthlyAmount: 600,
  isLoan: false,
  isPerpetuity: true,
  applyInflation: true,
  inflationRate: 3,
};

describe("buildExportPayload / validateImportPayload round trip", () => {
  it("a freshly built export payload always validates", () => {
    const payload = buildExportPayload([person], [expense], 36, 4);
    expect(validateImportPayload(payload)).toBeNull();
  });

  it("an empty household still validates", () => {
    expect(validateImportPayload(buildExportPayload([], [], 35, 4))).toBeNull();
  });
});

describe("validateImportPayload", () => {
  it("rejects non-object top level", () => {
    expect(validateImportPayload("not json")).toMatch(/expected a JSON object/);
    expect(validateImportPayload(null)).toMatch(/expected a JSON object/);
    expect(validateImportPayload([1, 2, 3])).toMatch(/expected a JSON object/);
  });

  it("rejects a payload missing people or expenses", () => {
    expect(validateImportPayload({ people: [] })).toMatch(/missing "people" or "expenses"/);
    expect(validateImportPayload({ expenses: [] })).toMatch(/missing "people" or "expenses"/);
  });

  it("rejects people/expenses that aren't arrays", () => {
    expect(validateImportPayload({ people: {}, expenses: [] })).toMatch(/must be lists/);
    expect(validateImportPayload({ people: [], expenses: "nope" })).toMatch(/must be lists/);
  });

  it("rejects a person missing required fields", () => {
    const badPerson = { ...person } as Partial<Person>;
    delete badPerson.currentSalary;
    const error = validateImportPayload({ people: [badPerson], expenses: [] });
    expect(error).toMatch(/Person #1.*missing required fields/);
  });

  it("rejects an expense missing required fields", () => {
    const badExpense = { ...expense } as Partial<Expense>;
    delete badExpense.monthlyAmount;
    const error = validateImportPayload({ people: [], expenses: [badExpense] });
    expect(error).toMatch(/Expense #1.*missing required fields/);
  });

  it("accepts a well-formed payload with people and expenses", () => {
    expect(validateImportPayload({ people: [person], expenses: [expense] })).toBeNull();
  });
});
