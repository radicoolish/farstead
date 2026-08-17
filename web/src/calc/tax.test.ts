import { describe, expect, it } from "vitest";
import { calculateFederalTax, estimateEffectiveTaxRate } from "./tax";

describe("calculateFederalTax", () => {
  it("taxes only the first bracket when income is within it", () => {
    expect(calculateFederalTax(5000, "Single")).toBeCloseTo(500, 2); // 10% of 5000
  });

  it("applies marginal rates across multiple brackets", () => {
    // Single, $60,000 taxable: 10% to 11,600 + 12% to 47,150 + 22% of the rest
    const expected = 11600 * 0.1 + (47150 - 11600) * 0.12 + (60000 - 47150) * 0.22;
    expect(calculateFederalTax(60000, "Single")).toBeCloseTo(expected, 2);
  });

  it("returns 0 for non-positive taxable income", () => {
    expect(calculateFederalTax(0, "Single")).toBe(0);
  });
});

describe("estimateEffectiveTaxRate", () => {
  it("returns 0 for a non-positive salary", () => {
    expect(estimateEffectiveTaxRate("Texas", "Single", 0)).toBe(0);
  });

  it("adds the flat state rate on top of the federal effective rate", () => {
    const noState = estimateEffectiveTaxRate("Texas", "Single", 90000); // 0% state
    const withState = estimateEffectiveTaxRate("California", "Single", 90000); // 9.3% state
    expect(withState - noState).toBeCloseTo(9.3, 5);
  });

  it("pretax reductions lower taxable income and thus the effective rate", () => {
    const withoutReduction = estimateEffectiveTaxRate("Texas", "Single", 90000, 0);
    const withReduction = estimateEffectiveTaxRate("Texas", "Single", 90000, 10000);
    expect(withReduction).toBeLessThan(withoutReduction);
  });
});
