import { describe, expect, it } from "vitest";
import { calculateAge, formatCompactCurrency } from "./age";

describe("calculateAge", () => {
  const asOf = new Date(2026, 7, 16); // 2026-08-16

  it("counts a full year once the birthday has passed this year", () => {
    expect(calculateAge("1990-01-01", asOf)).toBe(36);
  });

  it("doesn't count this year yet if the birthday hasn't happened", () => {
    expect(calculateAge("1990-12-25", asOf)).toBe(35);
  });

  it("counts the birthday itself as already turned", () => {
    expect(calculateAge("1990-08-16", asOf)).toBe(36);
  });
});

describe("formatCompactCurrency", () => {
  it("formats millions with one decimal", () => {
    expect(formatCompactCurrency(1_340_000)).toBe("$1.3MM");
  });

  it("formats thousands with no decimal", () => {
    expect(formatCompactCurrency(45_000)).toBe("$45K");
  });

  it("formats sub-thousand amounts as plain dollars", () => {
    expect(formatCompactCurrency(900)).toBe("$900");
  });
});
