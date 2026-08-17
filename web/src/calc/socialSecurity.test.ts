import { describe, expect, it } from "vitest";
import {
  claimAgeAdjustmentFactor,
  estimateMonthlySocialSecurity,
  fullRetirementAgeMonths,
} from "./socialSecurity";

// Reference values cross-checked against the Python implementation in
// app.py and against SSA's documented reduction/credit schedule (~30%
// reduction claiming 5 years before a full retirement age of 67, ~24%
// increase delaying 3 years past it).

describe("fullRetirementAgeMonths", () => {
  it("is 67 for anyone born 1960 or later", () => {
    expect(fullRetirementAgeMonths(1990)).toBe(67 * 12);
    expect(fullRetirementAgeMonths(1960)).toBe(67 * 12);
  });

  it("is 66 for the 1943-1954 cohort", () => {
    expect(fullRetirementAgeMonths(1950)).toBe(66 * 12);
  });

  it("is 65 for 1937 and earlier", () => {
    expect(fullRetirementAgeMonths(1930)).toBe(65 * 12);
  });

  it("steps by 2 months per birth year in the transition zones", () => {
    expect(fullRetirementAgeMonths(1958)).toBe(66 * 12 + 8); // 66y8m
  });
});

describe("claimAgeAdjustmentFactor", () => {
  it("is 1.0 at exactly full retirement age", () => {
    expect(claimAgeAdjustmentFactor(67 * 12, 67 * 12)).toBe(1.0);
  });

  it("reduces by about 30% for claiming 5 years early against a 67 FRA", () => {
    const factor = claimAgeAdjustmentFactor(62 * 12, 67 * 12);
    expect(factor).toBeCloseTo(0.7, 2);
  });

  it("increases by about 24% for delaying 3 years past a 67 FRA", () => {
    const factor = claimAgeAdjustmentFactor(70 * 12, 67 * 12);
    expect(factor).toBeCloseTo(1.24, 2);
  });
});

describe("estimateMonthlySocialSecurity", () => {
  // $90,000 salary, born 1990-01-01 (FRA 67).
  it("matches the verified reference value at full retirement age", () => {
    expect(estimateMonthlySocialSecurity(90000, "1990-01-01", 67)).toBeCloseTo(3009, 0);
  });

  it("matches the verified reference value claiming early at 62", () => {
    expect(estimateMonthlySocialSecurity(90000, "1990-01-01", 62)).toBeCloseTo(2106, 0);
  });

  it("matches the verified reference value delaying to 70", () => {
    expect(estimateMonthlySocialSecurity(90000, "1990-01-01", 70)).toBeCloseTo(3731, 0);
  });

  it("returns 0 for a $0 salary", () => {
    expect(estimateMonthlySocialSecurity(0, "1990-01-01", 67)).toBe(0);
  });
});
