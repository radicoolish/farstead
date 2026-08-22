import { describe, expect, it } from "vitest";
import { defaultSimpleHousehold, simpleExpensesToExpenses, simpleHouseholdToPerson, simpleRetirementAgeOverride } from "./simple";
import { estimateMonthlySocialSecurity } from "./socialSecurity";

const TODAY = new Date(2026, 7, 16); // 2026-08-16, matches projection.test.ts's convention

describe("simpleHouseholdToPerson", () => {
  it("maps fields straight across and synthesizes a birthday from currentAge", () => {
    const simple = defaultSimpleHousehold();
    const person = simpleHouseholdToPerson(simple, TODAY);
    expect(person.birthday).toBe("1991-01-01"); // 2026 - 35
    expect(person.currentSalary).toBe(simple.householdIncome);
    expect(person.contributionPct).toBe(simple.contributionPct);
    expect(person.matchPct).toBe(simple.matchPct);
    expect(person.salaryIncreasePct).toBe(simple.salaryIncreasePct);
    expect(person.growthRatePct).toBe(simple.growthRatePct);
    expect(person.currentBalance).toBe(simple.currentBalance);
    expect(person.retirementAge).toBe(simple.retirementAge);
    expect(person.stopContributionAge).toBe(simple.retirementAge);
    expect(person.accountType).toBe("Pre-tax");
    expect(person.taxRatePct).toBe(simple.taxRatePct);
    expect(person.socialSecurityClaimAge).toBe(67);
    expect(person.savingsBalance).toBe(simple.savingsBalance);
    expect(person.savingsGrowthRatePct).toBe(simple.savingsGrowthRatePct);
    expect(person.savingsContributionMonthly).toBe(0);
    expect(person.hsaMonthly).toBe(0);
    expect(person.medicalInsuranceMonthly).toBe(0);
    expect(person.scenarios).toEqual([]);
  });

  it("auto-calculates Social Security from household income, matching the shared estimator", () => {
    const simple = defaultSimpleHousehold();
    const person = simpleHouseholdToPerson(simple, TODAY);
    const expected = estimateMonthlySocialSecurity(simple.householdIncome, "1991-01-01", 67);
    expect(person.socialSecurityMonthly).toBeCloseTo(expected, 5);
    expect(person.socialSecurityMonthly).toBeGreaterThan(0);
  });
});

describe("simpleExpensesToExpenses", () => {
  it("converts each row into a fixed age-window expense, inflated at the shared rate", () => {
    const simple = defaultSimpleHousehold();
    simple.inflationRatePct = 2.5;
    simple.expenses = [{ id: "e1", startAge: 60, stopAge: 85, monthlyAmount: 4000 }];
    const [expense] = simpleExpensesToExpenses(simple);
    expect(expense).toEqual({
      id: "e1",
      type: "Other Costs",
      monthlyAmount: 4000,
      isLoan: false,
      isPerpetuity: false,
      startAge: 60,
      stopAge: 85,
      applyInflation: true,
      inflationRate: 2.5,
    });
  });

  it("doesn't apply inflation when the household rate is 0", () => {
    const simple = defaultSimpleHousehold();
    simple.inflationRatePct = 0;
    simple.expenses = [{ id: "e1", startAge: 60, stopAge: 85, monthlyAmount: 4000 }];
    expect(simpleExpensesToExpenses(simple)[0].applyInflation).toBe(false);
  });

  it("converts multiple rows independently", () => {
    const simple = defaultSimpleHousehold();
    simple.expenses = [
      { id: "e1", startAge: 35, stopAge: 65, monthlyAmount: 5000 },
      { id: "e2", startAge: 65, stopAge: 85, monthlyAmount: 3000 },
    ];
    const converted = simpleExpensesToExpenses(simple);
    expect(converted).toHaveLength(2);
    expect(converted[0].startAge).toBe(35);
    expect(converted[1].startAge).toBe(65);
  });
});

describe("simpleRetirementAgeOverride", () => {
  it("keys the override to the synthetic household person id", () => {
    expect(simpleRetirementAgeOverride(60)).toEqual({ "simple-household": { retirementAge: 60 } });
  });
});
